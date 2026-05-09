/*
 * Utility functions for interacting with git,
 * and a thin wrapper to call git.
*/

export interface GitResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  success: boolean;
}

/*
 * Calls git with the given arguments and returns the result.
 * Used in helpers and for one-off git commands where necessary.
 */
export async function git(args: string[], cwd?: string): Promise<GitResult> {
  const proc = Bun.spawn(["git", ...args], {
    cwd,
    stdout: "pipe",
    stderr: "pipe",
  });

  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);

  return {
    stdout,
    stderr,
    exitCode,
    success: exitCode === 0,
  };
}

/*
 * Returns the root directory of the git repository.
 * Returns null if not a git repository.
 */
export async function getGitRoot(): Promise<string | null> {
  const result = await git(["rev-parse", "--show-toplevel"]);
  return result.success ? (result.stdout.trim() || null) : null;
}

/*
 * Counts commits reachable from a git revision argument.
 * Accepts the same single revision/range value used by `git rev-list --count`.
 */
export async function countGitCommits(revision: string): Promise<number> {
  const result = await git(["rev-list", "--count", revision]);
  if (!result.success) {
    throw new Error(result.stderr.trim() || "failed to count commits");
  }

  const count = Number.parseInt(result.stdout.trim(), 10);
  if (!Number.isFinite(count)) {
    throw new Error("failed to count commits");
  }

  return count;
}

/*
 * Returns true when the working tree has staged,
 * unstaged, or untracked changes.
 */
export async function hasUncommittedChanges(): Promise<boolean> {
  const result = await git(["status", "--porcelain"]);
  if (!result.success) {
    throw new Error(result.stderr.trim() || "failed to read git status");
  }

  return result.stdout.trim().length > 0;
}
