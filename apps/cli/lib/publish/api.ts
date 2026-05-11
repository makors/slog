import { git } from "../git";
import { hashRelease, readReleaseMarkdownFiles } from "./files";
import type { NormalizedBranding } from "./types";

type PublishResponse = {
  upToDate?: unknown;
  uploadedFileCount?: unknown;
  publicUrl?: unknown;
};

type PublishSyncResponse = {
  deletedReleaseCount?: unknown;
  deletedReleases?: unknown;
  publicUrl?: unknown;
};

export type PublishReleaseResult = {
  release: string;
  fileCount: number;
  uploadedFileCount: number;
  upToDate: boolean;
  publicUrl: string | null;
};

export type PublishSyncResult = {
  localReleaseCount: number;
  deletedReleaseCount: number;
  deletedReleases: string[];
  publicUrl: string | null;
};

export async function publishRelease(options: {
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
    return {
      release,
      fileCount: files.length,
      uploadedFileCount: 0,
      upToDate: true,
      publicUrl: getPublicUrl(body),
    };
  }

  const uploadedFileCount =
    typeof body?.uploadedFileCount === "number" ? body.uploadedFileCount : files.length;

  return {
    release,
    fileCount: files.length,
    uploadedFileCount,
    upToDate: false,
    publicUrl: getPublicUrl(body),
  };
}

export async function syncPublishedReleases(options: {
  baseUrl: string;
  branding: NormalizedBranding | null;
  projectId: string;
  releases: string[];
  token: string;
}) {
  const { baseUrl, branding, projectId, releases, token } = options;

  const response = await fetch(
    new URL(`/api/projects/${encodeURIComponent(projectId)}/publish`, baseUrl),
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        releases,
        ...(branding ? { branding } : {}),
      }),
    },
  );

  let body: PublishSyncResponse | null;
  try {
    body = (await response.json()) as PublishSyncResponse;
  } catch {
    body = null;
  }

  if (!response.ok) {
    const message =
      body && typeof body === "object" && "error" in body
        ? String((body as { error: unknown }).error)
        : response.statusText;
    throw new Error(`failed to sync published releases: ${message}`);
  }

  const deletedReleaseCount =
    typeof body?.deletedReleaseCount === "number" ? body.deletedReleaseCount : 0;

  const deletedReleases = Array.isArray(body?.deletedReleases)
    ? body.deletedReleases.filter((release): release is string => typeof release === "string")
    : [];

  return {
    localReleaseCount: releases.length,
    deletedReleaseCount,
    deletedReleases,
    publicUrl: getPublicUrl(body),
  };
}

function getPublicUrl(body: PublishResponse | PublishSyncResponse | null) {
  return typeof body?.publicUrl === "string" && body.publicUrl.length > 0
    ? body.publicUrl
    : null;
}

async function getSourceCommit(gitRoot: string): Promise<string | null> {
  const result = await git(["rev-parse", "HEAD"], gitRoot);
  if (!result.success) return null;

  return result.stdout.trim() || null;
}
