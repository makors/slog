import { notFound } from "next/navigation"

import { isProjectSlug } from "@/lib/project-slug"
import { getCachedPublicLlmsIndexes } from "@/lib/public-changelog"
import { rewriteMarkdownLinksToRawFiles } from "@/lib/public-markdown-text"
import { getPublicUrl } from "@/lib/public-url"

export const dynamic = "force-static"
export const revalidate = false

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ projectslug: string }> }
) {
  const { projectslug } = await params
  if (!isProjectSlug(projectslug)) notFound()

  const releases = await getCachedPublicLlmsIndexes(projectslug)
  if (!releases) notFound()

  const publicUrl = getPublicUrl()
  const body = releases
    .map((release) =>
      rewriteMarkdownLinksToRawFiles(release.markdown, {
        projectSlug: projectslug,
        publicUrl,
        releaseVersion: release.version,
      })
    )
    .join("\n\n---\n\n")

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
    },
  })
}
