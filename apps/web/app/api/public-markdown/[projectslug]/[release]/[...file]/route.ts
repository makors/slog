import { notFound } from "next/navigation"

import { isProjectSlug } from "@/lib/project-slug"
import { getCachedPublicReleaseDetail } from "@/lib/public-changelog"
import { rewriteMarkdownLinksToRawFiles } from "@/lib/public-markdown-text"
import { getPublicUrl } from "@/lib/public-url"

export const dynamic = "force-static"
export const revalidate = false

export async function GET(
  _request: Request,
  {
    params,
  }: {
    params: Promise<{
      projectslug: string
      release: string
      file: string[]
    }>
  }
) {
  const { projectslug, release, file } = await params
  const filePath = normalizeMarkdownFilePath(file)

  if (!isProjectSlug(projectslug) || !isReleaseSegment(release) || !filePath) {
    notFound()
  }

  const row = await getCachedPublicReleaseDetail(projectslug, release, filePath)
  if (!row) notFound()

  return new Response(
    rewriteMarkdownLinksToRawFiles(row.markdown, {
      projectSlug: row.projectId,
      publicUrl: getPublicUrl(),
      releaseVersion: row.releaseVersion,
    }),
    {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
      },
    }
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

function normalizeMarkdownFilePath(value: string[]) {
  if (value.length === 0) return null

  const last = value[value.length - 1]
  if (!last.endsWith(".md")) return null

  const segments = value.slice(0, -1).concat(last.slice(0, -3))
  if (
    !segments.every(
      (segment) =>
        segment.length > 0 &&
        !segment.includes("/") &&
        !segment.includes("\\") &&
        !segment.includes("\0") &&
        segment !== "." &&
        segment !== ".."
    )
  ) {
    return null
  }

  return segments.join("/")
}
