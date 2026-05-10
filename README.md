# slog 🪵

Monorepo workspace for Slog.

## Structure

```text
apps/
  web/
  cli/
packages/
```

`packages/` is intentionally empty until shared packages are defined.

## Workflow

each release lives in its own folder:

```
changelogs/
  v1.2.0/
    index.md
    migration-guide.md
    ...
```

`index.md` is the main changelog page for that release, keep it short and sweet.
if you want to add more detail, you can add other markdown files and link to them from `index.md`.

> [!IMPORTANT]
> run slog when you ship, not at release time. slog will automatically append to existing version tags if provided; the best changelogs come from running `slog gen` over time when you ship something meaningful, refining the output manually, and publishing when ready.

while you're shipping, use the gen command to create a draft changelog from local git history:

```sh
slog init --local # local-only setup while the hosted API is not wired up yet
slog gen 6e0c85..f12a3b --release v1.2.0 # add to log on monday
slog gen e23fab --release v1.2.0 # append one commit on wednesday
slog gen --release v1.2.0 # append all commits since last release
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
