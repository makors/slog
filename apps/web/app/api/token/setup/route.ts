import { createHash } from "crypto";

import { and, eq, gt, isNull, or } from "drizzle-orm";
import { NextRequest } from "next/server";

import { project, projectToken } from "@/db/schema";
import { db } from "@/lib/db";

const TOKEN_PATTERN = /^slog_[a-z0-9]{32}$/;

type TokenSetupRequest = {
  token?: unknown;
};

export async function POST(request: NextRequest) {
  let body: TokenSetupRequest;

  try {
    body = (await request.json()) as TokenSetupRequest;
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  const token = normalizeToken(body.token);
  if (!token) return jsonError("Invalid project token", 400);

  const tokenStart = token.slice(0, 14);
  const [candidate] = await db
    .select({
      tokenId: projectToken.id,
      tokenSalt: projectToken.tokenSalt,
      tokenHash: projectToken.tokenHash,
      projectId: project.id,
      projectName: project.name,
    })
    .from(projectToken)
    .innerJoin(project, eq(project.id, projectToken.projectId))
    .where(
      and(
        eq(projectToken.tokenStart, tokenStart),
        isNull(projectToken.revokedAt),
        or(isNull(projectToken.expiresAt), gt(projectToken.expiresAt, new Date())),
      ),
    )
    .limit(1);

  if (!candidate || hashToken(token, candidate.tokenSalt) !== candidate.tokenHash) {
    return jsonError("Project token is invalid, expired, or revoked", 404);
  }

  await db
    .update(projectToken)
    .set({ lastUsedAt: new Date() })
    .where(eq(projectToken.id, candidate.tokenId));

  return Response.json({
    projectId: candidate.projectId,
    projectName: candidate.projectName,
  });
}

function normalizeToken(value: unknown) {
  if (typeof value !== "string") return null;
  const token = value.trim();
  return TOKEN_PATTERN.test(token) ? token : null;
}

function hashToken(token: string, salt: string) {
  return createHash("sha256").update(`${salt}:${token}`).digest("hex");
}

function jsonError(error: string, status: number) {
  return Response.json({ error }, { status });
}
