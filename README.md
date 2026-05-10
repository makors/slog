# slog 🪵

`slog` is the agnostic changelog generator that works where you do, helping generate versioned changelog drafts w/ ai.

## installation (CLI)
the `slog` cli initializes projects, generates changelogs, and publishes them. [bun](https://bun.com) must be installed

> [!IMPORTANT]
> to publish your changelogs, you **must** either be hosting a slog server or using the hosted version @ https://slog.makors.xyz (authenticate via github)

```bash
# obtain init token via slog instance or hosted @ slog.makors.xyz
bun i -g @makors/slog # optional, can run `bunx @makors/slog` instead

slog --help

> slog v0.0.0 🪵 [...]

slog [init token] --url [slog instance url]
slog --local # local-only, can't publish
```

read below for configuration options (required for `slog gen`).

## installation (server)

next app is `apps/web`. see [`apps/web/.env.example`](apps/web/.env.example) — copy to `apps/web/.env.local`. fill in auth secret + github oauth; `DATABASE_URL` is localhost postgres, `DOCKER_DATABASE_URL` is for the compose `web` container hitting `db`.

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

> [!IMPORTANT]
> run slog when you ship, not at release time. slog will automatically append to existing version tags if provided; the best changelogs come from running `slog gen` over time when you ship something meaningful, refining the output manually, and publishing when ready.

while you're shipping, use the gen command to create a draft changelog from local git history:

```sh
slog init --local # local-only setup while the hosted API is not wired up yet
slog gen 6e0c85..f12a3b --release v1.2.0 # add to log on monday
slog gen e23fab --release v1.2.0 # append one commit on wednesday
slog gen --release v1.2.0 # append al
```

## LLM support

`slog gen` is OpenAI-first. It expects a Chat Completions API that supports tool calls and structured JSON schema responses, because generation works by letting the model inspect git history with tools and then return a typed changelog draft.

OpenAI, Fireworks, and Ollama are the primary supported targets. Other OpenAI-compatible providers may work, but they are best-effort: many providers support only part of the required surface, such as JSON mode without JSON schema, structured outputs without tool calls, or provider/model-specific subsets of the Chat Completions API.

Configure the provider with:

```sh
slog gen --configure-llm
```

or set:

```sh
SLOG_LLM_API_KEY
SLOG_LLM_BASE_URL
SLOG_LLM_MODEL
```

when you're done shipping, [ship it all on a friday](https://blog.railway.com/p/how-we-write-changelogs) (or slog it!):

```sh
slog publish --release v1.2.0 # publish it all on friday (yolo!)
```

## Commands

```sh
bun run dev:web
bun run dev:cli
bun run build
bun test
```

# coding tools used
codex, cursor!
