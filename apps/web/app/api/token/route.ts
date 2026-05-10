import { createHash, randomBytes } from "crypto";

import { and, eq, gt, isNull } from "drizzle-orm";
import { NextRequest } from "next/server";

import { project, projectJoinCode, projectToken } from "@/db/schema";
import { db } from "@/lib/db";
import { publishJoinCodeClaimed } from "@/lib/join-code-events";
import { createUniqueProjectSlug } from "@/lib/project-slug";
import { revalidatePublicChangelogProject } from "@/lib/public-changelog-cache";

const JOIN_CODE_PATTERN = /^[a-z2-9]{3}-[a-z2-9]{3}-[a-z2-9]{3}$/;
const TOKEN_PREFIX = "slog_";

type TokenRequest = {
  joinCode?: unknown;
  projectName?: unknown;
};

export async function POST(request: NextRequest) {
  let body: TokenRequest;

  try {
    body = (await request.json()) as TokenRequest;
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  const joinCode = normalizeJoinCode(body.joinCode);
  if (!joinCode) return jsonError("Invalid join code", 400);

  const projectName = normalizeProjectName(body.projectName);
  if (!projectName) return jsonError("Invalid project name", 400);

  try {
    const result = await redeemJoinCode(joinCode, projectName);

    if (!result) {
      return jsonError("Join code is invalid, expired, or already used", 404);
    }

    revalidatePublicChangelogProject(result.projectId);

    publishJoinCodeClaimed(joinCode, {
      project: {
        id: result.projectId,
        name: result.projectName,
      },
    });

    return Response.json(result);
  } catch {
    return jsonError("Failed to redeem join code", 500);
  }
}

async function redeemJoinCode(joinCode: string, projectName: string) {
  return await db.transaction(async (tx) => {
    const [join] = await tx
      .update(projectJoinCode)
      .set({ claimedAt: new Date() })
      .where(
        and(
          eq(projectJoinCode.code, joinCode),
          isNull(projectJoinCode.claimedAt),
          gt(projectJoinCode.expiresAt, new Date()),
        ),
      )
      .returning({ ownerUserId: projectJoinCode.ownerUserId });

    if (!join) return null;

    const projectId = await createUniqueProjectSlug(projectName, async (slug) => {
      const [existing] = await tx
        .select({ id: project.id })
        .from(project)
        .where(eq(project.id, slug))
        .limit(1);

      return Boolean(existing);
    });
    const token = mintToken();
    const salt = randomBytes(16).toString("hex");

    await tx.insert(project).values({
      id: projectId,
      name: projectName,
      ownerUserId: join.ownerUserId,
    });

    await tx.insert(projectToken).values({
      id: randomId(),
      projectId,
      name: "CLI",
      tokenStart: token.slice(0, 14),
      tokenSalt: salt,
      tokenHash: hashToken(token, salt),
    });

    await tx
      .update(projectJoinCode)
      .set({
        claimedProjectId: projectId,
      })
      .where(eq(projectJoinCode.code, joinCode));

    return {
      projectId,
      projectName,
      token,
    };
  });
}

function normalizeJoinCode(value: unknown) {
  if (typeof value !== "string") return null;
  const code = value.trim().toLowerCase();
  return JOIN_CODE_PATTERN.test(code) ? code : null;
}

function normalizeProjectName(value: unknown) {
  if (typeof value !== "string") return null;
  const name = value.trim();
  if (name.length === 0 || name.length > 80) return null;
  return name;
}

function mintToken() {
  return `${TOKEN_PREFIX}${randomBytes(16).toString("hex")}`;
}

function hashToken(token: string, salt: string) {
  return createHash("sha256").update(`${salt}:${token}`).digest("hex");
}

function randomId() {
  return randomBytes(16).toString("hex");
}

function jsonError(error: string, status: number) {
  return Response.json({ error }, { status });
}
