import { NextRequest } from "next/server"

import { getBearerToken, validateProjectToken } from "@/lib/publish/auth"
import {
  publishRelease,
  readExistingReleaseFiles,
  recordUnchangedPublish,
} from "@/lib/publish/persist"
import {
  hashRelease,
  mergePublishFiles,
  normalizeHash,
  normalizeRelease,
  normalizeSourceCommit,
  toManifestFile,
  validateBranding,
  validateFiles,
  validateManifest,
  type PublishBody,
} from "@/lib/publish/validate"
import { revalidatePublicChangelogRelease } from "@/lib/public-changelog-cache"
import { projectPublicUrl } from "@/lib/public-url"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; version: string }> }
) {
  const { id, version } = await params
  const releaseVersion = normalizeRelease(version)
  if (!releaseVersion) return jsonError("Invalid release version", 400)

  const token = getBearerToken(request)
  if (!token) return jsonError("Missing project token", 401)

  const candidate = await validateProjectToken(id, token)
  if (!candidate)
    return jsonError("Project token is invalid, expired, or revoked", 401)

  let body: PublishBody
  try {
    body = (await request.json()) as PublishBody
  } catch {
    return jsonError("Invalid JSON body", 400)
  }

  const sourceCommit = normalizeSourceCommit(body.sourceCommit)
  const requestedContentHash = normalizeHash(body.contentHash)
  if (!requestedContentHash)
    return jsonError("Invalid release content hash", 400)

  const uploadedFiles = validateFiles(
    body.files,
    releaseVersion,
    body.manifest === undefined
  )
  if ("error" in uploadedFiles) return jsonError(uploadedFiles.error, 400)

  const manifestResult =
    body.manifest === undefined
      ? { value: uploadedFiles.value.map(toManifestFile) }
      : validateManifest(body.manifest, releaseVersion)
  if ("error" in manifestResult) return jsonError(manifestResult.error, 400)
  const manifest = manifestResult.value

  const contentHash = hashRelease(manifest)
  if (contentHash !== requestedContentHash) {
    return jsonError("Release content hash does not match file manifest", 400)
  }

  const existing = await readExistingReleaseFiles(id, releaseVersion)
  const mergedFiles = mergePublishFiles(
    manifest,
    uploadedFiles.value,
    existing.files,
    releaseVersion
  )
  if ("error" in mergedFiles) return jsonError(mergedFiles.error, 400)

  const brandingResult = validateBranding(body.branding)
  if ("error" in brandingResult) return jsonError(brandingResult.error, 400)
  const branding = brandingResult.value

  if (existing.release?.contentHash === contentHash) {
    await recordUnchangedPublish({
      projectId: id,
      branding,
      tokenId: candidate.tokenId,
    })

    if (branding) {
      revalidatePublicChangelogRelease(id, releaseVersion)
    }

    return Response.json({
      release: {
        version: releaseVersion,
        fileCount: existing.files.length,
        contentHash,
      },
      upToDate: true,
      uploadedFileCount: 0,
      publicUrl: projectPublicUrl(id),
    })
  }

  const published = await publishRelease({
    projectId: id,
    releaseVersion,
    sourceCommit,
    contentHash,
    files: mergedFiles.value,
    branding,
    tokenId: candidate.tokenId,
  })

  revalidatePublicChangelogRelease(id, releaseVersion)

  return Response.json({
    release: {
      ...published,
      fileCount: mergedFiles.value.length,
      contentHash,
    },
    upToDate: false,
    uploadedFileCount: uploadedFiles.value.length,
    publicUrl: projectPublicUrl(id),
  })
}

function jsonError(error: string, status: number) {
  return Response.json({ error }, { status })
}
