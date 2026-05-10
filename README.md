# slog 🪵

`slog` is the agnostic changelog generator that works where you do, helping generate versioned changelog drafts w/ ai. your repository acts as the source of truth for changelogs, with the (self)hosted web app as an implication to the cli - no lock-in.

slog is NOT intended to generate production-ready changelogs - rather, it provides a good first-draft to perform minimal revision on, as it may not catch product-specific context critical to writing an effective changelog.

## why slog?

**slog is a tool, not a platform** - and it is developed as such. every surface of the application is meant to be useful when you need it, but out of your way when you don't; thus, it is intentionally minimal in its feature set while being rich where it matters.

because the changelogs live within the repository, they stay with the developer forever, even if the hosted instance were to disappear (to which you would then [selfhost](#installation-server)). the source of truth **is** the repository, allowing developers to draft and refine before publishing, though ci/cd pipelines are supported so you *can* do push-actions.

slog is specifically built for libraries, sdks, etc. - developer-facing tools where all the developer really wants to know is "what changed and what do i need to do?" (not "we're proud to announce [...] 🎉")

the surface of the slog cli (and the web app) are intentionally simple: it's only a 2-agent loop w/ bounded tool calls under bring-your-own-key while the web app allows you to crud projects/tokens. slog is a fully featured product in the traditional sense, though it more closely aligns with [unix philosophy](https://cscie2x.dce.harvard.edu/hw/ch01s06.html) in the direction developer tools have been taking recently (ex: [bruno](https://github.com/usebruno/bruno)).

lastly, slog is opinionated where it matters - it will still decide what constitutes a breaking change, what gets more detail, etc. - though, as with any ai, its output should be carefully reviewed and revised by humans.

## [demo (loom)](https://loom.com) TODO

## quickstart / cli installation
> [!IMPORTANT]
> this assumes the hosted version is being used @ slog.makors.xyz - for local-only run `bunx @makors/slog init --local` ([bun](https://bun.com) must be installed). **windows is NOT supported, and wsl may be buggy.**


1. visit https://slog.makors.xyz, login w/ github, create a project
2. copy and run the command shown on screen (`bunx @makors/slog init [...]`)
3. that's it! run `slog --help` for commands and look at [workflow](#workflow) / [configuration](#configuration)

## commands / usage
you can see this message by running `slog --help` (works per-command: `slog init --help`)

```
TODO
```

## workflow

each release lives in its own folder:

```
changelogs/
  v1.2.0/
    index.md
    migration-guide.md
    ...
```

`index.md` is the main changelog page for that release, keep it short and sweet.
if you want to add more detail, you can add other markdown files in the same folder and link to them from `index.md`.

> [!TIP]
> run slog when you ship, not at release time. slog will automatically append to existing version tags if provided; the best changelogs come from running `slog gen` over time when you ship something meaningful, refining the output manually, and publishing when ready.

while you're shipping, use the gen command to create a draft changelog from local git history:

```sh
slog init --local # local-only setup while the hosted API is not wired up yet
slog gen 6e0c85..f12a3b --release v1.2.0 # add to log on monday
slog gen e23fab --release v1.2.0 # append one commit on wednesday
slog gen --release v1.2.0 # append past 10 commits (if available)
```

when you're done shipping, [ship it all on a friday](https://blog.railway.com/p/how-we-write-changelogs) (or slog it!):

```sh
slog publish --release v1.2.0 # publish it all on friday (yolo!)
```


## configuration

`.slog.json` lives at the root of your repo and is created by `slog init`:

```jsonc
{
  "projectId": "abc123",        // project id from the slog api
  "baseUrl": "https://slog.makors.xyz", // slog instance to publish to (self-hostable)
  "local": false,               // true = skip publishing, local drafts only
  "branding": {
    "displayName": "tjCSL" // overrides project name on changelog display
  }
}
```

llm credentials are stored separately at `~/.config/slog/llm.json`, which can be set via `slog gen` (if already initialized, pass `--configure-llm`), or via env vars:

```sh
SLOG_LLM_BASE_URL=https://api.openai.com/v1 # default
SLOG_LLM_MODEL=gpt-5.5 # default
SLOG_LLM_API_KEY=sk-...
```

llm support in slog is openai-first, as it expects a chat completions api w/ tool calls and structured json schemas within its agent loop. openai has been the only provider tested, though fireworks and ollama should also work. other providers may work, but they are best-effort given the above restrictions.

slog tokens (`slog_...`) are stored in `~/.config/slog/[project-id]` w/ proper permissions. in ci/cd, you can set `SLOG_TOKEN` (your project token from the web app) so `slog publish` can authenticate without local credentials.

## installation (server)

> [!WARNING]
> this setup is **not intended for production**. the dockerfile and compose config are development-oriented and will need to be edited accordingly for production hardening (secrets management, no volume mounts, open ports, etc.)

1. clone the repo and make sure [bun](https://bun.sh) and [docker](https://docs.docker.com/get-docker/) are installed
2. copy [`apps/web/.env.example`](apps/web/.env.example) to `apps/web/.env.local` and fill it out — you'll need a github oauth app (callback: `http://localhost:3000/api/auth/callback/github`) and a strong auth secret. set `NEXT_PUBLIC_URL` to the public-facing url if it differs from `BETTER_AUTH_URL`
3. copy the `POSTGRES_*` vars and `DOCKER_DATABASE_URL` from that same `.env.example` to a `.env` file in the **root** of the repo (next to `docker-compose.yml`) - compose reads them from there
4. run `docker compose up` from the root - this starts postgres and the next.js dev server. the app will push the db schema automatically on first start
5. visit `http://localhost:3000` and sign in!

## technical / product rationale


TODO

## stack

- **runtime**: bun (monorepo w/ `apps/web`, `apps/cli`)
- **web**: next.js 16, react 19, tailwind, customized shadcn/ui
- **db**: postgres + drizzle orm (neon under vercel in prod)
- **auth**: better-auth (github oauth)
- **cli**: bun-native, openai sdk (chat completions w/ tool calls), zod
- **infra**: docker compose (postgres + next.js dev server)

dependencies are kept minimal where needed (esp. in the cli)

## ai tools used
codex, cursor, and claude code were used heavily for implementation, though all architectural, design (ux/dx), and prompt engineering decisions (i.e. the important stuff) were done by me.
