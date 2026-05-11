import { auth } from "@/lib/auth";
import type { NextRequest } from "next/server";

const FORCE_GITHUB_LOGIN_COOKIE = "slog_force_github_login";

export async function GET(request: NextRequest) {
  const callbackURL = getCallbackURL(request);

  if (!callbackURL) {
    return new Response("Invalid callbackURL", { status: 400 });
  }

  const response = await auth.api.signInSocial({
    body: {
      provider: "github",
      callbackURL,
    },
    headers: request.headers,
    asResponse: true,
  });

  const { url, redirect } = (await response.clone().json()) as {
    url?: string;
    redirect?: boolean;
  };

  if (!redirect || !url) {
    return new Response("Failed to start sign-in", { status: 500 });
  }

  const shouldForceGithubLogin = request.cookies.has(FORCE_GITHUB_LOGIN_COOKIE);
  const redirectURL = new URL(url, request.nextUrl.origin);

  if (shouldForceGithubLogin) {
    redirectURL.searchParams.set("prompt", "select_account");
  }

  const headers = new Headers(response.headers);
  headers.set("Location", redirectURL.toString());

  if (shouldForceGithubLogin) {
    headers.append(
      "Set-Cookie",
      `${FORCE_GITHUB_LOGIN_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`,
    );
  }

  return new Response(null, { status: 302, headers });
}

function getCallbackURL(request: NextRequest) {
  const value = request.nextUrl.searchParams.get("callbackURL");

  if (!value) {
    return "/dashboard";
  }

  const url = new URL(value, request.nextUrl.origin);

  if (url.origin !== request.nextUrl.origin) {
    return null;
  }

  return `${url.pathname}${url.search}${url.hash}`;
}
