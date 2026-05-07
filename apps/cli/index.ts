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
  slog init <token> [url]
             url: your slog instance (self-hosters only; defaults to hosted slog)
  slog gen [range-or-commit] [--release <version>] [--configure-llm]
  slog publish

${pc.bold("options:")}
  -h, --help show this help screen
  -v, --version shows the cli version
  --release <tag> specifies the release tag (ex. v1.0.0)
  --configure-llm interactively configure your llm settings, then exit

${pc.bold("environment variables:")}
  SLOG_TOKEN - your project token (overrides ~/.config/slog/{projectId})
  SLOG_LLM_API_KEY - your llm api key (overrides ~/.config/slog/llm.json)
  SLOG_LLM_MODEL - your llm model (overrides ~/.config/slog/llm.json)
  SLOG_LLM_BASE_URL - your llm base url (overrides ~/.config/slog/llm.json)

${pc.dim("full workflow guide: https://github.com/makors/slog#workflow")}
`;

const { values: flags, positionals } = parseArgs({
  args: Bun.argv.slice(2),
  allowPositionals: true,
  options: {
    help: { type: "boolean", short: "h" },
    version: { type: "boolean", short: "v" },
    release: { type: "string" },
    "configure-llm": { type: "boolean" },
  },
});

async function main() {
  if (flags.version) {
    console.log("slog v" + CLI_VERSION);
    process.exit(0);
  }

  if (flags.help || positionals.length === 0) {
    console.log(HELP_TEXT);
    process.exit(0);
  }

  banner(CLI_VERSION);

  try {
    const [command, arg, url] = positionals;

    switch (command) {
      case "init":
        await init(arg, url);
        break;
      case "gen":
        await gen(arg, {
          release: flags.release,
          configureLlm: flags["configure-llm"],
        });
        break;
      case "publish":
        await publish();
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
