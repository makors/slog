import { createHash } from "crypto"

const MAX_PUBLISH_FILES = 80
const MAX_PUBLISH_FILE_BYTES = 100 * 1024
const MAX_PUBLISH_TOTAL_BYTES = 1024 * 1024
const MAX_DISPLAY_NAME_LENGTH = 60

export type PublishBody = {
  sourceCommit?: unknown
  contentHash?: unknown
  files?: unknown
  manifest?: unknown
  branding?: unknown
}

export type ValidatedBranding = {
  displayName: string | null
}

export type PublishManifestFileInput = {
  path: string
  contentHash: string
  title: string
}

export type PublishFileInput = PublishManifestFileInput & {
  content: string
}

export type ValidatedPublishFile = PublishFileInput & {
  title: string
}

type ValidationResult<T> = { value: T } | { error: string }

export function validateFiles(
  value: unknown,
  releaseVersion: string,
  requireCompleteRelease: boolean
): ValidationResult<ValidatedPublishFile[]> {
  if (!Array.isArray(value)) return { error: "Files must be an array" }
  if (requireCompleteRelease && value.length === 0) {
    return { error: "Release must include at least one markdown file" }
  }
  if (value.length > MAX_PUBLISH_FILES) {
    return {
      error: `Release must include at most ${MAX_PUBLISH_FILES} markdown files`,
    }
  }

  const paths = new Set<string>()
  let totalBytes = 0
  const files: ValidatedPublishFile[] = []

  for (const item of value) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      return { error: "Each file must be an object" }
    }

    const file = item as Record<string, unknown>
    const path = normalizeMarkdownPath(file.path)
    if (!path) return { error: "File paths must be relative .md paths" }
    if (paths.has(path)) return { error: `Duplicate file path: ${path}` }
    paths.add(path)

    if (typeof file.content !== "string") {
      return { error: `${path} content must be a string` }
    }

    const bytes = Buffer.byteLength(file.content, "utf8")
    if (bytes > MAX_PUBLISH_FILE_BYTES) {
      return {
        error: `${path} must be at most ${MAX_PUBLISH_FILE_BYTES} bytes`,
      }
    }

    totalBytes += bytes
    if (totalBytes > MAX_PUBLISH_TOTAL_BYTES) {
      return {
        error: `Release markdown must be at most ${MAX_PUBLISH_TOTAL_BYTES} bytes total`,
      }
    }

    const contentHash = normalizeHash(file.contentHash)
    if (!contentHash || contentHash !== hashString(file.content)) {
      return { error: `${path} content hash does not match its content` }
    }

    const frontmatter = parseFrontmatter(file.content)
    if (!frontmatter) return { error: `${path} must start with frontmatter` }
    if (frontmatter.release !== releaseVersion) {
      return { error: `${path} frontmatter release must be ${releaseVersion}` }
    }
    const title = titleForMarkdownPath(path, frontmatter.title, releaseVersion)
    if (!title) return { error: `${path} frontmatter must include title` }

    files.push({
      path,
      content: file.content,
      contentHash,
      title,
    })
  }

  files.sort((a, b) => a.path.localeCompare(b.path))
  if (
    requireCompleteRelease &&
    !files.some((file) => file.path === "index.md")
  ) {
    return { error: "Release must include index.md" }
  }

  return { value: files }
}

export function validateManifest(
  value: unknown,
  releaseVersion: string
): ValidationResult<PublishManifestFileInput[]> {
  if (!Array.isArray(value)) return { error: "Manifest must be an array" }
  if (value.length === 0)
    return { error: "Release must include at least one markdown file" }
  if (value.length > MAX_PUBLISH_FILES) {
    return {
      error: `Release must include at most ${MAX_PUBLISH_FILES} markdown files`,
    }
  }

  const paths = new Set<string>()
  const files: PublishManifestFileInput[] = []

  for (const item of value) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      return { error: "Each manifest file must be an object" }
    }

    const file = item as Record<string, unknown>
    const path = normalizeMarkdownPath(file.path)
    if (!path)
      return { error: "Manifest file paths must be relative .md paths" }
    if (paths.has(path)) return { error: `Duplicate file path: ${path}` }
    paths.add(path)

    const contentHash = normalizeHash(file.contentHash)
    if (!contentHash) return { error: `${path} content hash is invalid` }

    const title = titleForMarkdownPath(path, file.title, releaseVersion)
    if (!title) {
      return { error: `${path} title is required` }
    }

    files.push({
      path,
      contentHash,
      title,
    })
  }

  files.sort((a, b) => a.path.localeCompare(b.path))
  if (!files.some((file) => file.path === "index.md")) {
    return { error: "Release must include index.md" }
  }

  return { value: files }
}

