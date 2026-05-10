"use client";

import { useEffect } from "react";

import { WaitingDots } from "./waiting-dots";

export const STUB_DEPLOY_MS = 2000;

export function DeployPhase({
  projectId,
  siteUrl,
  onDeployed,
}: {
  projectId: string | null;
  siteUrl: string | null;
  onDeployed: (url: string) => void;
}) {
  // TODO(deploy-api): Replace this stub with a real deploy kickoff +
  // status stream (SSE or polling) keyed off `projectId`.
  useEffect(() => {
    if (siteUrl) return;
    const slug =
      (projectId ?? "preview").replace(/[^a-z0-9]/gi, "").slice(0, 8) ||
      "preview";
    const t = setTimeout(() => {
      onDeployed(`${slug.toLowerCase()}.slog.sh`);
    }, STUB_DEPLOY_MS);
    return () => clearTimeout(t);
  }, [projectId, siteUrl, onDeployed]);

  if (siteUrl) {
    return (
      <div className="flex flex-col gap-1.5">

        <p className="text-[13px] leading-relaxed text-muted-foreground">
          As you ship, run{" "}
          <code className="rounded bg-muted px-1 py-0.5 font-mono text-[12px] text-foreground/80">
            slog gen
          </code>{" "}
          to incrementally generate changelogs with AI (bring-your-own-key).
        </p>
        <p className="text-[13px] leading-relaxed text-muted-foreground">
          When you're ready to publish, run{" "}
          <code className="rounded bg-muted px-1 py-0.5 font-mono text-[12px] text-foreground/80">
            slog publish
          </code>{" "}.
        </p>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2.5">
      <WaitingDots />
      <span className="text-[12px] text-muted-foreground">
        Publishing your site…
      </span>
    </div>
  );
}
