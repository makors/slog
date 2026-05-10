#!/usr/bin/env bun

import { parseArgs } from "util";
import pc from "picocolors";
import { gen } from "./commands/gen";
import { init } from "./commands/init";
import { publish } from "./commands/publish";
import { banner } from "./lib/cli";

const CLI_VERSION = "0.0.0";
const HELP_TEXT = `${pc.bold("slog")} v${CLI_VERSION} 🪵

create ship logs that aren't a slog w/ in-repo markdown

${pc.bold("commands:")}
  init       link this repo to slog
  gen        generate a changelog from local git history
  publish    publish local changelogs

${pc.bold("usage:")}
  slog <command> [options]
  slog <command> --help

${pc.bold("install:")}
  bun i -g @makors/slog

${pc.bold("without global install:")}
  bunx @makors/slog <command> [options]

${pc.bold("options:")}
  -h, --help show this help screen
  -v, --version shows the cli version

${pc.dim("full workflow guide: https://github.com/makors/slog#workflow")}
`;

const INIT_HELP_TEXT = `${pc.bold("slog init")} 🪵

link this repo to slog

${pc.bold("usage:")}
  slog init <join-code> [--url <url>]
  slog init --token [project-token] [--url <url>]
  slog init --local [--url <url>]

${pc.bold("arguments:")}
  join-code  one-time code from your slog dashboard

${pc.bold("options:")}
  -h, --help show this help screen
  --url     your slog instance (self-hosters only; defaults to hosted slog)
  --token   set up with an existing project token instead of a join code
  --local   create a local-only project and skip API/token setup
`;

const GEN_HELP_TEXT = `${pc.bold("slog gen")} 🪵

generate a changelog from local git history

${pc.bold("usage:")}
  slog gen [range-or-commit] --release <version> [--configure-llm] [--force] [--instructions <text>]

${pc.bold("arguments:")}
  range-or-commit  git commit range or single commit to analyze

${pc.bold("options:")}
  -h, --help show this help screen
  --release <tag> specifies the changelog release version (ex. v1.0.0)
  --configure-llm interactively configure your llm settings, then exit
  --force allows slog gen to continue for very large ranges (51-100 commits)
  --instructions <text> guides the AI toward important changes or tone

${pc.bold("environment variables:")}
  SLOG_LLM_API_KEY - your llm api key (overrides ~/.config/slog/llm.json)
  SLOG_LLM_MODEL - your llm model (overrides ~/.config/slog/llm.json)
  SLOG_LLM_BASE_URL - your llm base url (overrides ~/.config/slog/llm.json)
`;

const PUBLISH_HELP_TEXT = `${pc.bold("slog publish")} 🪵

publish local changelogs

${pc.bold("usage:")}
  slog publish
  slog publish --release <version>

${pc.bold("options:")}
  -h, --help show this help screen
  --release <tag> only publish one changelog release version (ex. v1.0.0)

${pc.bold("local mode:")}
  projects initialized with slog init --local do not publish anywhere

${pc.bold("environment variables:")}
  SLOG_TOKEN - your project token (overrides ~/.config/slog/{projectId})
`;

const COMMAND_HELP_TEXT: Record<string, string> = {
  init: INIT_HELP_TEXT,
  gen: GEN_HELP_TEXT,
  publish: PUBLISH_HELP_TEXT,
};

function helpTextFor(command: string | undefined) {
  return command ? COMMAND_HELP_TEXT[command] : undefined;
}

function parseCliArgs(args: string[]) {
  if (args[0] === "init") {
    const initArgs = args.slice(1);
    const normalizedArgs: string[] = [];
    let token: string | true | undefined;

    for (let i = 0; i < initArgs.length; i++) {
      const arg = initArgs[i];

      if (arg === "--token") {
        const next = initArgs[i + 1];
        if (next && !next.startsWith("-")) {
          token = next;
          i++;
        } else {
          token = true;
        }
        continue;
      }

      if (arg.startsWith("--token=")) {
        token = arg.slice("--token=".length);
        continue;
      }

      normalizedArgs.push(arg);
    }

    const parsed = parseArgs({
      args: normalizedArgs,
      allowPositionals: true,
      options: {
        help: { type: "boolean", short: "h" },
        local: { type: "boolean" },
        url: { type: "string" },
      },
    });

    return {
      values: { ...parsed.values, token },
      positionals: ["init", ...parsed.positionals],
    };
  }

  if (args[0] === "gen") {
    const parsed = parseArgs({
      args: args.slice(1),
      allowPositionals: true,
      options: {
        help: { type: "boolean", short: "h" },
        release: { type: "string" },
        "configure-llm": { type: "boolean" },
        force: { type: "boolean" },
        instructions: { type: "string" },
      },
    });

    return {
      values: parsed.values,
      positionals: ["gen", ...parsed.positionals],
    };
  }

  if (args[0] === "publish") {
    const parsed = parseArgs({
      args: args.slice(1),
      allowPositionals: true,
      options: {
        help: { type: "boolean", short: "h" },
        release: { type: "string" },
      },
    });

    return {
      values: parsed.values,
      positionals: ["publish", ...parsed.positionals],
    };
  }

  return parseArgs({
    args,
    allowPositionals: true,
    options: {
      help: { type: "boolean", short: "h" },
      version: { type: "boolean", short: "v" },
    },
  });
}

async function main() {
  try {
    const { values: flags, positionals } = parseCliArgs(Bun.argv.slice(2));
    const helpCommand = positionals[0] === "help" ? positionals[1] : undefined;

    if (flags.version) {
      console.log("slog v" + CLI_VERSION);
      process.exit(0);
    }

    if (flags.help || positionals.length === 0 || positionals[0] === "help") {
      console.log(helpTextFor(helpCommand ?? positionals[0]) ?? HELP_TEXT);
      process.exit(0);
    }

    banner(CLI_VERSION);

    const [command, arg] = positionals;

    switch (command) {
      case "init":
        await init(arg, {
          local: flags.local,
          token: flags.token,
          url: flags.url,
        });
        break;
      case "gen":
        await gen(arg, {
          release: flags.release,
          configureLlm: flags["configure-llm"],
          force: flags.force,
          instructions: flags.instructions,
        });
        break;
      case "publish":
        await publish({
          release: flags.release,
        });
        break;
      default:
        throw new Error(`unknown command "${command}", run "slog --help" for usage`);
    }
  } catch (e) {
    console.error(pc.red(`error: ${(e as Error).message}`));
    process.exit(1);
  }
}

// entrypoint for bun
if (import.meta.main) {
  await main();
}
