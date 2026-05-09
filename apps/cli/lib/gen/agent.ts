/*
 * Minimal OpenAI-style agent loop.
 * Drives tool-calling LLMs against Chat Completions endpoints that support
 * the OpenAI tool-calling and structured-output surfaces.
 */

import OpenAI from "openai";
import type {
  ChatCompletionCreateParamsNonStreaming,
  ChatCompletionMessageFunctionToolCall,
  ChatCompletionMessageParam,
  ChatCompletionTool,
} from "openai/resources/chat/completions";
import { getLlmConfig } from "../config";

type ToolInput = Record<string, unknown>;
type ToolParameters = Record<string, unknown>;
const TOOL_STATUS_MESSAGE_PARAM = "statusMessage";

export type Tool = {
  name: string;
  description: string;
  parameters: ToolParameters;
  progressLabel?: string;
  run: (args: ToolInput) => Promise<string>;
};

export type AgentProgressEvent =
  | { type: "agent:start" }
  | { type: "step:start"; step: number }
  | { type: "model:start"; step: number }
  | { type: "tool:call"; name: string; args: ToolInput }
  | { type: "tool:start"; name: string; label: string }
  | { type: "tool:end"; name: string; label: string }
  | { type: "agent:final" }
  | { type: "agent:error"; error: string };

export type AgentOptions = {
  system: string;
  user: string;
  tools: Tool[];
  maxSteps?: number;
  responseFormat?: ChatCompletionCreateParamsNonStreaming["response_format"];
  onProgress?: (event: AgentProgressEvent) => void;
};

async function getClient(): Promise<{ client: OpenAI; model: string }> {
  // env vars override the stored llm.json so CI / one-off runs work without files
  const stored = await getLlmConfig();
  const apiKey = process.env.SLOG_LLM_API_KEY ?? stored?.apiKey;
  const baseURL = process.env.SLOG_LLM_BASE_URL ?? stored?.baseUrl;
  const model = process.env.SLOG_LLM_MODEL ?? stored?.model;

  if (!apiKey || !baseURL || !model) {
    throw new Error(
      "missing llm config: run 'slog gen --configure-llm', or set SLOG_LLM_API_KEY, SLOG_LLM_BASE_URL, and SLOG_LLM_MODEL",
    );
  }

  return { client: new OpenAI({ apiKey, baseURL }), model };
}

function toChatTool(tool: Tool): ChatCompletionTool {
  const parameters = withStatusMessageParameter(tool.parameters);

  return {
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters,
    },
  };
}

function withStatusMessageParameter(parameters: ToolParameters): ToolParameters {
  const properties =
    parameters.properties && typeof parameters.properties === "object" && !Array.isArray(parameters.properties)
      ? (parameters.properties as Record<string, unknown>)
      : {};
  const required = Array.isArray(parameters.required) ? parameters.required : [];

  return {
    ...parameters,
    type: "object",
    properties: {
      ...properties,
      [TOOL_STATUS_MESSAGE_PARAM]: {
        type: "string",
        description:
          "A short present-tense status message for the user while this tool runs, such as 'reading recent commits'.",
      },
    },
    required: required.includes(TOOL_STATUS_MESSAGE_PARAM)
      ? required
      : [...required, TOOL_STATUS_MESSAGE_PARAM],
  };
}

function parseToolArgs(rawArgs: string): ToolInput {
  if (!rawArgs) return {};

  const args = JSON.parse(rawArgs) as unknown;
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    throw new Error("tool arguments must be a JSON object");
  }

  return args as ToolInput;
}

function formatError(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function statusMessageFromArgs(args: ToolInput): string | null {
  const message = args[TOOL_STATUS_MESSAGE_PARAM];
  return typeof message === "string" && message.trim() ? message.trim() : null;
}

function withoutStatusMessage(args: ToolInput): ToolInput {
  const { [TOOL_STATUS_MESSAGE_PARAM]: _statusMessage, ...toolArgs } = args;
  return toolArgs;
}

async function runToolCall(
  call: ChatCompletionMessageFunctionToolCall,
  toolMap: Map<string, Tool>,
  onProgress?: (event: AgentProgressEvent) => void,
): Promise<string> {
  const tool = toolMap.get(call.function.name);
  if (!tool) return `Error: unknown tool ${call.function.name}`;

  let args: ToolInput;
  try {
    args = parseToolArgs(call.function.arguments);
  } catch (err) {
    return `Error: ${formatError(err)}`;
  }

  const label = statusMessageFromArgs(args) ?? tool.progressLabel ?? tool.name;
  onProgress?.({ type: "tool:call", name: tool.name, args: withoutStatusMessage(args) });
  onProgress?.({ type: "tool:start", name: tool.name, label });

  try {
    const result = await tool.run(withoutStatusMessage(args));
    onProgress?.({ type: "tool:end", name: tool.name, label });
    return result;
  } catch (err) {
    onProgress?.({ type: "tool:end", name: tool.name, label });
    return `Error: ${formatError(err)}`;
  }
}

export async function runAgent(opts: AgentOptions): Promise<string> {
  const { client, model } = await getClient();
  const maxSteps = opts.maxSteps ?? 10;

  const toolMap = new Map(opts.tools.map((tool) => [tool.name, tool]));
  const tools = opts.tools.map(toChatTool);

  const messages: ChatCompletionMessageParam[] = [
    { role: "system", content: opts.system },
    { role: "user", content: opts.user },
  ];

  opts.onProgress?.({ type: "agent:start" });

  try {
    for (let step = 0; step < maxSteps; step++) {
      opts.onProgress?.({ type: "step:start", step });
      opts.onProgress?.({ type: "model:start", step });

      const res = await client.chat.completions.create({
        model,
        messages,
        response_format: opts.responseFormat,
        tools: tools.length ? tools : undefined,
      });

      const message = res.choices[0]?.message;
      if (!message) throw new Error("llm returned no message");

      messages.push(message as ChatCompletionMessageParam);

      const calls = message.tool_calls ?? [];
      if (calls.length === 0) {
        opts.onProgress?.({ type: "agent:final" });
        return message.content ?? "";
      }

      for (const call of calls) {
        if (call.type !== "function") continue;

        messages.push({
          role: "tool",
          tool_call_id: call.id,
          content: await runToolCall(call, toolMap, opts.onProgress),
        });
      }
    }

    throw new Error(`agent exceeded max steps (${maxSteps})`);
  } catch (err) {
    opts.onProgress?.({ type: "agent:error", error: formatError(err) });
    throw err;
  }
}
