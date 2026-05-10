import pc from "picocolors";
import type { ChangelogDraft } from "./schema";

const IMPACT_LABELS: Record<ChangelogDraft["changes"][number]["impact"], string> = {
  breaking: "breaking",
  notable: "notable",
  minor: "minor",
};

export function renderChangelogSummary(draft: ChangelogDraft): string {
  if (draft.changes.length === 0) {
    return pc.dim("no changelog-worthy changes were found in this range.");
  }

  const lines: string[] = [pc.bold("changes found:")];

  for (const change of draft.changes) {
    lines.push(`- ${change.title} ${pc.dim(`(${IMPACT_LABELS[change.impact]})`)}`);
  }

  return lines.join("\n");
}
