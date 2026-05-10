const DEFAULT_DESCRIPTION =
  "Developer-focused changelogs for teams that want to ship clear release notes from real git history."

export function projectDisplayName(project: {
  name: string
  displayName: string | null
}) {
  return project.displayName?.trim() || project.name
}

export function changelogDescription(markdown: string, fallback: string) {
  const text = markdownToPlainText(markdown)
  if (!text) return truncateDescription(fallback)

  return truncateDescription(text)
}

export function releaseDetailPath({
  projectSlug,
  releaseVersion,
  detailPage,
}: {
  projectSlug: string
  releaseVersion: string
  detailPage: string[]
}) {
  return `/p/${projectSlug}/${encodeURIComponent(releaseVersion)}/${detailPage
    .map(encodeURIComponent)
    .join("/")}`
}

function markdownToPlainText(markdown: string) {
  return stripFrontmatter(markdown)
    .replace(/\r\n/g, "\n")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/^\s{0,3}#{1,6}\s+.*$/gm, " ")
    .replace(/^\s{0,3}>\s?/gm, "")
    .replace(/^\s{0,3}[-*+]\s+/gm, "")
    .replace(/^\s{0,3}\d+\.\s+/gm, "")
    .replace(/[*_~#|]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function stripFrontmatter(content: string) {
  const normalized = content.replace(/\r\n/g, "\n")
  if (!normalized.startsWith("---\n")) return content

  const end = normalized.indexOf("\n---", 4)
  if (end === -1) return content

  const afterFence = normalized.slice(end + 4)
  return afterFence.startsWith("\n") ? afterFence.slice(1) : afterFence
}

function truncateDescription(value: string) {
  const normalized = value.replace(/\s+/g, " ").trim() || DEFAULT_DESCRIPTION
  if (normalized.length <= 155) return normalized

  const trimmed = normalized.slice(0, 156)
  const lastSpace = trimmed.lastIndexOf(" ")
  const summary =
    lastSpace > 80 ? trimmed.slice(0, lastSpace) : trimmed.slice(0, 155)

  return `${summary.replace(/[.,;:!?-]+$/g, "")}...`
}
