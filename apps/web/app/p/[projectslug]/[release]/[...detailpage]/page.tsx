import { notFound } from "next/navigation"

import { MarkdownContent } from "@/lib/markdown-renderer"
import { isProjectSlug } from "@/lib/project-slug"
import { getCachedPublicReleaseDetail } from "@/lib/public-changelog"

import { DetailBackLink } from "./detail-back-link"

export const dynamic = "force-static"
export const revalidate = false

export default async function ReleaseDetailPage({
  params,
}: {
  params: Promise<{
    projectslug: string
    release: string
    detailpage: string[]
  }>
}) {
  const { projectslug, release, detailpage } = await params
  if (
    !isProjectSlug(projectslug) ||
    !isReleaseSegment(release) ||
    detailpage.length === 0 ||
    !detailpage.every(isDetailPageSegment)
  ) {
    notFound()
  }

  const detailPath = detailpage.join("/")
  const row = await getCachedPublicReleaseDetail(
    projectslug,
    release,
    detailPath
  )
  if (!row) notFound()

  const backHref = `/p/${projectslug}#${toAnchorId(row.releaseVersion)}`

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-10 px-6 py-4 md:py-12">
      <DetailBackLink href={backHref} releaseVersion={row.releaseVersion} />

      <div className="flex flex-col gap-4">
        <header>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            {row.fileTitle}
          </h1>
        </header>

        <article className="slog-markdown [&>:first-child]:mt-0">
          <MarkdownContent
            markdown={row.markdown}
            projectSlug={row.projectId}
            releaseVersion={row.releaseVersion}
          />
        </article>
      </div>
    </main>
  )
}

function isReleaseSegment(value: string) {
  return (
    value.length > 0 &&
    !value.includes("/") &&
    !value.includes("\\") &&
    !value.includes("\0") &&
    value !== "." &&
    value !== ".."
  )
}

function isDetailPageSegment(value: string) {
  return (
    value.length > 0 &&
    !value.endsWith(".md") &&
    !value.includes("/") &&
    !value.includes("\\") &&
    !value.includes("\0") &&
    value !== "." &&
    value !== ".."
  )
}

function toAnchorId(version: string) {
  return version
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
}
