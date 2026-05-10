import { createHash, randomBytes } from "crypto";

import { and, eq, gt, isNull, or } from "drizzle-orm";
import { NextRequest } from "next/server";

import { project, projectRelease, projectReleaseFile, projectToken } from "@/db/schema";
import { db } from "@/lib/db";
import { revalidatePublicChangelogRelease } from "@/lib/public-changelog-cache";

const TOKEN_PATTERN = /^slog_[a-z0-9]{32}$/;
const MAX_PUBLISH_FILES = 80;
const MAX_PUBLISH_FILE_BYTES = 100 * 1024;
const MAX_PUBLISH_TOTAL_BYTES = 1024 * 1024;
const MAX_DISPLAY_NAME_LENGTH = 60;

type PublishBody = {
  sourceCommit?: unknown;
  contentHash?: unknown;
  files?: unknown;
  manifest?: unknown;
  branding?: unknown;
};

type ValidatedBranding = {
  displayName: string | null;
};

type PublishManifestFileInput = {
  path: string;
  contentHash: string;
  title: string;
};

type PublishFileInput = PublishManifestFileInput & {
  content: string;
};

type ValidatedPublishFile = PublishFileInput & {
  title: string;
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

  let body: PublishBody;
  try {
    body = (await request.json()) as PublishBody;
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  const sourceCommit = normalizeSourceCommit(body.sourceCommit);
  const requestedContentHash = normalizeHash(body.contentHash);
  if (!requestedContentHash) return jsonError("Invalid release content hash", 400);

  const uploadedFiles = validateFiles(body.files, releaseVersion, body.manifest === undefined);
  if ("error" in uploadedFiles) return jsonError(uploadedFiles.error, 400);

  const manifestResult =
    body.manifest === undefined
      ? { value: uploadedFiles.value.map(toManifestFile) }
      : validateManifest(body.manifest);
  if ("error" in manifestResult) return jsonError(manifestResult.error, 400);
  const manifest = manifestResult.value;

  const contentHash = hashRelease(manifest);
  if (contentHash !== requestedContentHash) {
    return jsonError("Release content hash does not match file manifest", 400);
  }

  const indexManifestFile = manifest.find((file) => file.path === "index.md");
  if (!indexManifestFile) return jsonError("Release must include index.md", 400);

  const existing = await readExistingReleaseFiles(id, releaseVersion);
  const mergedFiles = mergePublishFiles(manifest, uploadedFiles.value, existing.files);
  if ("error" in mergedFiles) return jsonError(mergedFiles.error, 400);

  const indexFile = mergedFiles.value.find((file) => file.path === "index.md");
  if (!indexFile) return jsonError("Release must include index.md", 400);

  const brandingResult = validateBranding(body.branding);
  if ("error" in brandingResult) return jsonError(brandingResult.error, 400);
  const branding = brandingResult.value;

  const now = new Date();
  const published = await db.transaction(async (tx) => {
    const [release] = await tx
      .insert(projectRelease)
      .values({
        id: randomId(),
        projectId: id,
        version: releaseVersion,
        title: indexFile.title,
        sourceCommit,
        contentHash,
        publishedAt: now,
      })
      .onConflictDoUpdate({
        target: [projectRelease.projectId, projectRelease.version],
        set: {
          title: indexFile.title,
          sourceCommit,
          contentHash,
          publishedAt: now,
          updatedAt: now,
        },
      })
      .returning({
        id: projectRelease.id,
        version: projectRelease.version,
        title: projectRelease.title,
        publishedAt: projectRelease.publishedAt,
      });

    await tx.delete(projectReleaseFile).where(eq(projectReleaseFile.releaseId, release.id));

    await tx.insert(projectReleaseFile).values(
      mergedFiles.value.map((file) => ({
        id: randomId(),
        releaseId: release.id,
        path: file.path,
        title: file.title,
        contentMarkdown: file.content,
        contentHash: file.contentHash,
      })),
    );

    if (branding) {
      await tx
        .update(project)
        .set({
          displayName: branding.displayName,
          updatedAt: now,
        })
        .where(eq(project.id, id));
    }

    await tx
      .update(projectToken)
      .set({ lastUsedAt: now })
      .where(eq(projectToken.id, candidate.tokenId));

    return release;
  });

  revalidatePublicChangelogRelease(id, releaseVersion);

  return Response.json({
    release: {
      ...published,
      fileCount: mergedFiles.value.length,
      contentHash,
    },
  });
}

function toManifestFile(file: ValidatedPublishFile): PublishManifestFileInput {
  return {
    path: file.path,
    contentHash: file.contentHash,
    title: file.title,
  };
}

async function readExistingReleaseFiles(projectId: string, releaseVersion: string) {
  const [release] = await db
    .select({ id: projectRelease.id, contentHash: projectRelease.contentHash })
    .from(projectRelease)
    .where(and(eq(projectRelease.projectId, projectId), eq(projectRelease.version, releaseVersion)))
    .limit(1);

  if (!release) return { release: null, files: [] };

  const files = await db
    .select({
      path: projectReleaseFile.path,
      title: projectReleaseFile.title,
      content: projectReleaseFile.contentMarkdown,
      contentHash: projectReleaseFile.contentHash,
    })
    .from(projectReleaseFile)
    .where(eq(projectReleaseFile.releaseId, release.id));

  return { release, files };
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

function validateFiles(
  value: unknown,
  releaseVersion: string,
  requireCompleteRelease: boolean,
): { value: ValidatedPublishFile[] } | { error: string } {
  if (!Array.isArray(value)) return { error: "Files must be an array" };
  if (requireCompleteRelease && value.length === 0) {
    return { error: "Release must include at least one markdown file" };
  }
  if (value.length > MAX_PUBLISH_FILES) {
    return { error: `Release must include at most ${MAX_PUBLISH_FILES} markdown files` };
  }

  const paths = new Set<string>();
  let totalBytes = 0;
  const files: ValidatedPublishFile[] = [];

  for (const item of value) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      return { error: "Each file must be an object" };
    }

    const file = item as Record<string, unknown>;
    const path = normalizeMarkdownPath(file.path);
    if (!path) return { error: "File paths must be relative .md paths" };
    if (paths.has(path)) return { error: `Duplicate file path: ${path}` };
    paths.add(path);

    if (typeof file.content !== "string") {
      return { error: `${path} content must be a string` };
    }

    const bytes = Buffer.byteLength(file.content, "utf8");
    if (bytes > MAX_PUBLISH_FILE_BYTES) {
      return { error: `${path} must be at most ${MAX_PUBLISH_FILE_BYTES} bytes` };
    }

    totalBytes += bytes;
    if (totalBytes > MAX_PUBLISH_TOTAL_BYTES) {
      return { error: `Release markdown must be at most ${MAX_PUBLISH_TOTAL_BYTES} bytes total` };
    }

    const contentHash = normalizeHash(file.contentHash);
    if (!contentHash || contentHash !== hashString(file.content)) {
      return { error: `${path} content hash does not match its content` };
    }

    const frontmatter = parseFrontmatter(file.content);
    if (!frontmatter) return { error: `${path} must start with frontmatter` };
    if (!frontmatter.title) return { error: `${path} frontmatter must include title` };
    if (frontmatter.release !== releaseVersion) {
      return { error: `${path} frontmatter release must be ${releaseVersion}` };
    }

    files.push({
      path,
      content: file.content,
      contentHash,
      title: frontmatter.title,
    });
  }

  files.sort((a, b) => a.path.localeCompare(b.path));
  if (requireCompleteRelease && !files.some((file) => file.path === "index.md")) {
    return { error: "Release must include index.md" };
  }

  return { value: files };
}

