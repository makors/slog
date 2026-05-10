export function getPublicUrl() {
  const url =
    process.env.NEXT_PUBLIC_URL?.trim() ||
    process.env.BETTER_AUTH_URL?.trim() ||
    "http://localhost:3000"

  return url.replace(/\/+$/g, "")
}

export function projectPublicUrl(projectSlug: string) {
  return `${getPublicUrl()}/p/${projectSlug}`
}
