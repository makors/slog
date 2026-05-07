import { success } from "../lib/cli";
import { runAgent, type Tool } from "../lib/agent";
import { ensureLlmConfig } from "../lib/llm";

export type GenOptions = {
  release?: string;
  configureLlm?: boolean;
};

const dummyTool: Tool = {
  name: "echo_context",
  description: "Echoes the changelog generation context back to the agent.",
  parameters: {
    type: "object",
    properties: {
      gitRef: {
        type: "string",
        description: "The git ref or range to generate from.",
      },
      release: {
        type: "string",
        description: "The optional release tag.",
      },
    },
    required: [],
    additionalProperties: false,
  },
  async run(args) {
    return JSON.stringify({
      ok: true,
      received: args,
    });
  },
};

export async function gen(gitRef: string | undefined, options: GenOptions = {}) {
  const configureOnly = options.configureLlm ?? false;
  await ensureLlmConfig(configureOnly);

  if (configureOnly) return;
  
  // is the "changelog" range too large? not allowed!

  if (gitRef) {
    success(`ready to generate from ${gitRef}`);
  } else {
    success("ready to generate from recent commits");
  }
  if (options.release) success(`release: ${options.release}`);

  const result = await runAgent({
    system:
      "You are a tiny changelog generation agent. Call echo_context once, then summarize what it returned in one short sentence.",
    user: JSON.stringify({
      gitRef: gitRef ?? "recent commits",
      release: options.release ?? null,
    }),
    tools: [dummyTool],
    maxSteps: 3,
  });

  success(result);
}
