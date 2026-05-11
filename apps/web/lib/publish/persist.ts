import { randomBytes } from "crypto"

import { and, eq } from "drizzle-orm"

import {
  project,
  projectRelease,
  projectReleaseFile,
  projectToken,
} from "@/db/schema"
import { db } from "@/lib/db"
import type {
  ValidatedBranding,
  ValidatedPublishFile,
} from "@/lib/publish/validate"

type PublishReleaseParams = {
  projectId: string
  releaseVersion: string
  sourceCommit: string | null
  contentHash: string
  files: ValidatedPublishFile[]
  branding: ValidatedBranding | null
  tokenId: string
}

type RecordUnchangedPublishParams = {
  projectId: string
  branding: ValidatedBranding | null
  tokenId: string
}

export async function readExistingReleaseFiles(
  projectId: string,
  releaseVersion: string
) {
  const [release] = await db
    .select({ id: projectRelease.id, contentHash: projectRelease.contentHash })
    .from(projectRelease)
    .where(
      and(
        eq(projectRelease.projectId, projectId),
        eq(projectRelease.version, releaseVersion)
      )
    )
    .limit(1)

  if (!release) return { release: null, files: [] }

  const files = await db
    .select({
      path: projectReleaseFile.path,
      title: projectReleaseFile.title,
      content: projectReleaseFile.contentMarkdown,
      contentHash: projectReleaseFile.contentHash,
    })
    .from(projectReleaseFile)
    .where(eq(projectReleaseFile.releaseId, release.id))

  return { release, files }
}

export async function recordUnchangedPublish({
  projectId,
  branding,
  tokenId,
}: RecordUnchangedPublishParams) {
  const now = new Date()

  await db.transaction(async (tx) => {
    if (branding) {
      await tx
        .update(project)
        .set({
          displayName: branding.displayName,
          updatedAt: now,
        })
        .where(eq(project.id, projectId))
    }

    await tx
      .update(projectToken)
      .set({ lastUsedAt: now })
      .where(eq(projectToken.id, tokenId))
  })
}

export async function publishRelease({
  projectId,
  releaseVersion,
  sourceCommit,
  contentHash,
  files,
  branding,
  tokenId,
}: PublishReleaseParams) {
  const now = new Date()

  return db.transaction(async (tx) => {
    const [release] = await tx
      .insert(projectRelease)
      .values({
        id: randomId(),
        projectId,
        version: releaseVersion,
        title: releaseVersion,
        sourceCommit,
        contentHash,
        publishedAt: now,
      })
      .onConflictDoUpdate({
        target: [projectRelease.projectId, projectRelease.version],
        set: {
          title: releaseVersion,
          sourceCommit,
          contentHash,
          publishedAt: now,
          updatedAt: now,
        },
      })
      .returning({
        id: projectRelease.id,
        version: projectRelease.version,
        title: projectRelease.title,
        publishedAt: projectRelease.publishedAt,
      })

    await tx
      .delete(projectReleaseFile)
      .where(eq(projectReleaseFile.releaseId, release.id))

    await tx.insert(projectReleaseFile).values(
      files.map((file) => ({
        id: randomId(),
        releaseId: release.id,
        path: file.path,
        title: file.title,
        contentMarkdown: file.content,
        contentHash: file.contentHash,
      }))
    )

    if (branding) {
      await tx
        .update(project)
        .set({
          displayName: branding.displayName,
          updatedAt: now,
        })
        .where(eq(project.id, projectId))
    }

    await tx
      .update(projectToken)
      .set({ lastUsedAt: now })
      .where(eq(projectToken.id, tokenId))

    return release
  })
}

function randomId() {
  return randomBytes(16).toString("hex")
}
