import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { extname, isAbsolute, join, relative, resolve } from "node:path";

import { changelogReleaseDir } from "../lib/changelog";
import { info, step, success } from "../lib/cli";
import { type ProjectBranding, getToken, requireConfig } from "../lib/config";
import { git, getGitRoot } from "../lib/git";

const MAX_PUBLISH_FILES = 80;
const MAX_PUBLISH_FILE_BYTES = 100 * 1024;
const MAX_PUBLISH_TOTAL_BYTES = 1024 * 1024;

export type PublishOptions = {
  release?: string;
};

type PublishFile = {
  path: string;
  content: string;
  contentHash: string;
  title: string;
};

type PublishResponse = {
  release?: unknown;
  upToDate?: unknown;
  uploadedFileCount?: unknown;
};

export async function publish(options: PublishOptions = {}) {
  const gitRoot = await getGitRoot();
  if (!gitRoot) throw new Error("not a git repository, aborting");

  const config = await requireConfig(gitRoot);

  if (config.local) {
    console.log();
    success("local project");
    info(`project ${config.projectId}`);
    info("publish skipped");
    console.log();
    return;
  }

  const token = await getToken(config.projectId);
  if (!token) throw new Error("missing token\n\nset SLOG_TOKEN or run: slog init");

  const releases = options.release ? [options.release] : await readReleaseNames(gitRoot);
  if (releases.length === 0) {
    throw new Error("no changelog releases found in changelogs");
  }

  const branding = normalizeBranding(config.branding);

  console.log();
  success("project loaded");
  info(`project ${config.projectId}`);
  info(`server ${config.baseUrl}`);

  for (const [index, release] of releases.entries()) {
    console.log();
    step(`release ${release}`);

    await publishRelease({
      baseUrl: config.baseUrl,
      branding,
      gitRoot,
      projectId: config.projectId,
      release,
      token,
    });

    if (index === releases.length - 1) {
      console.log();
    }
  }
}

async function publishRelease(options: {
  baseUrl: string;
  branding: NormalizedBranding | null;
  gitRoot: string;
  projectId: string;
  release: string;
  token: string;
}) {
  const { baseUrl, branding, gitRoot, projectId, release, token } = options;
  const files = await readReleaseMarkdownFiles(gitRoot, release);
  const sourceCommit = await getSourceCommit(gitRoot);
  const contentHash = hashRelease(files);

  info(`found ${formatCount(files.length, "changelog file")} in changelogs/${release}`);
  info(`checking ${formatCount(files.length, "file")} and publishing changes`);

  const response = await fetch(
    new URL(
      `/api/projects/${encodeURIComponent(projectId)}/releases/${encodeURIComponent(release)}/publish`,
      baseUrl,
    ),
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        sourceCommit,
        contentHash,
        files,
        ...(branding ? { branding } : {}),
      }),
    },
  );

  let body: PublishResponse | null;
  try {
    body = (await response.json()) as PublishResponse;
  } catch {
    body = null;
  }

  if (!response.ok) {
    const message =
      body && typeof body === "object" && "error" in body
        ? String((body as { error: unknown }).error)
        : response.statusText;
    throw new Error(`failed to publish ${release}: ${message}`);
  }

  if (body?.upToDate === true) {
    success("already up to date");
    info(`server ${baseUrl}`);
    return;
  }

  const uploadedFileCount =
    typeof body?.uploadedFileCount === "number" ? body.uploadedFileCount : files.length;

  success(`published ${release}`);
  info(`server ${baseUrl}`);
  info(`uploaded ${uploadedFileCount}/${files.length} ${files.length === 1 ? "file" : "files"}`);
}

function formatCount(count: number, singular: string) {
  return `${count} ${singular}${count === 1 ? "" : "s"}`;
}

async function readReleaseNames(gitRoot: string) {
  const changelogDir = join(gitRoot, "changelogs");
  const entries = await readdir(changelogDir, { withFileTypes: true }).catch(() => null);
  if (!entries) return [];

  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));
}

