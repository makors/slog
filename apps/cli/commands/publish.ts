import pc from "picocolors";
import { success } from "../lib/cli";
import { getToken, requireConfig } from "../lib/config";
import { getGitRoot } from "../lib/git";
import {
  publishRelease,
  syncPublishedReleases,
  type PublishReleaseResult,
  type PublishSyncResult,
} from "../lib/publish/api";
import { normalizeBranding } from "../lib/publish/branding";
import { readReleaseNames } from "../lib/publish/files";
import { formatCount } from "../lib/publish/format";

export type PublishOptions = {
  release?: string;
};

function note(message: string) {
  console.log(pc.dim(`  ${message}`));
}

function formatReleaseList(releases: string[], limit = 6) {
  if (releases.length <= limit) return releases.join(", ");

  const visible = releases.slice(0, limit).join(", ");
  return `${visible}, and ${releases.length - limit} more`;
}

function renderSyncResult(result: PublishSyncResult) {
  console.log();
  success("releases synced");

  if (result.deletedReleaseCount === 0) {
    console.log();
    note(`${formatCount(result.localReleaseCount, "local release")} kept`);
    return;
  }

  const deleted = formatCount(result.deletedReleaseCount, "stale remote release");
  const deletedNames =
    result.deletedReleases.length > 0 ? `: ${result.deletedReleases.join(", ")}` : "";
  console.log();
  note(`${formatCount(result.localReleaseCount, "local release")} kept`);
  note(`removed ${deleted}${deletedNames}`);
}

function renderReleaseSummary(results: PublishReleaseResult[]) {
  console.log();
  success("releases checked");
  console.log();

  const published = results.filter((result) => !result.upToDate);
  const upToDateCount = results.length - published.length;
  const totalFileCount = results.reduce((total, result) => total + result.fileCount, 0);
  const publishedFileCount = published.reduce((total, result) => total + result.fileCount, 0);
  const uploadedFileCount = published.reduce((total, result) => total + result.uploadedFileCount, 0);

  note(`${formatCount(results.length, "release")} in changelogs`);
  note(`${formatCount(totalFileCount, "markdown file")} checked`);

  if (published.length === 0) {
    note("all releases already up to date");
    return;
  }

  note(`${formatCount(published.length, "release")} published`);
  if (upToDateCount > 0) {
    note(`${formatCount(upToDateCount, "release")} already up to date`);
  }
  note(`uploaded ${uploadedFileCount}/${publishedFileCount} ${publishedFileCount === 1 ? "file" : "files"}`);
  note(`published ${formatReleaseList(published.map((result) => result.release))}`);
}

function getProjectPublicUrl(
  publishResults: PublishReleaseResult[],
  syncResult?: PublishSyncResult,
  fallbackUrl?: string,
) {
  return (
    syncResult?.publicUrl ??
    publishResults.find((result) => result.publicUrl)?.publicUrl ??
    fallbackUrl ??
    null
  );
}

function getConfiguredPublicUrl(baseUrl: string, projectId: string) {
  const url = new URL(`/p/${encodeURIComponent(projectId)}`, baseUrl);
  return url.toString();
}

function renderLiveUrl(url: string | null) {
  if (!url) return;

  console.log();
  note(`live at ${pc.cyan(url)}`);
}

export async function publish(options: PublishOptions = {}) {
  const gitRoot = await getGitRoot();
  if (!gitRoot) throw new Error("not a git repository, aborting");

  const config = await requireConfig(gitRoot);

  if (config.local) {
    console.log();
    console.log(`${pc.bold("Local project")} ${pc.dim(config.projectId)}`);
    note("publishing is disabled for this repo");
    console.log();
    return;
  }

  const token = await getToken(config.projectId);
  if (!token) throw new Error("missing token\n\nset SLOG_TOKEN or run: slog init");

  const releases = options.release ? [options.release] : await readReleaseNames(gitRoot);
  const branding = normalizeBranding(config.branding);

  console.log();
  console.log(`${pc.bold("Publishing")} ${config.projectId} ${pc.dim(`to ${config.baseUrl}`)}`);

  const publishResults: PublishReleaseResult[] = [];

  for (const release of releases) {
    const result = await publishRelease({
      baseUrl: config.baseUrl,
      branding,
      gitRoot,
      projectId: config.projectId,
      release,
      token,
    });
    publishResults.push(result);
  }
  renderReleaseSummary(publishResults);

  let syncResult: PublishSyncResult | undefined;

  if (!options.release) {
    syncResult = await syncPublishedReleases({
      baseUrl: config.baseUrl,
      branding,
      projectId: config.projectId,
      releases,
      token,
    });
    renderSyncResult(syncResult);
  }

  const publicUrl = getProjectPublicUrl(
    publishResults,
    syncResult,
    getConfiguredPublicUrl(config.baseUrl, config.projectId),
  );
  renderLiveUrl(publicUrl);

  console.log();

  return { publicUrl };
}
