import { NextResponse, type NextRequest } from "next/server"

export function proxy(request: NextRequest) {
  const match = request.nextUrl.pathname.match(
    /^\/p\/([^/]+)\/([^/]+)\/(.+\.md)$/
  )

  if (!match) return NextResponse.next()

  const [, projectslug, release, file] = match
  const url = request.nextUrl.clone()
  url.pathname = `/api/public-markdown/${projectslug}/${release}/${file}`

  return NextResponse.rewrite(url)
}

export const config = {
  matcher: "/p/:projectslug/:release/:path*",
}
