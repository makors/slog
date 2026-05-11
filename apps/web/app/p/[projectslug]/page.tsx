import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { MarkdownContent } from "@/lib/markdown-renderer"
import { isProjectSlug } from "@/lib/project-slug"
import {
  getCachedPublicChangelog,
  getCachedPublicProject,
} from "@/lib/public-changelog"
import { changelogDescription, projectDisplayName } from "@/lib/seo"
import { cn } from "@/lib/utils"

import { VersionActions } from "./_components/version-actions"

export const dynamic = "force-static"
export const revalidate = false

export async function generateMetadata({
  params,
}: {
  params: Promise<{ projectslug: string }>
}): Promise<Metadata> {
  const { projectslug } = await params
  if (!isProjectSlug(projectslug)) notFound()

  const [project, releases] = await Promise.all([
    getCachedPublicProject(projectslug),
    getCachedPublicChangelog(projectslug),
  ])

  if (!project || !releases) notFound()

  const name = projectDisplayName(project)
  const latestRelease = releases[0]
  const title = `${name} changelog`
  const description = latestRelease
    ? changelogDescription(
        latestRelease.markdown,
        `Release notes and changelog for ${name}.`
      )
    : `Release notes and changelog for ${name}.`
  const url = `/p/${projectslug}`

  return {
    title,
    description,
    alternates: {
      canonical: url,
    },
    openGraph: {
      title,
      description,
      url,
      type: "website",
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
  }
}

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ projectslug: string }>
}) {
  const { projectslug } = await params
  if (!isProjectSlug(projectslug)) notFound()

  const releases = await getCachedPublicChangelog(projectslug)
  if (!releases) notFound()
  const hasReleases = releases.length > 0

  return (
    <main
      className={cn(
        "mx-auto w-full max-w-4xl px-6 py-4 md:py-12",
        !hasReleases &&
          "flex min-h-[calc(100vh-12rem)] items-center justify-center"
      )}
    >
      {hasReleases ? (
        <div className="flex flex-col gap-14 sm:gap-0">
          {releases.map((release, index) => {
            const isFirst = index === 0
            const isLast = index === releases.length - 1
            const anchorId = toAnchorId(release.version)
            return (
              <article
                key={release.id}
                className={cn(
                  "min-w-0 sm:grid sm:grid-cols-[7rem_16px_minmax(0,1fr)] sm:gap-x-8",
                  !isLast && "sm:pb-20"
                )}
              >
                <time className="mb-3 block scroll-mt-24 text-sm text-muted-foreground/80 sm:sticky sm:top-20 sm:mb-0 sm:self-start sm:pt-[3px] sm:text-right">
                  {formatPublishedAt(release.publishedAt)}
                </time>

                <div className="relative hidden justify-center sm:flex">
                  {!isFirst ? (
                    <span
                      className="absolute top-0 left-1/2 h-2.5 w-px -translate-x-1/2 bg-border"
                      aria-hidden
                    />
                  ) : null}
                  <span
                    className="relative z-10 mt-2 size-2 rounded-full bg-foreground"
                    aria-hidden
                  />
                  <span
                    className={cn(
                      "absolute top-[18px] bottom-0 left-1/2 w-px -translate-x-1/2",
                      isLast
                        ? "bg-gradient-to-b from-border to-transparent"
                        : "bg-border"
                    )}
                    aria-hidden
                  />
                </div>

                <div
                  id={anchorId}
                  className="group/release min-w-0 scroll-mt-24"
                >
                  <h1 className="text-2xl font-medium tracking-tight text-foreground">
                    {release.title}
                  </h1>
                  <VersionActions
                    href={`#${anchorId}`}
                    label={release.version}
                    markdown={release.markdown}
                  />
                  <div className="slog-markdown [&>:first-child]:mt-0">
                    <MarkdownContent
                      markdown={stripLeadingTitleHeading(release.markdown)}
                      projectSlug={projectslug}
                      releaseVersion={release.version}
                    />
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      ) : (
        <EmptyState />
      )}
    </main>
  )
}

function EmptyState() {
  const ghostEntries = [
    { dateWidth: "w-14", lines: ["w-24", "w-full", "w-5/6", "w-3/4"] },
    { dateWidth: "w-16", lines: ["w-20", "w-full", "w-11/12"] },
    { dateWidth: "w-12", lines: ["w-28", "w-4/5"] },
  ]

  return (
    <div className="relative w-full">
      <div className="pointer-events-none select-none" aria-hidden>
        <div className="flex flex-col gap-14 opacity-[0.3] blur-[4px] sm:gap-0">
          {ghostEntries.map((entry, index) => {
            const isFirst = index === 0
            const isLast = index === ghostEntries.length - 1
            return (
              <div
                key={index}
                className={cn(
                  "min-w-0 sm:grid sm:grid-cols-[7rem_16px_minmax(0,1fr)] sm:gap-x-8",
                  !isLast && "sm:pb-20"
                )}
              >
                <div className="mb-3 flex justify-end sm:mb-0 sm:pt-[3px]">
                  <span
                    className={cn(
                      "h-3 rounded-full bg-muted-foreground/50",
                      entry.dateWidth
                    )}
                  />
                </div>
                <div className="relative hidden justify-center sm:flex">
                  {!isFirst && (
                    <span className="absolute top-0 left-1/2 h-2.5 w-px -translate-x-1/2 bg-border" />
                  )}
                  <span className="relative z-10 mt-2 size-2 rounded-full bg-foreground/40" />
                  <span
                    className={cn(
                      "absolute top-[18px] bottom-0 left-1/2 w-px -translate-x-1/2",
                      isLast
                        ? "bg-gradient-to-b from-border to-transparent"
                        : "bg-border"
                    )}
                  />
                </div>
                <div className="min-w-0 space-y-3">
                  <div className="h-4 w-16 rounded bg-foreground/20" />
                  <div className="space-y-2">
                    {entry.lines.map((width, i) => (
                      <div
                        key={i}
                        className={cn(
                          "h-3 rounded bg-muted-foreground/25",
                          width
                        )}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 pt-8">
        <div className="flex flex-col items-center gap-1.5 text-center">
          <p className="text-sm font-medium text-foreground">No releases yet</p>
          <p className="max-w-[22rem] text-sm text-muted-foreground">
            Releases will appear here once they&apos;re published.
          </p>
        </div>
      </div>
    </div>
  )
}

function formatPublishedAt(value: string) {
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value))
}

function stripLeadingTitleHeading(markdown: string) {
  const content = stripFrontmatter(markdown).replace(/\r\n/g, "\n")
  const lines = content.split("\n")
  const headingIndex = lines.findIndex((line) => line.trim().length > 0)

  if (headingIndex === -1 || !lines[headingIndex].startsWith("# ")) {
    return content
  }

  return lines
    .slice(0, headingIndex)
    .concat(lines.slice(headingIndex + 1))
    .join("\n")
    .replace(/^\n+/, "")
}

function stripFrontmatter(content: string) {
  const normalized = content.replace(/\r\n/g, "\n")
  if (!normalized.startsWith("---\n")) return content

  const end = normalized.indexOf("\n---", 4)
  if (end === -1) return content

  const afterFence = normalized.slice(end + 4)
  return afterFence.startsWith("\n") ? afterFence.slice(1) : afterFence
}

function toAnchorId(version: string) {
  return version
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
}
