"use client";

import { useEffect } from "react";

import { projectPublicUrl } from "@/lib/public-url";

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
  useEffect(() => {
    if (siteUrl) return;
    const t = setTimeout(() => {
      onDeployed(projectPublicUrl(projectId ?? "preview"));
    }, STUB_DEPLOY_MS);
    return () => clearTimeout(t);
  }, [projectId, siteUrl, onDeployed]);

  // i.e. has the site been deployed?
  if (siteUrl) {
    return (
      <div className="flex flex-col gap-2">

        <p className="text-sm leading-relaxed text-muted-foreground">
          As you ship, run{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground/80">
            slog gen
          </code>{" "}
          to incrementally generate changelogs with AI (bring-your-own-key).
        </p>
        <p className="text-sm leading-relaxed text-muted-foreground">
          When ready to publish, run{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground/80">
            slog publish
          </code>{" "}.
        </p>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <WaitingDots />
      <span className="text-sm text-muted-foreground">
        Publishing your site…
      </span>
    </div>
  );
}
