import {
  Fragment,
  createElement,
  type ComponentProps,
  type CSSProperties,
} from "react"
import Link from "next/link"
import { MarkdownAsync, type Components, type ExtraProps } from "react-markdown"
import remarkGfm from "remark-gfm"
import type { Plugin } from "unified"
import {
  bundledLanguages,
  codeToTokens,
  type BundledLanguage,
  type ThemedToken,
  type TokensResult,
} from "shiki"
import { CopyButton } from "./copy-button"
import { cn } from "./utils"

type RenderMarkdownOptions = {
  projectSlug: string
  releaseVersion: string
}

type MarkdownContentProps = RenderMarkdownOptions & {
  markdown: string
}

type CodeProps = ComponentProps<"code"> & ExtraProps
type LinkProps = ComponentProps<"a"> & ExtraProps
type ImageProps = ComponentProps<"img"> & ExtraProps
type BlockquoteProps = ComponentProps<"blockquote"> & ExtraProps
type ShikiStyle = CSSProperties & Record<`--${string}`, string | undefined>

type AlertType = "NOTE" | "TIP" | "IMPORTANT" | "WARNING" | "CAUTION"

const ALERT_BORDER: Record<AlertType, string> = {
  NOTE: "border-blue-500",
  TIP: "border-green-500",
  IMPORTANT: "border-purple-500",
  WARNING: "border-amber-500",
  CAUTION: "border-red-500",
}

// Remark plugin that transforms > [!TYPE] blockquotes into alerts.
// It sets data-alert on the blockquote node and strips the marker line.
const remarkGfmAlerts: Plugin = () => (tree: any) => {
  function visit(node: any) {
    if (node.type === "blockquote") {
      const firstParagraph = node.children?.[0]
      if (firstParagraph?.type === "paragraph") {
        const firstText = firstParagraph.children?.[0]
        if (firstText?.type === "text") {
          const match = firstText.value.match(
            /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\n?/i
          )
          if (match) {
            if (!node.data) node.data = {}
            if (!node.data.hProperties) node.data.hProperties = {}
            node.data.hProperties["data-alert"] = match[1].toUpperCase()

            // Remove the marker text
            firstText.value = firstText.value.slice(match[0].length)

            // Drop the paragraph if it's now empty
            if (
              firstText.value === "" &&
              firstParagraph.children.length === 1
            ) {
              node.children.shift()
            } else if (firstText.value === "") {
              firstParagraph.children.shift()
            }
          }
        }
      }
    }
    if (node.children) {
      for (const child of node.children) visit(child)
    }
  }
  visit(tree)
}

const remarkPlugins = [remarkGfm, remarkGfmAlerts]

export async function MarkdownContent({
  markdown,
  projectSlug,
  releaseVersion,
}: MarkdownContentProps) {
  return MarkdownAsync({
    children: stripFrontmatter(markdown),
    components: createMarkdownComponents({ projectSlug, releaseVersion }),
    remarkPlugins,
  })
}

function createMarkdownComponents(options: RenderMarkdownOptions): Components {
  return {
    a({ children, href, node, ...props }: LinkProps) {
      void node

      const internalHref = href ? rewriteMarkdownHref(href, options) : null
      if (!internalHref) return <>{children}</>

      return (
        <Link {...props} href={internalHref}>
          {children}
        </Link>
      )
    },
    blockquote({ children, node, ...props }: BlockquoteProps) {
      void node

      const alertType = (props as Record<string, unknown>)[
        "data-alert"
      ] as AlertType | undefined

      if (alertType && alertType in ALERT_BORDER) {
        return (
          <div
            className={cn(
              "my-4 border-l-[3px] pl-4 py-0.5 [&>:first-child]:mt-0 [&>:last-child]:mb-0",
              ALERT_BORDER[alertType]
            )}
          >
            {children}
          </div>
        )
      }

      return <blockquote {...props}>{children}</blockquote>
    },
    code: MarkdownCode as Components["code"],
    img({ alt, src, title }: ImageProps) {
      const normalizedSrc =
        typeof src === "string" ? normalizeImageSrc(src) : null
      if (!normalizedSrc) return <>{alt ?? ""}</>

      return createElement("img", {
        alt: alt ?? "",
        src: normalizedSrc,
        title,
      })
    },
    pre({ children }) {
      return <>{children}</>
    },
  }
}