export function mergePublishFiles(
  manifest: PublishManifestFileInput[],
  uploadedFiles: ValidatedPublishFile[],
  existingFiles: ValidatedPublishFile[],
  releaseVersion: string
): ValidationResult<ValidatedPublishFile[]> {
  const uploadedByPath = new Map(uploadedFiles.map((file) => [file.path, file]))
  const existingByPath = new Map(existingFiles.map((file) => [file.path, file]))
  const manifestPaths = new Set(manifest.map((file) => file.path))
  const merged: ValidatedPublishFile[] = []

  for (const uploaded of uploadedFiles) {
    if (!manifestPaths.has(uploaded.path)) {
      return { error: `${uploaded.path} is not listed in the manifest` }
    }
  }

  for (const manifestFile of manifest) {
    const uploaded = uploadedByPath.get(manifestFile.path)
    if (uploaded) {
      if (uploaded.contentHash !== manifestFile.contentHash) {
        return {
          error: `${manifestFile.path} upload does not match manifest hash`,
        }
      }
      merged.push(normalizePublishFileTitle(uploaded, releaseVersion))
      continue
    }

    const existing = existingByPath.get(manifestFile.path)
    if (!existing || existing.contentHash !== manifestFile.contentHash) {
      return { error: `${manifestFile.path} must be uploaded` }
    }

    merged.push(normalizePublishFileTitle(existing, releaseVersion))
  }

  return { value: merged }
}

export function validateBranding(
  value: unknown
): ValidationResult<ValidatedBranding | null> {
  if (value === undefined || value === null) return { value: null }
  if (typeof value !== "object" || Array.isArray(value)) {
    return { error: "Branding must be an object" }
  }

  const branding = value as Record<string, unknown>
  let displayName: string | null = null

  if (branding.displayName !== undefined && branding.displayName !== null) {
    if (typeof branding.displayName !== "string") {
      return { error: "Branding displayName must be a string" }
    }
    const trimmed = branding.displayName.trim()
    if (trimmed.length > MAX_DISPLAY_NAME_LENGTH) {
      return {
        error: `Branding displayName must be at most ${MAX_DISPLAY_NAME_LENGTH} characters`,
      }
    }
    displayName = trimmed.length > 0 ? trimmed : null
  }

  return { value: { displayName } }
}

export function toManifestFile(
  file: ValidatedPublishFile
): PublishManifestFileInput {
  return {
    path: file.path,
    contentHash: file.contentHash,
    title: file.title,
  }
}

export function normalizeRelease(value: unknown) {
  if (typeof value !== "string") return null

  const release = value.trim()
  if (
    !release ||
    release.includes("/") ||
    release.includes("\\") ||
    release.includes("\0") ||
    release === "." ||
    release === ".."
  ) {
    return null
  }

  return release
}

export function normalizeMarkdownPath(value: unknown) {
  if (typeof value !== "string") return null
  const path = value.trim()
  if (
    !path ||
    path.includes("\\") ||
    path.includes("\0") ||
    path.startsWith("/") ||
    path === "." ||
    path === ".." ||
    path.startsWith("../") ||
    path.split("/").some((part) => part === "." || part === ".." || !part) ||
    !path.endsWith(".md")
  ) {
    return null
  }

  return path
}

export function normalizeSourceCommit(value: unknown) {
  if (value === null || value === undefined) return null
  if (typeof value !== "string") return null

  const commit = value.trim()
  return /^[a-f0-9]{7,40}$/i.test(commit) ? commit : null
}

export function normalizeHash(value: unknown) {
  if (typeof value !== "string") return null
  const hash = value.trim().toLowerCase()
  return /^[a-f0-9]{64}$/.test(hash) ? hash : null
}

export function parseFrontmatter(
  content: string
): Record<string, string> | null {
  const lines = content.replace(/\r\n/g, "\n").split("\n")
  if (lines[0] !== "---") return null

  const end = lines.findIndex((line, index) => index > 0 && line === "---")
  if (end === -1) return null

  const frontmatter: Record<string, string> = {}
  for (const line of lines.slice(1, end)) {
    if (!line.trim()) continue
    const match = line.match(/^([A-Za-z][A-Za-z0-9_-]*):\s*(.*)$/)
    if (!match) return null

    frontmatter[match[1]] = unquoteYamlString(match[2].trim())
  }

  return frontmatter
}

export function hashRelease(files: PublishManifestFileInput[]) {
  return hashString(
    files.map((file) => `${file.path}\0${file.contentHash}`).join("\0")
  )
}

function titleForMarkdownPath(
  path: string,
  value: unknown,
  releaseVersion: string
) {
  if (path === "index.md") return releaseVersion
  return typeof value === "string" && value.trim() ? value.trim() : null
}

function normalizePublishFileTitle(
  file: ValidatedPublishFile,
  releaseVersion: string
) {
  if (file.path !== "index.md") return file
  return { ...file, title: releaseVersion }
}

function unquoteYamlString(value: string) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1)
  }

  return value
}

function hashString(content: string) {
  return createHash("sha256").update(content).digest("hex")
}
