type RewriteMarkdownLinksOptions = {
  projectSlug: string
  publicUrl: string
  releaseVersion: string
}

export function rewriteMarkdownLinksToRawFiles(
  markdown: string,
  { projectSlug, publicUrl, releaseVersion }: RewriteMarkdownLinksOptions
) {
  return markdown
    .replace(
      /(!?\[[^\]\n]*(?:\][^\[\]\n]*)*\]\()([^\s)]+)((?:\s+(?:"[^"]*"|'[^']*'|\([^)]*\)))?\))/g,
      (match, prefix: string, href: string, suffix: string) => {
        const rawHref = decodeMarkdownHref(href)
        const rewritten = rewriteMarkdownHref(rawHref, {
          projectSlug,
          publicUrl,
          releaseVersion,
        })

        return rewritten
          ? `${prefix}${encodeMarkdownHref(rewritten)}${suffix}`
          : match
      }
    )
    .replace(
      /^(\s*\[[^\]\n]+\]:\s*)(\S+)/gm,
      (match, prefix: string, href: string) => {
        const rawHref = decodeMarkdownHref(href)
        const rewritten = rewriteMarkdownHref(rawHref, {
          projectSlug,
          publicUrl,
          releaseVersion,
        })

        return rewritten ? `${prefix}${encodeMarkdownHref(rewritten)}` : match
      }
    )
}

function rewriteMarkdownHref(
  href: string,
  { projectSlug, publicUrl, releaseVersion }: RewriteMarkdownLinksOptions
) {
  const pageHref = normalizeMarkdownPageHref(href)
  if (!pageHref) return null

  return `${publicUrl}/p/${projectSlug}/${encodeURIComponent(releaseVersion)}/${encodePathSegments(pageHref.pagePath)}.md${pageHref.hash}`
}

function normalizeMarkdownPageHref(href: string) {
  const trimmed = href.trim()
  if (
    !trimmed ||
    trimmed.includes("?") ||
    trimmed.includes("\\") ||
    trimmed.includes("\0") ||
    trimmed.startsWith("/") ||
    /^[a-z][a-z0-9+.-]*:/i.test(trimmed)
  ) {
    return null
  }

  const hashStart = trimmed.indexOf("#")
  const hash = hashStart === -1 ? "" : trimmed.slice(hashStart)
  const path = (
    hashStart === -1 ? trimmed : trimmed.slice(0, hashStart)
  ).replace(/^(\.\/)+/, "")

  if (!path.endsWith(".md")) return null

  const pagePath = path.slice(0, -3)
  if (!isSafeMarkdownPagePath(pagePath)) return null

  return { pagePath, hash }
}

function isSafeMarkdownPagePath(pagePath: string) {
  return pagePath
    .split("/")
    .every(
      (segment) => segment.length > 0 && segment !== "." && segment !== ".."
    )
}

function encodePathSegments(path: string) {
  return path.split("/").map(encodeURIComponent).join("/")
}

function decodeMarkdownHref(href: string) {
  if (href.startsWith("<") && href.endsWith(">")) {
    return href.slice(1, -1)
  }

  return href
}

function encodeMarkdownHref(href: string) {
  return href.includes(" ") ? `<${href}>` : href
}
