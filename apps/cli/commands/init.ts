import { type ProjectConfig, getConfig, setConfig, setToken } from "../lib/config";
import { ensureChangelogDir } from "../lib/changelog";
import { getGitRoot } from "../lib/git";
import { askSecret, success } from "../lib/cli";
import pc from "picocolors";

const DEFAULT_URL = "http://localhost:3000"; // TODO: prod url
const TOKEN_PATTERN = /^slog_[a-z0-9]{32}$/;

async function readToken(url: string): Promise<string> {
  let token = process.env.SLOG_TOKEN;
  if (!token) {
    try {
      token = await askSecret("project token:");
    } catch (error) {
      if ((error as Error).message === "cannot prompt in a non-interactive shell") {
        throw new Error("cannot prompt for token in a non-interactive shell\n\nset SLOG_TOKEN or run slog init in an interactive terminal");
      }

      throw error;
    }
  }

  if (!TOKEN_PATTERN.test(token)) {
    throw new Error(`missing or invalid token

visit ${url}/new to create a project and get your token
then run: slog init [url]`);
// TODO: implement new token flow
  }

  return token;
}

export async function init(url = DEFAULT_URL) {
  if (TOKEN_PATTERN.test(url)) {
    throw new Error("tokens are prompted interactively now\n\nrun: slog init [url]");
  }

  const token = await readToken(url);

  const gitRoot = await getGitRoot();

  if (!gitRoot) throw new Error("not a git repository, aborting");
  success("git repo detected at " + gitRoot);

  // prevent overwriting a project's config; token can be overwritten
  const currentConfig = await getConfig(gitRoot); // used temporarily
  if (currentConfig != null) throw new Error(
`already linked to a project, delete .slog.json and re-run
(note: there may be a token in ~/.config/slog/${currentConfig.projectId} - it will be overwritten)`
  );

  // TODO: request to nextjs app
  const config: ProjectConfig = { projectId: "local", baseUrl: url };
  await setConfig(config, gitRoot);

  success("wrote config to .slog.json at project root");

  // store token in ~/.config/slog/{projectId}, not in the repo
  await setToken(token, config.projectId);

  success(`stored token in ~/.config/slog/${config.projectId}\n`);

  // create changelogs dir (slog convention)
  const changelog = await ensureChangelogDir(gitRoot);
  success(`${changelog.created ? "created" : "found"} changelog folder at ${changelog.path}`);
  console.log('');
  
  console.log(`run ${pc.cyan("slog --help")} for usage, or learn more at ${pc.cyan("github.com/makors/slog")}.\n`);

  console.log(pc.bold("that's it! - you can return to your browser window and start logging🪵"));
}
