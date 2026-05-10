import { auth } from "@/lib/auth";
import type { NextRequest } from "next/server";

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

  const headers = new Headers(response.headers);
  headers.set("Location", url);

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