async function readReleaseMarkdownFiles(gitRoot: string, release: string): Promise<PublishFile[]> {
  const releaseDir = changelogReleaseDir(gitRoot, release);
  const files: PublishFile[] = [];
  let totalBytes = 0;

  await walkReleaseDir(releaseDir, releaseDir, files, (bytes) => {
    totalBytes += bytes;
    if (totalBytes > MAX_PUBLISH_TOTAL_BYTES) {
      throw new Error(`release markdown must be at most ${MAX_PUBLISH_TOTAL_BYTES} bytes total`);
    }
  });

  files.sort((a, b) => a.path.localeCompare(b.path));

  if (files.length === 0) {
    throw new Error(`no markdown files found in changelogs/${release}`);
  }

  if (files.length > MAX_PUBLISH_FILES) {
    throw new Error(`release must contain at most ${MAX_PUBLISH_FILES} markdown files`);
  }

  if (!files.some((file) => file.path === "index.md")) {
    throw new Error(`missing changelogs/${release}/index.md`);
  }

  for (const file of files) {
    file.title = validateFrontmatter(file, release);
  }

  return files;
}

async function walkReleaseDir(
  root: string,
  dir: string,
  files: PublishFile[],
  addBytes: (bytes: number) => void,
) {
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => null);
  if (!entries) {
    throw new Error(`release folder not found: ${root}`);
  }

  for (const entry of entries) {
    const absolutePath = join(dir, entry.name);
    const relativePath = relative(root, absolutePath).split("\\").join("/");

    if (!relativePath || relativePath.startsWith("..")) continue;

    if (entry.isDirectory()) {
      await walkReleaseDir(root, absolutePath, files, addBytes);
      continue;
    }

    if (!entry.isFile()) continue;

    if (extname(entry.name).toLowerCase() !== ".md") {
      throw new Error(`cannot publish non-markdown file: ${relativePath}`);
    }

    const safePath = validateMarkdownPath(root, relativePath);
    const content = await readFile(absolutePath, "utf8");
    const bytes = Buffer.byteLength(content, "utf8");
    if (bytes > MAX_PUBLISH_FILE_BYTES) {
      throw new Error(`${safePath} must be at most ${MAX_PUBLISH_FILE_BYTES} bytes`);
    }

    addBytes(bytes);
    files.push({
      path: safePath,
      content,
      contentHash: hashString(content),
      title: "",
    });
  }
}

function validateMarkdownPath(root: string, path: string) {
  if (
    path.includes("\0") ||
    path.includes("\\") ||
    isAbsolute(path) ||
    path === "." ||
    path === ".." ||
    path.startsWith("../") ||
    extname(path).toLowerCase() !== ".md"
  ) {
    throw new Error(`invalid changelog markdown path: ${path}`);
  }

  const base = resolve(root);
  const resolved = resolve(base, path);
  const relativePath = relative(base, resolved).split("\\").join("/");
  if (!relativePath || relativePath.startsWith("..") || isAbsolute(relativePath)) {
    throw new Error(`invalid changelog markdown path: ${path}`);
  }

  return relativePath;
}

function validateFrontmatter(file: PublishFile, release: string) {
  const frontmatter = parseFrontmatter(file.content);
  if (!frontmatter) {
    throw new Error(`${file.path} must start with frontmatter`);
  }

  if (!frontmatter.title) {
    throw new Error(`${file.path} frontmatter must include title`);
  }

  if (frontmatter.release !== release) {
    throw new Error(`${file.path} frontmatter release must be ${release}`);
  }

  return frontmatter.title;
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

async function getSourceCommit(gitRoot: string): Promise<string | null> {
  const result = await git(["rev-parse", "HEAD"], gitRoot);
  if (!result.success) return null;

  return result.stdout.trim() || null;
}

function hashRelease(files: PublishFile[]) {
  return hashString(files.map((file) => `${file.path}\0${file.contentHash}`).join("\0"));
}

function hashString(content: string) {
  return createHash("sha256").update(content).digest("hex");
}

type NormalizedBranding = {
  displayName: string | null;
};

function normalizeBranding(branding: ProjectBranding | undefined): NormalizedBranding | null {
  if (!branding) return null;

  const displayName = typeof branding.displayName === "string" ? branding.displayName.trim() : "";

  if (!displayName) return null;

  return {
    displayName: displayName || null,
  };
}
