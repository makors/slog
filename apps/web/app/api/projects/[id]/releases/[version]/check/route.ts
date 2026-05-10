import { createHash } from "crypto";

import { and, eq, gt, isNull, or } from "drizzle-orm";
import { NextRequest } from "next/server";

import { project, projectRelease, projectReleaseFile, projectToken } from "@/db/schema";
import { db } from "@/lib/db";

const TOKEN_PATTERN = /^slog_[a-z0-9]{32}$/;
const MAX_PUBLISH_FILES = 80;

type CheckBody = {
  contentHash?: unknown;
  files?: unknown;
};

type CheckFileInput = {
  path: string;
  contentHash: string;
};

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; version: string }> },
) {
  const { id, version } = await params;
  const releaseVersion = normalizeRelease(version);
  if (!releaseVersion) return jsonError("Invalid release version", 400);

  const token = getBearerToken(request);
  if (!token) return jsonError("Missing project token", 401);

  const candidate = await validateProjectToken(id, token);
  if (!candidate) return jsonError("Project token is invalid, expired, or revoked", 401);

  let body: CheckBody;
  try {
    body = (await request.json()) as CheckBody;
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  const requestedContentHash = normalizeHash(body.contentHash);
  if (!requestedContentHash) return jsonError("Invalid release content hash", 400);

  const files = validateManifestFiles(body.files);
  if ("error" in files) return jsonError(files.error, 400);

  const contentHash = hashRelease(files.value);
  if (contentHash !== requestedContentHash) {
    return jsonError("Release content hash does not match file manifest", 400);
  }

  const [release] = await db
    .select({ id: projectRelease.id, contentHash: projectRelease.contentHash })
    .from(projectRelease)
    .where(and(eq(projectRelease.projectId, id), eq(projectRelease.version, releaseVersion)))
    .limit(1);

  if (!release) {
    return Response.json({
      release: null,
      needsPublish: true,
      requiredFiles: files.value.map((file) => file.path),
    });
  }

  if (release.contentHash === contentHash) {
    return Response.json({
      release: {
        contentHash: release.contentHash,
        fileCount: files.value.length,
      },
      needsPublish: false,
      requiredFiles: [],
    });
  }

  const existingFiles = await db
    .select({
      path: projectReleaseFile.path,
      contentHash: projectReleaseFile.contentHash,
    })
    .from(projectReleaseFile)
    .where(eq(projectReleaseFile.releaseId, release.id));

  const existingHashes = new Map(existingFiles.map((file) => [file.path, file.contentHash]));
  const requiredFiles = files.value
    .filter((file) => existingHashes.get(file.path) !== file.contentHash)
    .map((file) => file.path);

  return Response.json({
    release: {
      contentHash: release.contentHash,
      fileCount: existingFiles.length,
    },
    needsPublish: true,
    requiredFiles,
  });
}

async function validateProjectToken(projectId: string, token: string) {
  const tokenStart = token.slice(0, 14);
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
        or(isNull(projectToken.expiresAt), gt(projectToken.expiresAt, new Date())),
      ),
    )
    .limit(1);

  if (!candidate || hashToken(token, candidate.tokenSalt) !== candidate.tokenHash) {
    return null;
  }

  return candidate;
}

function validateManifestFiles(value: unknown): { value: CheckFileInput[] } | { error: string } {
  if (!Array.isArray(value)) return { error: "Files must be an array" };
  if (value.length === 0) return { error: "Release must include at least one markdown file" };
  if (value.length > MAX_PUBLISH_FILES) {
    return { error: `Release must include at most ${MAX_PUBLISH_FILES} markdown files` };
  }

  const paths = new Set<string>();
  const files: CheckFileInput[] = [];

  for (const item of value) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      return { error: "Each file must be an object" };
    }

    const file = item as Record<string, unknown>;
    const path = normalizeMarkdownPath(file.path);
    if (!path) return { error: "File paths must be relative .md paths" };
    if (paths.has(path)) return { error: `Duplicate file path: ${path}` };
    paths.add(path);

    const contentHash = normalizeHash(file.contentHash);
    if (!contentHash) return { error: `${path} content hash is invalid` };

    files.push({ path, contentHash });
  }

  files.sort((a, b) => a.path.localeCompare(b.path));
  if (!files.some((file) => file.path === "index.md")) {
    return { error: "Release must include index.md" };
  }

  return { value: files };
}

function getBearerToken(request: NextRequest) {
  const header = request.headers.get("authorization");
  const match = header?.match(/^Bearer\s+(.+)$/i);
  const token = match?.[1]?.trim();
  return token && TOKEN_PATTERN.test(token) ? token : null;
}

function normalizeRelease(value: string) {
  const release = value.trim();
  if (
    !release ||
    release.includes("/") ||
    release.includes("\\") ||
    release.includes("\0") ||
    release === "." ||
    release === ".."
  ) {
    return null;
  }

  return release;
}

function normalizeMarkdownPath(value: unknown) {
  if (typeof value !== "string") return null;
  const path = value.trim();
  if (
    !path ||
    path.includes("\\") ||
    path.includes("\0") ||
    path.startsWith("/") ||
    path === "." ||
    path === ".." ||
    path.startsWith("../") ||
    path.split("/").some((part) => part === "." || part === ".." || !part) ||
    !path.endsWith(".md")
  ) {
    return null;
  }

  return path;
}

function normalizeHash(value: unknown) {
  if (typeof value !== "string") return null;
  const hash = value.trim().toLowerCase();
  return /^[a-f0-9]{64}$/.test(hash) ? hash : null;
}

function hashRelease(files: CheckFileInput[]) {
  return hashString(files.map((file) => `${file.path}\0${file.contentHash}`).join("\0"));
}

function hashString(content: string) {
  return createHash("sha256").update(content).digest("hex");
}

function hashToken(token: string, salt: string) {
  return createHash("sha256").update(`${salt}:${token}`).digest("hex");
}

function jsonError(error: string, status: number) {
  return Response.json({ error }, { status });
}
