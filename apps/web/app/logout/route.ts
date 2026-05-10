import { auth } from "@/lib/auth";
import type { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const signOutResponse = await auth.api.signOut({
    headers: request.headers,
    asResponse: true,
  });

  const headers = new Headers(signOutResponse.headers);
  headers.set("Location", "/");

  return new Response(null, {
    headers,
    status: 302,
    statusText: "Found",
  });
}

export async function POST(request: NextRequest) {
  return GET(request);
}