function validateManifest(
  value: unknown,
): { value: PublishManifestFileInput[] } | { error: string } {
  if (!Array.isArray(value)) return { error: "Manifest must be an array" };
  if (value.length === 0) return { error: "Release must include at least one markdown file" };
  if (value.length > MAX_PUBLISH_FILES) {
    return { error: `Release must include at most ${MAX_PUBLISH_FILES} markdown files` };
  }

  const paths = new Set<string>();
  const files: PublishManifestFileInput[] = [];

  for (const item of value) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      return { error: "Each manifest file must be an object" };
    }

    const file = item as Record<string, unknown>;
    const path = normalizeMarkdownPath(file.path);
    if (!path) return { error: "Manifest file paths must be relative .md paths" };
    if (paths.has(path)) return { error: `Duplicate file path: ${path}` };
    paths.add(path);

    const contentHash = normalizeHash(file.contentHash);
    if (!contentHash) return { error: `${path} content hash is invalid` };

    if (typeof file.title !== "string" || !file.title.trim()) {
      return { error: `${path} title is required` };
    }

    files.push({
      path,
      contentHash,
      title: file.title.trim(),
    });
  }

  files.sort((a, b) => a.path.localeCompare(b.path));
  if (!files.some((file) => file.path === "index.md")) {
    return { error: "Release must include index.md" };
  }

  return { value: files };
}

