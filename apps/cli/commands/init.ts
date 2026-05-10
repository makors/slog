import { type ProjectConfig, getConfig, setConfig, setToken } from "../lib/config";
import { ensureChangelogDir } from "../lib/changelog";
import { getGitRoot } from "../lib/git";
import { success } from "../lib/cli";
import { randomUUID } from "node:crypto";
import { basename } from "node:path";
import pc from "picocolors";

const DEFAULT_URL = "http://localhost:3000"; // TODO: prod url
const TOKEN_PATTERN = /^slog_[a-z0-9]{32}$/;
const JOIN_CODE_PATTERN = /^[a-z2-9]{3}-[a-z2-9]{3}-[a-z2-9]{3}$/;

export type InitOptions = {
  local?: boolean;
  url?: string;
};

export async function init(joinCode?: string, options: InitOptions = {}) {
  const baseUrl = normalizeBaseUrl(options.url ?? DEFAULT_URL);
  const gitRoot = await getGitRoot();

  if (!gitRoot) throw new Error("not a git repository, aborting");
  success("git repo detected at " + gitRoot);

  // prevent overwriting a project's config; token can be overwritten
  const currentConfig = await getConfig(gitRoot); // used temporarily
  if (currentConfig != null) {
    const tokenNote = currentConfig.local
      ? "this is a local project; no token was stored"
      : `there may be a token in ~/.config/slog/${currentConfig.projectId}`;
    throw new Error(
`already linked to a project, delete .slog.json and re-run
(note: ${tokenNote})`
    );
  }

  const projectName = basename(gitRoot);
  const exchange = options.local
    ? null
    : await exchangeJoinCode(requireJoinCode(joinCode, baseUrl), {
        baseUrl,
        projectName,
      });

  const config: ProjectConfig = options.local
    ? { projectId: `local-${randomUUID()}`, baseUrl, local: true }
    : { projectId: exchange!.projectId, baseUrl };
  await setConfig(config, gitRoot);

  success("wrote config to .slog.json at project root");

  // store token in ~/.config/slog/{projectId}, not in the repo
  if (exchange) {
    await setToken(exchange.token, config.projectId);
    success(`stored token in ~/.config/slog/${config.projectId}\n`);
  } else {
    success("local mode enabled; skipped token setup and API linking\n");
  }

  // create changelogs dir (slog convention)
  const changelog = await ensureChangelogDir(gitRoot);
  success(`${changelog.created ? "created" : "found"} changelog folder at ${changelog.path}`);
  console.log('');
  
  console.log(`run ${pc.cyan("slog --help")} for usage, or learn more at ${pc.cyan("github.com/makors/slog")}.\n`);

  console.log(pc.bold("that's it! - you can return to your browser window and start logging🪵"));
}

type TokenExchange = {
  projectId: string;
  projectName: string;
  token: string;
};

function requireJoinCode(joinCode: string | undefined, baseUrl: string) {
  const code = joinCode?.trim().toLowerCase();

  if (!code) {
    throw new Error(`missing join code

visit ${baseUrl}/dashboard/new to create a project, then run:
  slog init <join-code> --url ${baseUrl}

to skip API setup for now, run: slog init --local`);
  }

  if (TOKEN_PATTERN.test(code)) {
    throw new Error(`project tokens cannot be passed to init anymore

visit ${baseUrl}/dashboard/new to create a one-time join code, then run:
  slog init <join-code> --url ${baseUrl}`);
  }

  if (!JOIN_CODE_PATTERN.test(code)) {
    throw new Error(`invalid join code "${joinCode}"

expected a code like abc-def-234 from ${baseUrl}/dashboard/new`);
  }

  return code;
}

async function exchangeJoinCode(
  joinCode: string,
  {
    baseUrl,
    projectName,
  }: {
    baseUrl: string;
    projectName: string;
  },
): Promise<TokenExchange> {
  const response = await fetch(new URL("/api/token", baseUrl), {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({ joinCode, projectName }),
  });

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    body = null;
  }

  if (!response.ok) {
    const message =
      body && typeof body === "object" && "error" in body
        ? String((body as { error: unknown }).error)
        : response.statusText;
    throw new Error(`failed to redeem join code: ${message}`);
  }

  if (!isTokenExchange(body)) {
    throw new Error("failed to redeem join code: invalid response from server");
  }

  return body;
}

function isTokenExchange(value: unknown): value is TokenExchange {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const exchange = value as Record<string, unknown>;
  return (
    typeof exchange.projectId === "string" &&
    exchange.projectId.length > 0 &&
    typeof exchange.projectName === "string" &&
    exchange.projectName.length > 0 &&
    typeof exchange.token === "string" &&
    TOKEN_PATTERN.test(exchange.token)
  );
}

function normalizeBaseUrl(url: string) {
  const parsed = new URL(url);
  parsed.pathname = parsed.pathname.replace(/\/+$/, "");
  parsed.search = "";
  parsed.hash = "";
  return parsed.toString().replace(/\/$/, "");
}
