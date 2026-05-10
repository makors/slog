import { createHash } from "crypto";

import { revalidateTag } from "next/cache";

const PUBLIC_CHANGELOG_TAG_PREFIX = "slog:public-changelog";
const IMMEDIATE_REVALIDATION = { expire: 0 } as const;

export function publicChangelogProjectTag(projectId: string) {
  return `${PUBLIC_CHANGELOG_TAG_PREFIX}:project:${projectId}`;
}

export function publicChangelogReleaseTag(projectId: string, releaseVersion: string) {
  return `${PUBLIC_CHANGELOG_TAG_PREFIX}:release:${projectId}:${hashTagPart(releaseVersion)}`;
}

export function revalidatePublicChangelogProject(projectId: string) {
  revalidateTag(publicChangelogProjectTag(projectId), IMMEDIATE_REVALIDATION);
}

export function revalidatePublicChangelogRelease(
  projectId: string,
  releaseVersion: string,
) {
  revalidatePublicChangelogProject(projectId);
  revalidateTag(
    publicChangelogReleaseTag(projectId, releaseVersion),
    IMMEDIATE_REVALIDATION,
  );
}

function hashTagPart(value: string) {
  return createHash("sha256").update(value).digest("hex").slice(0, 32);
}
