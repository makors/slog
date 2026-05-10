"use server";

import { createHash, randomBytes } from "crypto";

import { and, asc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

import { project, projectToken } from "@/db/schema";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { revalidatePublicChangelogProject } from "@/lib/public-changelog-cache";

const TOKEN_PREFIX = "slog_";

export type ProjectTokenRow = {
  id: string;
  name: string;
  tokenStart: string;
  lastUsedAt: string | null;
  createdAt: string;
};

export type RevealedProjectToken = ProjectTokenRow & {
  value: string;
};

export async function deleteProject(
  projectId: string,
): Promise<{ ok: true } | { error: string }> {
  const userId = await getSessionUserId();
  if (!userId) return { error: "Unauthorized" };

  const deleted = await db
    .delete(project)
    .where(and(eq(project.id, projectId), eq(project.ownerUserId, userId)))
    .returning({ id: project.id });

  if (deleted.length === 0) {
    return { error: "Project not found" };
  }

  revalidatePublicChangelogProject(projectId);
  revalidatePath("/dashboard");

  return { ok: true };
}

export async function listProjectTokens(
  projectId: string,
): Promise<{ tokens: ProjectTokenRow[] } | { error: string }> {
  const userId = await getSessionUserId();
  if (!userId) return { error: "Unauthorized" };

  const owned = await isOwnedProject(projectId, userId);
  if (!owned) return { error: "Project not found" };

  const tokens = await db
    .select({
      id: projectToken.id,
      name: projectToken.name,
      tokenStart: projectToken.tokenStart,
      lastUsedAt: projectToken.lastUsedAt,
      createdAt: projectToken.createdAt,
    })
    .from(projectToken)
    .where(eq(projectToken.projectId, projectId))
    .orderBy(asc(projectToken.createdAt));

  return { tokens: tokens.map(serializeTokenRow) };
}

export async function createProjectToken(
  projectId: string,
  nameInput: string,
): Promise<{ token: RevealedProjectToken } | { error: string }> {
  const userId = await getSessionUserId();
  if (!userId) return { error: "Unauthorized" };

  const name = normalizeName(nameInput);
  if (!name) return { error: "Name is required" };

  const owned = await isOwnedProject(projectId, userId);
  if (!owned) return { error: "Project not found" };

  const tokenId = randomId();
  const token = `${TOKEN_PREFIX}${randomBytes(16).toString("hex")}`;
  const salt = randomBytes(16).toString("hex");

  const [created] = await db
    .insert(projectToken)
    .values({
      id: tokenId,
      projectId,
      name,
      tokenStart: token.slice(0, 14),
      tokenSalt: salt,
      tokenHash: hashToken(token, salt),
    })
    .returning({
      id: projectToken.id,
      name: projectToken.name,
      tokenStart: projectToken.tokenStart,
      lastUsedAt: projectToken.lastUsedAt,
      createdAt: projectToken.createdAt,
    });

  return {
    token: {
      ...serializeTokenRow(created),
      value: token,
    },
  };
}

export async function deleteProjectToken(
  projectId: string,
  tokenId: string,
): Promise<{ ok: true } | { error: string }> {
  const userId = await getSessionUserId();
  if (!userId) return { error: "Unauthorized" };

  const owned = await isOwnedProject(projectId, userId);
  if (!owned) return { error: "Project not found" };

  const deleted = await db
    .delete(projectToken)
    .where(
      and(eq(projectToken.id, tokenId), eq(projectToken.projectId, projectId)),
    )
    .returning({ id: projectToken.id });

  if (deleted.length === 0) {
    return { error: "Token not found" };
  }

  return { ok: true };
}

async function getSessionUserId() {
  const session = await auth.api.getSession({ headers: await headers() });
  return session?.user.id ?? null;
}

async function isOwnedProject(projectId: string, userId: string) {
  const [owned] = await db
    .select({ id: project.id })
    .from(project)
    .where(and(eq(project.id, projectId), eq(project.ownerUserId, userId)))
    .limit(1);

  return Boolean(owned);
}

function serializeTokenRow(row: {
  id: string;
  name: string;
  tokenStart: string;
  lastUsedAt: Date | null;
  createdAt: Date;
}): ProjectTokenRow {
  return {
    id: row.id,
    name: row.name,
    tokenStart: row.tokenStart,
    lastUsedAt: row.lastUsedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

function normalizeName(value: unknown) {
  if (typeof value !== "string") return null;
  const name = value.trim();
  if (name.length === 0 || name.length > 60) return null;
  return name;
}

function hashToken(token: string, salt: string) {
  return createHash("sha256").update(`${salt}:${token}`).digest("hex");
}

function randomId() {
  return randomBytes(16).toString("hex");
}
