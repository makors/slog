import pc from "picocolors";
import { ask, askSecret, info, isInteractive, success, warn } from "../cli";
import {
  getLlmConfig,
  LLM_CONFIG_LOCATION,
  setLlmConfig,
  type LlmConfig,
} from "../config";

const DEFAULT_BASE_URL = "https://api.openai.com/v1";
const DEFAULT_MODEL = "gpt-5.5";

const LLM_SETUP_HINT = `missing llm config

run:
  slog gen --configure-llm

or set the following environment variables:
  SLOG_LLM_API_KEY
  SLOG_LLM_BASE_URL
  SLOG_LLM_MODEL`;

const LLM_ENV_HINT = `cannot configure llm in a non-interactive shell

set the following environment variables:
  SLOG_LLM_API_KEY
  SLOG_LLM_BASE_URL
  SLOG_LLM_MODEL`;

function hasCompleteEnvConfig(): boolean {
  return Boolean(process.env.SLOG_LLM_API_KEY && process.env.SLOG_LLM_BASE_URL && process.env.SLOG_LLM_MODEL);
}

function validateBaseUrl(baseUrl: string): string {
  try {
    return new URL(baseUrl).toString().replace(/\/$/, "");
  } catch {
    throw new Error(`invalid llm base url: ${baseUrl}`);
  }
}

function validateLlmConfig(config: LlmConfig): LlmConfig {
  const apiKey = config.apiKey.trim();
  const baseUrl = validateBaseUrl(config.baseUrl.trim());
  const model = config.model.trim();

  if (!apiKey) throw new Error("api key is required");
  if (!model) throw new Error("model is required");

  return { apiKey, baseUrl, model };
}

/*
 * The "banner" shown when you run `slog gen --configure-llm`,
 * or when you run `slog gen` without an LLM configured.
 */
export async function promptLlmConfig(): Promise<LlmConfig> {
  if (!isInteractive()) throw new Error(LLM_ENV_HINT);

  console.log(`${pc.bold("configure llm for changelog generation")}`);
  console.log(
    pc.dim(`
to use \`slog gen\`, you'll need access to an openai-style chat completions endpoint.
slog is openai-first; openai, fireworks, and ollama are the primary supported targets.
other openai-compatible providers may work if they support tool calls and structured json schema responses.

you will need a base url, an api key, and a model name.
`));

  const baseUrl = await ask("base url:", DEFAULT_BASE_URL);
  const model = await ask("model:", DEFAULT_MODEL);
  const apiKey = await askSecret("api key:");

  return validateLlmConfig({ baseUrl, model, apiKey });
}

/*
 * Configure the LLM for changelog generation,
 * prompting the user interactively.
 */
export async function configureLlm() {
  if (hasCompleteEnvConfig()) {
    info("env vars are set, this will update the stored llm.json for future runs");
  }

  const config = await promptLlmConfig();
  await setLlmConfig(config);
  success(`saved llm config to ${LLM_CONFIG_LOCATION}`);
}

/*
 * Ensure the LLM is properly configured.
 * @param configure - whether the command allows for interactive configuration
*/
export async function ensureLlmConfig(configure = false) {
  if (hasCompleteEnvConfig()) {
    if (configure) warn(`env vars are set, this command will ${pc.bold("overwrite the stored llm.json")},
keep in mind that your env vars will be used over your llm configuration; llm.json is only used when env vars are not set.`);
    else return;
  }

  if (!configure) {
    try {
      if (await getLlmConfig()) return;
    } catch (err) {
      if (!isInteractive()) throw err;
      warn(err instanceof Error ? err.message : String(err));
    }
  }

  if (!isInteractive()) throw new Error(LLM_SETUP_HINT);

  await configureLlm();
}
