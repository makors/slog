import { auth } from "@/lib/auth";
import type { NextRequest } from "next/server";

const FORCE_GITHUB_LOGIN_COOKIE = "slog_force_github_login";

export async function GET(request: NextRequest) {
  const signOutResponse = await auth.api.signOut({
    headers: request.headers,
    asResponse: true,
  });

  const headers = new Headers(signOutResponse.headers);
  headers.set("Location", "/");
  headers.append(
    "Set-Cookie",
    `${FORCE_GITHUB_LOGIN_COOKIE}=1; Path=/; Max-Age=300; HttpOnly; SameSite=Lax`,
  );

  return new Response(null, {
    headers,
    status: 302,
    statusText: "Found",
  });
}

export async function POST(request: NextRequest) {
  return GET(request);
}
