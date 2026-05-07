import { type ProjectConfig, getConfig, setConfig, setToken } from "../lib/config";
import { ensureChangelogDir } from "../lib/changelog";
import { getGitRoot } from "../lib/git";
import { info, success } from "../lib/cli";
import pc from "picocolors";

const DEFAULT_URL = "http://localhost:3000"; // TODO: prod url

export async function init(token: string | undefined, url = DEFAULT_URL) {
  if (!token || !/^slog_[a-z0-9]{32}$/.test(token)) {
    throw new Error(`missing or invalid token

usage: slog init <token> [url]
visit ${url}/new to create a project and get your token`);
  }

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
