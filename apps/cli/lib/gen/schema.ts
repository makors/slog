import { z } from "zod";
import { zodResponseFormat } from "openai/helpers/zod";

export const changelogDraftSchema = z.object({
  summary: z.string().min(1),
  changes: z
    .array(
      z.object({
        impact: z.enum(["breaking", "notable", "minor"]),
        title: z.string().min(1),
        summary: z.string().min(1),
        detailPage: z.string().nullable(),
      }),
    )
    .max(15),
});

export type ChangelogDraft = z.infer<typeof changelogDraftSchema>;

export const changelogDraftResponseFormat = zodResponseFormat(changelogDraftSchema, "changelog_draft");

export function parseChangelogDraft(content: string): ChangelogDraft {
  try {
    return changelogDraftSchema.parse(JSON.parse(content));
  } catch (err) {
    if (err instanceof z.ZodError) {
      throw new Error(`model returned invalid changelog draft JSON: ${z.prettifyError(err)}`);
    }

    throw new Error("model returned invalid JSON");
  }
}
