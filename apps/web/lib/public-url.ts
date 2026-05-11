export function getPublicUrl() {
  const url =
    process.env.NEXT_PUBLIC_URL?.trim() ||
    prefixedVercelUrl(process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL) ||
    prefixedVercelUrl(process.env.NEXT_PUBLIC_VERCEL_BRANCH_URL) ||
    prefixedVercelUrl(process.env.NEXT_PUBLIC_VERCEL_URL) ||
    process.env.BETTER_AUTH_URL?.trim() ||
    "http://localhost:3000"

  return url.replace(/\/+$/g, "")
}

export function projectPublicUrl(projectSlug: string) {
  return `${getPublicUrl()}/p/${projectSlug}`
}

function prefixedVercelUrl(url: string | undefined) {
  const trimmed = url?.trim()
  if (!trimmed) return ""

  return /^https?:\/\//.test(trimmed) ? trimmed : `https://${trimmed}`
}
