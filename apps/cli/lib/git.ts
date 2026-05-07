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
