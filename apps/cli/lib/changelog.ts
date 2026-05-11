import { join } from "node:path";
import { mkdir, stat, writeFile } from "node:fs/promises";

const CHANGELOG_DIR = "changelogs";
const GITKEEP_FILE = ".gitkeep";

function changelogDir(gitRoot: string): string {
  return join(gitRoot, CHANGELOG_DIR);
}

export function changelogReleaseDir(gitRoot: string, release: string): string {
  assertSafeReleaseName(release);
  return join(changelogDir(gitRoot), release);
}

export async function ensureChangelogDir(gitRoot: string): Promise<{ path: string; created: boolean }> {
  const path = changelogDir(gitRoot);
  const existed = await stat(path)
    .then((file) => file.isDirectory())
    .catch(() => false);

  await mkdir(path, { recursive: true });
  await writeFile(join(path, GITKEEP_FILE), "", { flag: "a" });
  return { path, created: !existed };
}

export async function ensureChangelogReleaseDir(
  gitRoot: string,
  release: string,
): Promise<{ path: string; created: boolean }> {
  const path = changelogReleaseDir(gitRoot, release);
  const existed = await stat(path)
    .then((file) => file.isDirectory())
    .catch(() => false);

  await mkdir(path, { recursive: true });
  return { path, created: !existed };
}

function assertSafeReleaseName(release: string): void {
  if (
    !release.trim() ||
    release !== release.trim() ||
    release.includes("/") ||
    release.includes("\\") ||
    release.includes("\0") ||
    release === "." ||
    release === ".."
  ) {
    throw new Error("release must be a single folder name, such as v1.2.0");
  }
}
