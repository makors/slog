import { warn } from "../cli";
import { countGitCommits, hasUncommittedChanges } from "../git";

export type GenPreflightOptions = {
  force?: boolean;
};

const DEFAULT_COMMIT_COUNT = 10;
const SOFT_WARNING_MIN_COMMITS = 30;
const FORCE_REQUIRED_MIN_COMMITS = 51;
const MAX_COMMIT_RANGE = 100;

async function countRequestedCommits(gitRef: string | undefined): Promise<number> {
  if (!gitRef) return DEFAULT_COMMIT_COUNT;
  if (!gitRef.includes("..")) return 1;

  return countGitCommits(gitRef);
}

async function guardCommitRange(gitRef: string | undefined, options: GenPreflightOptions) {
  const count = await countRequestedCommits(gitRef);

  if (count > MAX_COMMIT_RANGE) {
    throw new Error(
      `refusing to generate a changelog from ${count} commits. slog gen supports at most ${MAX_COMMIT_RANGE} commits. good changelogs accumulate over time; please input a smaller commit range.`,
    );
  }

  if (count >= FORCE_REQUIRED_MIN_COMMITS) {
    const message = `very large commit range (${count} commits). good changelogs accumulate over time; for optimal results, input a smaller commit range.\npass --force to continue.`;
    if (!options.force) throw new Error(message);
    warn(`forced generation for ${count} commits.\n`);
    return;
  }

  if (count >= SOFT_WARNING_MIN_COMMITS) {
    warn(`large commit range (${count} commits). this may result in a noisier draft.\n`);
  }
}

async function warnIfUncommittedChanges() {
  if (await hasUncommittedChanges()) {
    warn("you currently have uncommitted changes. slog gen only analyzes committed git history.\n");
  }
}

export async function runGitPreflight(gitRef: string | undefined, options: GenPreflightOptions = {}) {
  await guardCommitRange(gitRef, options);
  await warnIfUncommittedChanges();
}
