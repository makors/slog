import { and, eq } from "drizzle-orm";
import { NextRequest } from "next/server";

import { project, projectJoinCode } from "@/db/schema";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { subscribeJoinCode } from "@/lib/join-code-events";

export const dynamic = "force-dynamic";

const HEARTBEAT_MS = 25_000;
const JOIN_CODE_PATTERN = /^[a-z2-9]{3}-[a-z2-9]{3}-[a-z2-9]{3}$/;

type EventParams = {
  params: Promise<{ code: string }>;
};

export async function GET(request: NextRequest, { params }: EventParams) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return new Response("Unauthorized", { status: 401 });

  const { code: rawCode } = await params;
  const code = normalizeJoinCode(rawCode);
  if (!code) return new Response("Invalid join code", { status: 400 });

  const status = await getJoinCodeStatus(code, session.user.id);
  if (status === "missing") return new Response("Not found", { status: 404 });

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      let unsubscribe = () => {};
      let heartbeat: ReturnType<typeof setInterval> | null = null;
      let expiryTimer: ReturnType<typeof setTimeout> | null = null;

      function send(event: string, data: unknown) {
        if (closed) return;
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
        );
      }

      function close() {
        if (closed) return;
        closed = true;
        unsubscribe();
        if (heartbeat) clearInterval(heartbeat);
        if (expiryTimer) clearTimeout(expiryTimer);
        request.signal.removeEventListener("abort", close);
        controller.close();
      }

      request.signal.addEventListener("abort", close);

      if (status.status === "expired") {
        send("expired", {});
        close();
        return;
      }

      if (status.status === "claimed") {
        send("claimed", { project: status.project });
        close();
        return;
      }

      unsubscribe = subscribeJoinCode(code, (event) => {
        send("claimed", event);
        close();
      });

      void getJoinCodeStatus(code, session.user.id).then((freshStatus) => {
        if (closed) return;

        if (freshStatus === "missing" || freshStatus.status === "expired") {
          send("expired", {});
          close();
          return;
        }

        if (freshStatus.status === "claimed") {
          send("claimed", { project: freshStatus.project });
          close();
          return;
        }

        send("pending", {});
      });

      expiryTimer = setTimeout(() => {
        send("expired", {});
        close();
      }, Math.max(0, status.expiresAt.getTime() - Date.now()));

      heartbeat = setInterval(() => {
        if (!closed) controller.enqueue(encoder.encode(": heartbeat\n\n"));
      }, HEARTBEAT_MS);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

async function getJoinCodeStatus(code: string, ownerUserId: string) {
  const [row] = await db
    .select({
      expiresAt: projectJoinCode.expiresAt,
      claimedAt: projectJoinCode.claimedAt,
      projectId: project.id,
      projectName: project.name,
    })
    .from(projectJoinCode)
    .leftJoin(project, eq(projectJoinCode.claimedProjectId, project.id))
    .where(
      and(
        eq(projectJoinCode.code, code),
        eq(projectJoinCode.ownerUserId, ownerUserId),
      ),
    )
    .limit(1);

  if (!row) return "missing" as const;

  if (row.expiresAt.getTime() <= Date.now()) {
    return { status: "expired" as const };
  }

  if (row.claimedAt && row.projectId && row.projectName) {
    return {
      status: "claimed" as const,
      project: { id: row.projectId, name: row.projectName },
    };
  }

  return { status: "pending" as const, expiresAt: row.expiresAt };
}

function normalizeJoinCode(value: string) {
  const code = value.trim().toLowerCase();
  return JOIN_CODE_PATTERN.test(code) ? code : null;
}
