---
title: "Slog v2"
release: "v2"
---

# Slog v2

Slog v2 establishes the first end-to-end changelog workflow: link a project, generate AI-backed release drafts, and onboard teams through the web dashboard.

## Breaking Changes

- **[Setup uses join codes and release tags](./migration-guide.md).** `slog init` no longer accepts raw project tokens, and `slog gen` requires `--release <tag>` so drafts are written to a specific release folder.

## Features

- **Generate release markdown from git history.** `slog gen` builds git context, runs an AI analysis workflow, and writes draft changelog files under `changelogs/<release>` with progress updates and range guardrails.
- **Configure OpenAI-compatible LLMs.** Use `slog gen --configure-llm` or `SLOG_LLM_API_KEY`, `SLOG_LLM_BASE_URL`, and `SLOG_LLM_MODEL` to point generation at a provider that supports tool calls and structured responses.
- **Create projects from the web dashboard.** Authenticated dashboard routes let teams list projects, create a new project, and mint one-time join codes that the CLI redeems for project-scoped tokens.
- **Use local-only projects.** `slog init --local` creates a project configuration without API linking, and `slog publish` skips remote publishing for those projects instead of failing on missing credentials.
- **Run the web app locally with Docker.** The development stack includes Next.js, Postgres, health checks, database setup, and local environment defaults for self-hosted development.