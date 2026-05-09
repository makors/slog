import pc from "picocolors";
import type { ChangelogDraft } from "./schema";

const CATEGORY_LABELS: Record<ChangelogDraft["changes"][number]["category"], string> = {
  breaking: "Breaking",
  feature: "Feature",
  fix: "Fix",
};

function sentenceCase(value: string): string {
  return value ? value[0].toUpperCase() + value.slice(1) : value;
}

export function renderChangelogDraft(draft: ChangelogDraft): string {
  if (draft.changes.length === 0) {
    return pc.dim("No changelog-worthy changes were found in this range.");
  }

  const lines: string[] = [
    pc.dim(`${sentenceCase(draft.confidence)} confidence. ${draft.summary}`),
    "",
  ];

  for (const change of draft.changes) {
    const detail = change.detailPage ? pc.dim(` (${change.detailPage})`) : "";
    lines.push(`${pc.dim(`[${CATEGORY_LABELS[change.category]}]`)} ${pc.bold(change.title)} - ${change.summary}${detail}`);
  }

  return lines.join("\n");
}
