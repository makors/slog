/*
 * Minimal OpenAI-compatible agent loop.
 * Drives tool-calling LLMs against any provider exposing a
 * Chat Completions endpoint (OpenAI, Fireworks, Anthropic-via-proxy, etc).
 */

import OpenAI from "openai";
import type {
  ChatCompletionMessageFunctionToolCall,
  ChatCompletionMessageParam,
  ChatCompletionTool,
} from "openai/resources/chat/completions";
import { getLlmConfig } from "./config";

type ToolInput = Record<string, unknown>;
type ToolParameters = Record<string, unknown>;

export type Tool = {
  name: string;
  description: string;
  parameters: ToolParameters;
  run: (args: ToolInput) => Promise<string>;
};

export type AgentOptions = {
  system: string;
  user: string;
  tools: Tool[];
  maxSteps?: number;
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
  return {
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    },
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

async function runToolCall(
  call: ChatCompletionMessageFunctionToolCall,
  toolMap: Map<string, Tool>,
): Promise<string> {
  const tool = toolMap.get(call.function.name);
  if (!tool) return `Error: unknown tool ${call.function.name}`;

  try {
    return await tool.run(parseToolArgs(call.function.arguments));
  } catch (err) {
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

  for (let step = 0; step < maxSteps; step++) {
    const res = await client.chat.completions.create({
      model,
      messages,
      tools: tools.length ? tools : undefined,
    });

    const message = res.choices[0]?.message;
    if (!message) throw new Error("llm returned no message");

    messages.push(message as ChatCompletionMessageParam);

    const calls = message.tool_calls ?? [];
    if (calls.length === 0) {
      return message.content ?? "";
    }

    for (const call of calls) {
      if (call.type !== "function") continue;

      messages.push({
        role: "tool",
        tool_call_id: call.id,
        content: await runToolCall(call, toolMap),
      });
    }
  }

  throw new Error(`agent exceeded max steps (${maxSteps})`);
}
