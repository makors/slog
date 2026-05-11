import { and, desc, eq } from "drizzle-orm"
import { unstable_cache } from "next/cache"

import { project, projectRelease, projectReleaseFile } from "@/db/schema"
import { db } from "@/lib/db"
import {
  publicChangelogProjectTag,
  publicChangelogReleaseTag,
} from "@/lib/public-changelog-cache"

const PUBLIC_CHANGELOG_CACHE_KEY = "public-changelog:v1"

export type PublicProject = {
  id: string
  name: string
  displayName: string | null
}

export type PublicChangelogRelease = {
  id: string
  version: string
  title: string
  publishedAt: string
  markdown: string
}

export type PublicReleaseDetail = {
  projectId: string
  releaseVersion: string
  releaseTitle: string
  publishedAt: string
  fileTitle: string
  markdown: string
}

export function getCachedPublicProject(projectSlug: string) {
  return unstable_cache(
    async (): Promise<PublicProject | null> => {
      const [row] = await db
        .select({
          id: project.id,
          name: project.name,
          displayName: project.displayName,
        })
        .from(project)
        .where(eq(project.id, projectSlug))
        .limit(1)

      return row ?? null
    },
    [PUBLIC_CHANGELOG_CACHE_KEY, "project", projectSlug],
    {
      revalidate: false,
      tags: [publicChangelogProjectTag(projectSlug)],
    }
  )()
}

export function getCachedPublicChangelog(projectSlug: string) {
  return unstable_cache(
    async (): Promise<PublicChangelogRelease[] | null> => {
      const [projectRow] = await db
        .select({ id: project.id })
        .from(project)
        .where(eq(project.id, projectSlug))
        .limit(1)

      if (!projectRow) return null

      const releaseFiles = await db
        .select({
          id: projectRelease.id,
          version: projectRelease.version,
          publishedAt: projectRelease.publishedAt,
          contentMarkdown: projectReleaseFile.contentMarkdown,
        })
        .from(projectRelease)
        .innerJoin(
          projectReleaseFile,
          eq(projectReleaseFile.releaseId, projectRelease.id)
        )
        .where(
          and(
            eq(projectRelease.projectId, projectRow.id),
            eq(projectReleaseFile.path, "index.md")
          )
        )
        .orderBy(desc(projectRelease.publishedAt))

      return releaseFiles.map((release) => ({
        id: release.id,
        version: release.version,
        title: release.version,
        publishedAt: release.publishedAt.toISOString(),
        markdown: release.contentMarkdown,
      }))
    },
    [PUBLIC_CHANGELOG_CACHE_KEY, "changelog", projectSlug],
    {
      revalidate: false,
      tags: [publicChangelogProjectTag(projectSlug)],
    }
  )()
}

export function getCachedPublicLlmsIndexes(projectSlug: string) {
  return unstable_cache(
    async (): Promise<PublicChangelogRelease[] | null> => {
      const [projectRow] = await db
        .select({ id: project.id })
        .from(project)
        .where(eq(project.id, projectSlug))
        .limit(1)

      if (!projectRow) return null

      const releaseFiles = await db
        .select({
          id: projectRelease.id,
          version: projectRelease.version,
          publishedAt: projectRelease.publishedAt,
          contentMarkdown: projectReleaseFile.contentMarkdown,
        })
        .from(projectRelease)
        .innerJoin(
          projectReleaseFile,
          eq(projectReleaseFile.releaseId, projectRelease.id)
        )
        .where(
          and(
            eq(projectRelease.projectId, projectRow.id),
            eq(projectReleaseFile.path, "index.md")
          )
        )
        .orderBy(desc(projectRelease.publishedAt))
        .limit(25)

      return releaseFiles.map((release) => ({
        id: release.id,
        version: release.version,
        title: release.version,
        publishedAt: release.publishedAt.toISOString(),
        markdown: release.contentMarkdown,
      }))
    },
    [PUBLIC_CHANGELOG_CACHE_KEY, "llms-indexes", projectSlug],
    {
      revalidate: false,
      tags: [publicChangelogProjectTag(projectSlug)],
    }
  )()
}

export function getCachedPublicReleaseDetail(
  projectSlug: string,
  releaseVersion: string,
  detailPage: string
) {
  return unstable_cache(
    async (): Promise<PublicReleaseDetail | null> => {
      const [row] = await db
        .select({
          projectId: project.id,
          releaseVersion: projectRelease.version,
          publishedAt: projectRelease.publishedAt,
          fileTitle: projectReleaseFile.title,
          contentMarkdown: projectReleaseFile.contentMarkdown,
        })
        .from(project)
        .innerJoin(projectRelease, eq(projectRelease.projectId, project.id))
        .innerJoin(
          projectReleaseFile,
          eq(projectReleaseFile.releaseId, projectRelease.id)
        )
        .where(
          and(
            eq(project.id, projectSlug),
            eq(projectRelease.version, releaseVersion),
            eq(projectReleaseFile.path, `${detailPage}.md`)
          )
        )
        .limit(1)

      if (!row) return null

      return {
        projectId: row.projectId,
        releaseVersion: row.releaseVersion,
        releaseTitle: row.releaseVersion,
        publishedAt: row.publishedAt.toISOString(),
        fileTitle: row.fileTitle,
        markdown: row.contentMarkdown,
      }
    },
    [
      PUBLIC_CHANGELOG_CACHE_KEY,
      "release-detail",
      projectSlug,
      releaseVersion,
      detailPage,
    ],
    {
      revalidate: false,
      tags: [
        publicChangelogProjectTag(projectSlug),
        publicChangelogReleaseTag(projectSlug, releaseVersion),
      ],
    }
  )()
}
