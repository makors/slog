import { join } from "node:path";
import { mkdir, stat } from "node:fs/promises";

const CHANGELOG_DIR = "changelogs";

export function changelogDir(gitRoot: string): string {
  return join(gitRoot, CHANGELOG_DIR);
}

export async function ensureChangelogDir(gitRoot: string): Promise<{ path: string; created: boolean }> {
  const path = changelogDir(gitRoot);
  const existed = await stat(path)
    .then((file) => file.isDirectory())
    .catch(() => false);

  await mkdir(path, { recursive: true });
  return { path, created: !existed };
}
