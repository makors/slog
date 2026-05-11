import { createHash } from "crypto"

import { and, eq, gt, isNull, notInArray, or } from "drizzle-orm"
import { NextRequest } from "next/server"

import { project, projectRelease, projectToken } from "@/db/schema"
import { db } from "@/lib/db"
import {
  revalidatePublicChangelogProject,
  revalidatePublicChangelogRelease,
} from "@/lib/public-changelog-cache"

const TOKEN_PATTERN = /^slog_[a-z0-9]{32}$/
const MAX_RELEASES = 200
const MAX_DISPLAY_NAME_LENGTH = 60

type PublishStateBody = {
  releases?: unknown
  branding?: unknown
}

type ValidatedBranding = {
  displayName: string | null
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const token = getBearerToken(request)
  if (!token) return jsonError("Missing project token", 401)

  const candidate = await validateProjectToken(id, token)
  if (!candidate)
    return jsonError("Project token is invalid, expired, or revoked", 401)

  let body: PublishStateBody
  try {
    body = (await request.json()) as PublishStateBody
  } catch {
    return jsonError("Invalid JSON body", 400)
  }

  const releasesResult = validateReleases(body.releases)
  if ("error" in releasesResult) return jsonError(releasesResult.error, 400)
  const releases = releasesResult.value

  const brandingResult = validateBranding(body.branding)
  if ("error" in brandingResult) return jsonError(brandingResult.error, 400)
  const branding = brandingResult.value

  const now = new Date()
  const deletedReleases = await db.transaction(async (tx) => {
    const deleted =
      releases.length === 0
        ? await tx
            .delete(projectRelease)
            .where(eq(projectRelease.projectId, id))
            .returning({ version: projectRelease.version })
        : await tx
            .delete(projectRelease)
            .where(
              and(
                eq(projectRelease.projectId, id),
                notInArray(projectRelease.version, releases)
              )
            )
            .returning({ version: projectRelease.version })

    if (branding) {
      await tx
        .update(project)
        .set({
          displayName: branding.displayName,
          updatedAt: now,
        })
        .where(eq(project.id, id))
    }

    await tx
      .update(projectToken)
      .set({ lastUsedAt: now })
      .where(eq(projectToken.id, candidate.tokenId))

    return deleted.map((release) => release.version)
  })

  if (deletedReleases.length > 0) {
    for (const release of deletedReleases) {
      revalidatePublicChangelogRelease(id, release)
    }
  } else if (branding) {
    revalidatePublicChangelogProject(id)
  }

  return Response.json({
    releaseCount: releases.length,
    deletedReleaseCount: deletedReleases.length,
    deletedReleases,
  })
}

async function validateProjectToken(projectId: string, token: string) {
  const tokenStart = token.slice(0, 14)
  const [candidate] = await db
    .select({
      tokenId: projectToken.id,
      tokenSalt: projectToken.tokenSalt,
      tokenHash: projectToken.tokenHash,
    })
    .from(projectToken)
    .innerJoin(project, eq(project.id, projectToken.projectId))
    .where(
      and(
        eq(project.id, projectId),
        eq(projectToken.tokenStart, tokenStart),
        isNull(projectToken.revokedAt),
        or(
          isNull(projectToken.expiresAt),
          gt(projectToken.expiresAt, new Date())
        )
      )
    )
    .limit(1)

  if (
    !candidate ||
    hashToken(token, candidate.tokenSalt) !== candidate.tokenHash
  ) {
    return null
  }

  return candidate
}

function validateReleases(
  value: unknown
): { value: string[] } | { error: string } {
  if (!Array.isArray(value)) return { error: "Releases must be an array" }
  if (value.length > MAX_RELEASES) {
    return { error: `Project must include at most ${MAX_RELEASES} releases` }
  }

  const seen = new Set<string>()
  const releases: string[] = []

  for (const item of value) {
    const release = normalizeRelease(item)
    if (!release)
      return { error: "Release versions must be single folder names" }
    if (seen.has(release))
      return { error: `Duplicate release version: ${release}` }

    seen.add(release)
    releases.push(release)
  }

  releases.sort((a, b) => a.localeCompare(b))
  return { value: releases }
}

function validateBranding(
  value: unknown
): { value: ValidatedBranding | null } | { error: string } {
  if (value === undefined || value === null) return { value: null }
  if (typeof value !== "object" || Array.isArray(value)) {
    return { error: "Branding must be an object" }
  }

  const branding = value as Record<string, unknown>
  let displayName: string | null = null

  if (branding.displayName !== undefined && branding.displayName !== null) {
    if (typeof branding.displayName !== "string") {
      return { error: "Branding displayName must be a string" }
    }
    const trimmed = branding.displayName.trim()
    if (trimmed.length > MAX_DISPLAY_NAME_LENGTH) {
      return {
        error: `Branding displayName must be at most ${MAX_DISPLAY_NAME_LENGTH} characters`,
      }
    }
    displayName = trimmed.length > 0 ? trimmed : null
  }

  return { value: { displayName } }
}

function getBearerToken(request: NextRequest) {
  const header = request.headers.get("authorization")
  const match = header?.match(/^Bearer\s+(.+)$/i)
  const token = match?.[1]?.trim()
  return token && TOKEN_PATTERN.test(token) ? token : null
}

function normalizeRelease(value: unknown) {
  if (typeof value !== "string") return null

  const release = value.trim()
  if (
    !release ||
    release.includes("/") ||
    release.includes("\\") ||
    release.includes("\0") ||
    release === "." ||
    release === ".."
  ) {
    return null
  }

  return release
}

function hashToken(token: string, salt: string) {
  return createHash("sha256").update(`${salt}:${token}`).digest("hex")
}

function jsonError(error: string, status: number) {
  return Response.json({ error }, { status })
}
