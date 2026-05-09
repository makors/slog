import { join, relative } from "node:path";
import { readdir } from "node:fs/promises";
import { changelogReleaseDir } from "../changelog";
import { git } from "../git";

const DEFAULT_COMMIT_COUNT = 10;
const MAX_CHANGED_FILES = 80;
const MAX_COMMIT_FILES = 30;
const MAX_RELEASE_FOLDER_ENTRIES = 80;

export type GenContextOptions = {
  gitRef?: string;
  release: string;
  gitRoot: string;
};

export type GenContext = {
  release: string;
  releaseFolder: {
    path: string;
    entries: Array<{
      type: "file" | "directory";
      path: string;
    }>;
    entriesTruncated: boolean;
  };
  requestedRange: string;
  commits: Array<{
    shortHash: string;
    hash: string;
    date: string;
    subject: string;
    files: Array<{
      status: string;
      path: string;
    }>;
    filesTruncated: boolean;
  }>;
  changedFiles: Array<{
    status: string;
    path: string;
  }>;
  changedFilesTruncated: boolean;
  diffStat: string | null;
};

function gitRevisionArgs(gitRef: string | undefined) {
  if (!gitRef) {
    return {
      display: `last ${DEFAULT_COMMIT_COUNT} commits`,
      logArgs: [`--max-count=${DEFAULT_COMMIT_COUNT}`],
      statArgs: ["diff", "--stat", `HEAD~${DEFAULT_COMMIT_COUNT}..HEAD`],
      changedFileArgs: ["diff", "--name-status", `HEAD~${DEFAULT_COMMIT_COUNT}..HEAD`],
    };
  }

  if (gitRef.includes("..")) {
    return {
      display: gitRef,
      logArgs: [gitRef],
      statArgs: ["diff", "--stat", gitRef],
      changedFileArgs: ["diff", "--name-status", gitRef],
    };
  }

  return {
    display: gitRef,
    logArgs: ["-1", gitRef],
    statArgs: ["show", "--format=", "--stat", gitRef],
    changedFileArgs: ["show", "--format=", "--name-status", gitRef],
  };
}

async function requireGit(args: string[], label: string): Promise<string> {
  const result = await git(args);
  if (!result.success) {
    throw new Error(result.stderr.trim() || `failed to read ${label}`);
  }

  return result.stdout.trim();
}

function parseNameStatus(stdout: string) {
  const files = stdout
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, MAX_CHANGED_FILES)
    .map((line) => {
      const [status, ...pathParts] = line.split(/\s+/);
      return { status, path: pathParts.join(" ") };
    });

  return {
    files,
    truncated: stdout.split("\n").filter(Boolean).length > MAX_CHANGED_FILES,
  };
}

async function commitFiles(hash: string) {
  const stdout = await requireGit(["show", "--format=", "--name-status", hash], "commit changed files").catch(
    () => "",
  );
  const parsed = parseNameStatus(stdout);

  return {
    files: parsed.files.slice(0, MAX_COMMIT_FILES),
    filesTruncated: parsed.files.length > MAX_COMMIT_FILES || parsed.truncated,
  };
}

async function walkReleaseFolder(
  root: string,
  dir: string,
  entries: GenContext["releaseFolder"]["entries"],
): Promise<void> {
  if (entries.length >= MAX_RELEASE_FOLDER_ENTRIES) return;

  const children = await readdir(dir, { withFileTypes: true }).catch(() => []);
  children.sort((a, b) => a.name.localeCompare(b.name));

  for (const child of children) {
    if (entries.length >= MAX_RELEASE_FOLDER_ENTRIES) return;

    const childPath = join(dir, child.name);
    const path = relative(root, childPath).split("\\").join("/");
    if (!path || path.startsWith("..")) continue;

    if (child.isDirectory()) {
      entries.push({ type: "directory", path });
      await walkReleaseFolder(root, childPath, entries);
      continue;
    }

    if (child.isFile()) {
      entries.push({ type: "file", path });
    }
  }
}

export async function buildReleaseFolderContext(
  gitRoot: string,
  release: string,
): Promise<GenContext["releaseFolder"]> {
  const absolutePath = changelogReleaseDir(gitRoot, release);
  const relativePath = relative(gitRoot, absolutePath).split("\\").join("/");
  const entries: GenContext["releaseFolder"]["entries"] = [];

  await walkReleaseFolder(absolutePath, absolutePath, entries);

  return {
    path: relativePath,
    entries,
    entriesTruncated: entries.length >= MAX_RELEASE_FOLDER_ENTRIES,
  };
}

export async function buildGenContext(options: GenContextOptions): Promise<GenContext> {
  const revision = gitRevisionArgs(options.gitRef);
  const log = await requireGit(
    ["log", "--date=short", "--format=%h%x09%H%x09%ad%x09%s", ...revision.logArgs],
    "commit list",
  );
  const stat = await requireGit(revision.statArgs, "diff stat").catch(() => "");
  const changedFiles = await requireGit(revision.changedFileArgs, "changed files").catch(() => "");
  const parsedFiles = parseNameStatus(changedFiles);

  return {
    release: options.release,
    releaseFolder: await buildReleaseFolderContext(options.gitRoot, options.release),
    requestedRange: revision.display,
    commits: await Promise.all(log
      .split("\n")
      .filter(Boolean)
      .map(async (line) => {
        const [shortHash, hash, date, subject] = line.split("\t");
        const files = await commitFiles(hash);
        return { shortHash, hash, date, subject, ...files };
      })),
    changedFiles: parsedFiles.files,
    changedFilesTruncated: parsedFiles.truncated,
    diffStat: stat || null,
  };
}
