"use server";

import { randomBytes } from "crypto";

import { headers } from "next/headers";

import { projectJoinCode } from "@/db/schema";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// ---------------------------------------------------------------------------
// Code minting — lowercase, confusable-free alphabet (no 0/o/i/l/u/1).
// ---------------------------------------------------------------------------

const ALPHABET = "abcdefghjkmnpqrstvwxyz23456789";
const GROUPS = 3;
const GROUP_SIZE = 3;
const JOIN_CODE_TTL_MS = 15 * 60 * 1000;

function mintJoinCode(): string {
  const total = GROUPS * GROUP_SIZE;
  const bytes = randomBytes(total);
  const chars = Array.from(
    { length: total },
    (_, i) => ALPHABET[bytes[i] % ALPHABET.length],
  );
  return Array.from({ length: GROUPS }, (_, g) =>
    chars.slice(g * GROUP_SIZE, (g + 1) * GROUP_SIZE).join(""),
  ).join("-");
}

// ---------------------------------------------------------------------------
// Server actions
// ---------------------------------------------------------------------------

/**
 * Mint a project join code shown to the user as `slog init <code>`. The CLI
 * exchanges this code against `/api/token` for a project-scoped slog token;
 * that endpoint also creates the project itself, so we never write to the
 * projects table here.
 */
export async function requestJoinCode(): Promise<
  { code: string } | { error: string }
> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { error: "Not authenticated" };

  for (let attempt = 0; attempt < 3; attempt++) {
    const code = mintJoinCode();
    const inserted = await db
      .insert(projectJoinCode)
      .values({
        code,
        ownerUserId: session.user.id,
        expiresAt: new Date(Date.now() + JOIN_CODE_TTL_MS),
      })
      .onConflictDoNothing()
      .returning({ code: projectJoinCode.code });

    if (inserted[0]) return { code: inserted[0].code };
  }

  return { error: "Failed to create join code. Try again." };
}
