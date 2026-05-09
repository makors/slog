import { dirname, extname, isAbsolute, relative, resolve } from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { git } from "../git";
import type { Tool } from "./agent";

const DEFAULT_CONTENT_CAP_BYTES = 50 * 1024;
const MAX_CHANGELOG_WRITE_BYTES = 100 * 1024;

type ToolArgs = Record<string, unknown>;
export type ShipwrightToolOptions = {
  release: string;
  releaseDir: string;
};

function getString(args: ToolArgs, key: string): string {
  const value = args[key];
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${key} must be a non-empty string`);
  }

  return value.trim();
}

function validateCommitHash(hash: string): string {
  if (!/^[a-f0-9]{7,40}$/i.test(hash)) {
    throw new Error("hash must be a 7-40 character commit hash");
  }

  return hash;
}

function validateRef(ref: string): string {
  if (/[\s\0:]/.test(ref) || ref.startsWith("-")) {
    throw new Error("ref must be a git ref, tag, or hash without spaces");
  }

  return ref;
}

function validateRepoPath(path: string): string {
  if (path.includes("\0") || path.startsWith("/") || path === "." || path === ".." || path.startsWith("../")) {
    throw new Error("path must be a relative repository path");
  }

  return path;
}

function resolveChangelogMarkdownPath(releaseDir: string, name: string): { path: string; relativePath: string } {
  if (name.includes("\0") || isAbsolute(name) || name === "." || name === "..") {
    throw new Error("name must be a relative markdown path inside the release folder");
  }

  if (extname(name).toLowerCase() !== ".md") {
    throw new Error("name must end in .md");
  }

  const base = resolve(releaseDir);
  const path = resolve(base, name);
  const relativePath = relative(base, path).split("\\").join("/");

  if (!relativePath || relativePath.startsWith("..") || isAbsolute(relativePath)) {
    throw new Error("name must stay inside the release folder");
  }

  return { path, relativePath };
}

function truncateUtf8(text: string, maxBytes: number) {
  const encoded = Buffer.from(text, "utf8");
  if (encoded.byteLength <= maxBytes) {
    return { content: text, truncated: false, originalBytes: encoded.byteLength };
  }

  const marker = `\n\n[truncated: output exceeded ${maxBytes} bytes]`;
  const markerBytes = Buffer.byteLength(marker, "utf8");
  const contentBytes = Math.max(0, maxBytes - markerBytes);

  return {
    content: Buffer.from(encoded.subarray(0, contentBytes)).toString("utf8") + marker,
    truncated: true,
    originalBytes: encoded.byteLength,
  };
}

export function createShipwrightTools(options: ShipwrightToolOptions): Tool[] {
  return [
    {
      name: "readChangelogFile",
      description:
        `Reads a .md changelog file from the current release folder only (${options.release}). The release is fixed by the CLI flag; choose only the markdown file name or relative path inside that version folder.`,
      progressLabel: "reading changelog file",
      parameters: {
        type: "object",
        properties: {
          name: {
            type: "string",
            description:
              "Markdown file name or relative path inside the current release folder, such as index.md or migration-guide.md. Must end in .md.",
          },
        },
        required: ["name"],
        additionalProperties: false,
      },
      async run(args) {
        const file = resolveChangelogMarkdownPath(options.releaseDir, getString(args, "name"));
        const content = await readFile(file.path, "utf8");
        const truncated = truncateUtf8(content, DEFAULT_CONTENT_CAP_BYTES);

        return JSON.stringify({
          release: options.release,
          path: file.relativePath,
          maxBytes: DEFAULT_CONTENT_CAP_BYTES,
          truncated: truncated.truncated,
          originalBytes: truncated.originalBytes,
          content: truncated.content,
        });
      },
    },
    {
      name: "writeChangelogFile",
      description:
        `Writes a .md changelog file inside the current release folder only (${options.release}). The release is fixed by the CLI flag; choose only the markdown file name or relative path inside that version folder.`,
      progressLabel: "writing changelog file",
      parameters: {
        type: "object",
        properties: {
          name: {
            type: "string",
            description:
              "Markdown file name or relative path inside the current release folder, such as index.md or migration-guide.md. Must end in .md.",
          },
          content: {
            type: "string",
            description: "Complete markdown content to write to the file.",
          },
        },
        required: ["name", "content"],
        additionalProperties: false,
      },
      async run(args) {
        const file = resolveChangelogMarkdownPath(options.releaseDir, getString(args, "name"));
        const content = getString(args, "content");
        const bytes = Buffer.byteLength(content, "utf8");

        if (bytes > MAX_CHANGELOG_WRITE_BYTES) {
          throw new Error(`content must be at most ${MAX_CHANGELOG_WRITE_BYTES} bytes`);
        }

        await mkdir(dirname(file.path), { recursive: true });
        await writeFile(file.path, content, "utf8");

        return JSON.stringify({
          release: options.release,
          path: file.relativePath,
          bytes,
          written: true,
        });
      },
    },
  ];
}

export function createGitAnalysisTools(): Tool[] {
  return [
    {
      name: "get_commit_diff",
      description:
        "Returns the unified diff for a single commit hash. Use selectively for commits that look user- or developer-impacting from the initial context; avoid obvious dependency bumps, formatting-only changes, and internal refactors.",
      progressLabel: "reading commit diff",
      parameters: {
        type: "object",
        properties: {
          hash: {
            type: "string",
            description: "The 7-40 character commit hash to inspect.",
          },
        },
        required: ["hash"],
        additionalProperties: false,
      },
      async run(args) {
        const hash = validateCommitHash(getString(args, "hash"));
        const result = await git(["show", "--format=", "--no-ext-diff", "--find-renames", "--find-copies", hash]);

        if (!result.success) {
          throw new Error(result.stderr.trim() || `failed to read commit diff for ${hash}`);
        }

        const diff = truncateUtf8(result.stdout, DEFAULT_CONTENT_CAP_BYTES);
        return JSON.stringify({
          hash,
          maxBytes: DEFAULT_CONTENT_CAP_BYTES,
          truncated: diff.truncated,
          originalBytes: diff.originalBytes,
          diff: diff.content,
        });
      },
    },
    {
      name: "get_file_at_ref",
      description:
        "Returns a file's contents at a specific git ref, tag, or commit. Use when the diff lacks enough surrounding context to understand a meaningful change.",
      progressLabel: "reading file",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "Relative path to the file in the repository.",
          },
          ref: {
            type: "string",
            description: "Git ref, tag, or commit hash to read from, such as HEAD or a commit hash.",
          },
        },
        required: ["path", "ref"],
        additionalProperties: false,
      },
      async run(args) {
        const path = validateRepoPath(getString(args, "path"));
        const ref = validateRef(getString(args, "ref"));
        const result = await git(["show", `${ref}:${path}`]);

        if (!result.success) {
          throw new Error(result.stderr.trim() || `failed to read ${path} at ${ref}`);
        }

        const file = truncateUtf8(result.stdout, DEFAULT_CONTENT_CAP_BYTES);
        return JSON.stringify({
          path,
          ref,
          maxBytes: DEFAULT_CONTENT_CAP_BYTES,
          truncated: file.truncated,
          originalBytes: file.originalBytes,
          content: file.content,
        });
      },
    },
  ];
}