async function MarkdownCode({
  children,
  className,
  node,
  ...props
}: CodeProps) {
  void node

  const code = String(children)
  const language = getLanguageFromClassName(className)
  const isBlock = Boolean(language) || code.endsWith("\n")

  if (!isBlock) {
    return (
      <code {...props} className={className}>
        {children}
      </code>
    )
  }

  return (
    <HighlightedCodeBlock code={code.replace(/\n$/, "")} language={language} />
  )
}

async function HighlightedCodeBlock({
  code,
  language,
}: {
  code: string
  language: string | undefined
}) {
  const highlighted = await highlightCode(code, language)

  return (
    <div className="code-block">
      <div className="code-block-header">
        <span className="code-block-lang">{language ?? "text"}</span>
        <CopyButton code={code} />
      </div>
      <pre
        className="shiki shiki-themes github-light github-dark"
        style={toRootStyle(highlighted)}
        tabIndex={0}
      >
        <code>
          {highlighted.tokens.map((line, lineIndex) => (
            <Fragment key={lineIndex}>
              {line.map((token, tokenIndex) => (
                <span key={tokenIndex} style={toTokenStyle(token)}>
                  {token.content}
                </span>
              ))}
              {lineIndex < highlighted.tokens.length - 1 ? "\n" : null}
            </Fragment>
          ))}
        </code>
      </pre>
    </div>
  )
}

function stripFrontmatter(content: string) {
  const normalized = content.replace(/\r\n/g, "\n")
  if (!normalized.startsWith("---\n")) return content

  const end = normalized.indexOf("\n---", 4)
  if (end === -1) return content

  const afterFence = normalized.slice(end + 4)
  return afterFence.startsWith("\n") ? afterFence.slice(1) : afterFence
}

function rewriteMarkdownHref(
  href: string,
  { projectSlug, releaseVersion }: RenderMarkdownOptions
) {
  const pageHref = normalizeMarkdownPageHref(href)
  if (!pageHref) return null

  if (pageHref.pagePath === "index") {
    return `/p/${projectSlug}${pageHref.hash}`
  }

  return `/p/${projectSlug}/${encodeURIComponent(releaseVersion)}/${encodePathSegments(pageHref.pagePath)}${pageHref.hash}`
}

async function highlightCode(code: string, lang: string | undefined) {
  const language = normalizeLanguage(lang)

  try {
    return await codeToTokens(code, {
      lang: language,
      themes: {
        light: "github-light",
        dark: "github-dark",
      },
    })
  } catch {
    return codeToTokens(code, {
      lang: "text",
      themes: {
        light: "github-light",
        dark: "github-dark",
      },
    })
  }
}

function normalizeLanguage(lang: string | undefined): BundledLanguage | "text" {
  const raw = lang?.trim().split(/\s+/)[0].toLowerCase()
  if (!raw) return "text"

  return raw in bundledLanguages ? (raw as BundledLanguage) : "text"
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

function normalizeImageSrc(href: string) {
  try {
    const url = new URL(href)
    return url.protocol === "http:" || url.protocol === "https:"
      ? url.href
      : null
  } catch {
    return null
  }
}

function getLanguageFromClassName(className: string | undefined) {
  return className?.match(/(?:^|\s)language-([^\s]+)/)?.[1]
}

function toTokenStyle(token: ThemedToken): ShikiStyle | undefined {
  return token.htmlStyle as ShikiStyle | undefined
}

function toRootStyle({ bg, fg }: TokensResult): ShikiStyle {
  const foreground = parseShikiThemeValue(fg, "--shiki-dark")
  const background = parseShikiThemeValue(bg, "--shiki-dark-bg")

  return {
    "--shiki-dark": foreground.dark,
    "--shiki-dark-bg": background.dark,
    backgroundColor: background.light,
    color: foreground.light,
  }
}

function parseShikiThemeValue(
  value: string | undefined,
  darkVariable: "--shiki-dark" | "--shiki-dark-bg"
) {
  if (!value) return { light: undefined, dark: undefined }

  const [light, ...declarations] = value.split(";")
  const dark = declarations
    .map((declaration) => declaration.split(":"))
    .find(([name]) => name === darkVariable)?.[1]

  return { light, dark }
}
