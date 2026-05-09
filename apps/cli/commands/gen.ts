import { success } from "../lib/cli";
import { ensureChangelogReleaseDir } from "../lib/changelog";
import { requireConfig } from "../lib/config";
import { runAgent, type AgentProgressEvent } from "../lib/gen/agent";
import { buildGenContext } from "../lib/gen/context";
import { ensureLlmConfig } from "../lib/gen/llm";
import { runGitPreflight } from "../lib/gen/preflight";
import {
  buildGitAnalysisUserPrompt,
  buildShipwrightUserPrompt,
  GIT_ANALYSIS_PROMPT,
  SHIPWRIGHT_PROMPT,
} from "../lib/gen/prompt";
import { renderChangelogDraft } from "../lib/gen/render";
import { changelogDraftResponseFormat, parseChangelogDraft, type ChangelogDraft } from "../lib/gen/schema";
import { createAgentStatus } from "../lib/gen/status";
import { createGitAnalysisTools, createShipwrightTools } from "../lib/gen/tools";
import { getGitRoot } from "../lib/git";

export type GenOptions = {
  release?: string;
  configureLlm?: boolean;
  force?: boolean;
  instructions?: string;
};

function createStatusDetailMapper(getPhase: () => "analysis" | "shipwright") {
  let holdingToolDetail = false;

  return function statusDetail(event: AgentProgressEvent): string | null {
    const phase = getPhase();

    switch (event.type) {
      case "agent:start":
        holdingToolDetail = false;
        return phase === "analysis" ? "starting analysis" : "starting writer";
      case "step:start":
        if (holdingToolDetail) return null;
        if (phase === "analysis") {
          return event.step === 0 ? "exploring git history" : "drafting changelog";
        }

        return event.step === 0 ? "writing changelog" : "refining markdown";
      case "model:start":
        if (holdingToolDetail) return null;
        return "asking model";
      case "tool:call":
        return null;
      case "tool:start":
        holdingToolDetail = true;
        return `${event.label}`;
      case "tool:end":
        holdingToolDetail = true;
        return `${event.label}`;
      case "agent:final":
        holdingToolDetail = false;
        return "finishing";
      case "agent:error":
        holdingToolDetail = false;
        return "stopping";
    }
  };
}

export async function gen(gitRef: string | undefined, options: GenOptions = {}) {
  // whether the user wants to configure llm api, url, and model ONLY (explicit cli flag)
  const configureOnly = options.configureLlm ?? false;
  if (configureOnly) {
    await ensureLlmConfig(true);
    return;
  }

  const release = options.release;
  if (!release) {
    throw new Error("missing required --release <release tag> for slog gen");
  }

  // each of the guards below throw an error on fail, returns to index.ts (caller)
  // checks commit range and warns if uncommitted changes are present, expandable
  await runGitPreflight(gitRef, options);
  await ensureLlmConfig(false);
  const gitRoot = await getGitRoot();
  if (!gitRoot) throw new Error("not a git repository, aborting");
  await requireConfig(gitRoot);
  const releaseFolder = await ensureChangelogReleaseDir(gitRoot, release);

  if (gitRef) {
    success(`ready to generate from ${gitRef}`);
  } else {
    success("ready to generate from recent commits");
  }
  success(`release: ${release}\n`);
  success(`${releaseFolder.created ? "created" : "found"} release folder at ${releaseFolder.path}\n`);

  const status = createAgentStatus({ initialDetail: "starting" });
  let phase: "analysis" | "shipwright" = "analysis";
  const statusDetail = createStatusDetailMapper(() => phase);
  status.start();

  let draft: ChangelogDraft;
  let shipwrightResult = "";
  try {
    status.update("exploring git history");
    const context = await buildGenContext({ gitRef, release, gitRoot });

    const gitAnalysisResult = await runAgent({
      system: GIT_ANALYSIS_PROMPT,
      user: buildGitAnalysisUserPrompt(context, { instructions: options.instructions }),
      tools: createGitAnalysisTools(),
      responseFormat: changelogDraftResponseFormat,
      onProgress(event) {
        const detail = statusDetail(event);
        if (detail) status.update(detail);
      },
    });

    draft = parseChangelogDraft(gitAnalysisResult);

    phase = "shipwright";
    status.update("writing changelog");
    shipwrightResult = await runAgent({
      system: SHIPWRIGHT_PROMPT,
      user: buildShipwrightUserPrompt(context, draft, { instructions: options.instructions }),
      tools: createShipwrightTools({ release, releaseDir: releaseFolder.path }),
      maxSteps: 8,
      onProgress(event) {
        const detail = statusDetail(event);
        if (detail) status.update(detail);
      },
    });
  } finally {
    status.stop();
  }

  const changeLabel = draft.changes.length === 1 ? "change" : "changes";
  success(`found ${draft.changes.length} ${changeLabel}`);
  success(`wrote changelog draft to ${releaseFolder.path}\n`);
  console.log(renderChangelogDraft(draft));
  if (shipwrightResult.trim()) {
    console.log(`\n${shipwrightResult.trim()}`);
  }
}