function mergePublishFiles(
  manifest: PublishManifestFileInput[],
  uploadedFiles: ValidatedPublishFile[],
  existingFiles: ValidatedPublishFile[],
): { value: ValidatedPublishFile[] } | { error: string } {
  const uploadedByPath = new Map(uploadedFiles.map((file) => [file.path, file]));
  const existingByPath = new Map(existingFiles.map((file) => [file.path, file]));
  const manifestPaths = new Set(manifest.map((file) => file.path));
  const merged: ValidatedPublishFile[] = [];

  for (const uploaded of uploadedFiles) {
    if (!manifestPaths.has(uploaded.path)) {
      return { error: `${uploaded.path} is not listed in the manifest` };
    }
  }

  for (const manifestFile of manifest) {
    const uploaded = uploadedByPath.get(manifestFile.path);
    if (uploaded) {
      if (uploaded.contentHash !== manifestFile.contentHash) {
        return { error: `${manifestFile.path} upload does not match manifest hash` };
      }
      merged.push(uploaded);
      continue;
    }

    const existing = existingByPath.get(manifestFile.path);
    if (!existing || existing.contentHash !== manifestFile.contentHash) {
      return { error: `${manifestFile.path} must be uploaded` };
    }

    merged.push(existing);
  }

  return { value: merged };
}

function validateBranding(
  value: unknown,
): { value: ValidatedBranding | null } | { error: string } {
  if (value === undefined || value === null) return { value: null };
  if (typeof value !== "object" || Array.isArray(value)) {
    return { error: "Branding must be an object" };
  }

  const branding = value as Record<string, unknown>;
  let displayName: string | null = null;

  if (branding.displayName !== undefined && branding.displayName !== null) {
    if (typeof branding.displayName !== "string") {
      return { error: "Branding displayName must be a string" };
    }
    const trimmed = branding.displayName.trim();
    if (trimmed.length > MAX_DISPLAY_NAME_LENGTH) {
      return {
        error: `Branding displayName must be at most ${MAX_DISPLAY_NAME_LENGTH} characters`,
      };
    }
    displayName = trimmed.length > 0 ? trimmed : null;
  }

  return { value: { displayName } };
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

function normalizeSourceCommit(value: unknown) {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") return null;

  const commit = value.trim();
  return /^[a-f0-9]{7,40}$/i.test(commit) ? commit : null;
}

function normalizeHash(value: unknown) {
  if (typeof value !== "string") return null;
  const hash = value.trim().toLowerCase();
  return /^[a-f0-9]{64}$/.test(hash) ? hash : null;
}

function parseFrontmatter(content: string): Record<string, string> | null {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  if (lines[0] !== "---") return null;

  const end = lines.findIndex((line, index) => index > 0 && line === "---");
  if (end === -1) return null;

  const frontmatter: Record<string, string> = {};
  for (const line of lines.slice(1, end)) {
    if (!line.trim()) continue;
    const match = line.match(/^([A-Za-z][A-Za-z0-9_-]*):\s*(.*)$/);
    if (!match) return null;

    frontmatter[match[1]] = unquoteYamlString(match[2].trim());
  }

  return frontmatter;
}

function unquoteYamlString(value: string) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}

function hashRelease(files: PublishManifestFileInput[]) {
  return hashString(files.map((file) => `${file.path}\0${file.contentHash}`).join("\0"));
}

function hashString(content: string) {
  return createHash("sha256").update(content).digest("hex");
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
