"use client";

import type { PhaseId } from "../_lib/phases";

export function DoneSummary({
  id,
  siteUrl,
}: {
  id: PhaseId;
  siteUrl: string | null;
}) {
  if (id === "connect") {
    return (
      <span className="text-sm text-muted-foreground/80">
        Connected
      </span>
    );
  }

  if (id === "deploy" && siteUrl) {
    return (
      <a
        href={siteUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex w-fit items-center gap-1.5 font-mono text-sm tracking-tight text-foreground/85 underline-offset-4 hover:underline"
      >
        {siteUrl}
      </a>
    );
  }

  return null;
}
