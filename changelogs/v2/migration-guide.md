---
title: "Migration guide"
release: "v2"
---

# Migration guide

Slog v2 changes how repositories connect to projects and how generated drafts are placed on disk. Update existing scripts and setup docs to use join codes and explicit release tags.

## Replace project-token setup with join codes

`slog init` no longer accepts a raw project token. Create or open the project in the dashboard, generate a one-time join code, then initialize the repository with that code:

```sh
slog init <join-code>
```

For a self-hosted dashboard, pass the dashboard URL during initialization:

```sh
slog init <join-code> --url http://localhost:3000
```

The CLI redeems the join code for a project-scoped token and stores it locally. Join codes are intended for onboarding and should not be committed or reused as long-lived credentials.

## Use local setup when you do not want dashboard linking

For offline work, tests, or repositories that should not publish to a remote project, initialize in local mode:

```sh
slog init --local
```

Local projects skip API linking and token storage. `slog publish` detects this mode and exits without trying to publish remotely.

## Pass a release tag when generating drafts

`slog gen` must target a release folder explicitly:

```sh
slog gen --release v2
```

Drafts are written under `changelogs/<release>`, such as `changelogs/v2/index.md`. Update CI jobs, package scripts, and local aliases that previously ran generation without a release tag.

You can combine the release tag with the usual generation options, including custom instructions or LLM configuration:

```sh
slog gen --release v2 --instructions ./changelog-instructions.md
slog gen --release v2 --configure-llm
```