import { chmod, mkdir, rm } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

const CONFIG_FILE = ".slog.json";

// it's easy to respect XDG conventions, so may as well do it
// note: this will NOT support windows, sorry to windows users :/, or just use WSL
const CONFIG_HOME = process.env.XDG_CONFIG_HOME ?? join(homedir(), ".config");
const CREDENTIALS_DIR = join(CONFIG_HOME, "slog");
const LLM_CONFIG_PATH = join(CREDENTIALS_DIR, "llm.json");

export const LLM_CONFIG_LOCATION = LLM_CONFIG_PATH;

export type ProjectConfig = {
  projectId: string;
  baseUrl: string;
};

export type LlmConfig = {
  apiKey: string;
  baseUrl: string;
  model: string;
};

function configPath(root?: string) {
  return root ? join(root, CONFIG_FILE) : CONFIG_FILE;
}

function tokenPath(projectId: string) {
  return join(CREDENTIALS_DIR, projectId);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function isLlmConfig(value: unknown): value is LlmConfig {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;

  const config = value as Record<string, unknown>;
  return (
    isNonEmptyString(config.apiKey) &&
    isNonEmptyString(config.baseUrl) &&
    isNonEmptyString(config.model)
  );
}

export async function getConfig(root?: string): Promise<ProjectConfig | null> {
  const file = Bun.file(configPath(root));
  if (!(await file.exists())) return null;

  return await file.json();
}

export async function setConfig(config: ProjectConfig, root?: string) {
  await Bun.write(configPath(root), `${JSON.stringify(config, null, 2)}\n`);
}

export async function getToken(projectId: string): Promise<string | null> {
  /* In the case of a CI environment, SLOG_TOKEN is expected. */
  if (process.env.SLOG_TOKEN) return process.env.SLOG_TOKEN;

  const file = Bun.file(tokenPath(projectId));
  if (!(await file.exists())) return null;

  const token = (await file.text()).trim();
  return token || null;
}

export async function setToken(token: string, projectId: string) {
  await ensureCredentialsDir();
  const path = tokenPath(projectId);
  await Bun.write(path, `${token.trim()}\n`);
  await chmod(path, 0o600);
}

export async function clearToken(projectId: string) {
  await rm(tokenPath(projectId), { force: true });
}

export async function getLlmConfig(): Promise<LlmConfig | null> {
  const file = Bun.file(LLM_CONFIG_PATH);
  if (!(await file.exists())) return null;

  let config: unknown;
  try {
    config = await file.json();
  } catch {
    throw new Error(`invalid llm config at ${LLM_CONFIG_PATH}: run 'slog gen --configure-llm'`);
  }

  if (!isLlmConfig(config)) {
    throw new Error(`incomplete llm config at ${LLM_CONFIG_PATH}: run 'slog gen --configure-llm'`);
  }

  return config;
}

export async function setLlmConfig(config: LlmConfig) {
  await ensureCredentialsDir();
  await Bun.write(LLM_CONFIG_PATH, `${JSON.stringify(config, null, 2)}\n`);
  await chmod(LLM_CONFIG_PATH, 0o600);
}

export async function clearLlmConfig() {
  await rm(LLM_CONFIG_PATH, { force: true });
}

async function ensureCredentialsDir() {
  await mkdir(CREDENTIALS_DIR, { recursive: true });
  await chmod(CREDENTIALS_DIR, 0o700);
}
