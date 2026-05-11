import { createHash } from "crypto"

import { and, eq, gt, isNull, or } from "drizzle-orm"

import { project, projectToken } from "@/db/schema"
import { db } from "@/lib/db"

const TOKEN_PATTERN = /^slog_[a-z0-9]{32}$/

export type ValidatedProjectToken = {
  tokenId: string
}

export function getBearerToken(request: { headers: Headers }) {
  const header = request.headers.get("authorization")
  const match = header?.match(/^Bearer\s+(.+)$/i)
  const token = match?.[1]?.trim()
  return token && TOKEN_PATTERN.test(token) ? token : null
}

export async function validateProjectToken(
  projectId: string,
  token: string
): Promise<ValidatedProjectToken | null> {
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

  return { tokenId: candidate.tokenId }
}

function hashToken(token: string, salt: string) {
  return createHash("sha256").update(`${salt}:${token}`).digest("hex")
}
