"use client";

import * as React from "react";
import { Dialog } from "radix-ui";
import { Check, Copy, Loader2, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { useCopy } from "@/hooks/use-copy";
import {
  createProjectToken,
  deleteProjectToken,
  listProjectTokens,
  type ProjectTokenRow,
} from "@/lib/project-actions";
import { cn } from "@/lib/utils";

interface TokensDialogProps {
  projectId: string;
  projectName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type TokenRow = ProjectTokenRow;

interface RevealedToken {
  id: string;
  name: string;
  value: string;
}

export function TokensDialog({
  projectId,
  projectName,
  open,
  onOpenChange,
}: TokensDialogProps) {
  const [tokens, setTokens] = React.useState<TokenRow[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [creating, setCreating] = React.useState(false);
  const [newName, setNewName] = React.useState("");
  const [revealed, setRevealed] = React.useState<RevealedToken | null>(null);
  const [pendingDelete, setPendingDelete] = React.useState<string | null>(null);

  const loadTokens = React.useCallback(async () => {
    try {
      const result = await listProjectTokens(projectId);
      if ("error" in result) {
        setError(result.error);
        setTokens([]);
        return;
      }
      setTokens(result.tokens);
    } catch {
      setError("Failed to load tokens.");
      setTokens([]);
    }
  }, [projectId]);

  React.useEffect(() => {
    if (!open) return;
    const id = setTimeout(() => void loadTokens(), 0);
    return () => clearTimeout(id);
  }, [open, loadTokens]);

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setError(null);
      setRevealed(null);
      setNewName("");
      setTokens(null);
      setPendingDelete(null);
    }
    onOpenChange(nextOpen);
  }

  async function handleCreate(e: React.SyntheticEvent) {
    e.preventDefault();
    const name = newName.trim();
    if (!name || creating) return;

    setCreating(true);
    setError(null);
    try {
      const result = await createProjectToken(projectId, name);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setRevealed({
        id: result.token.id,
        name: result.token.name,
        value: result.token.value,
      });
      setNewName("");
      await loadTokens();
    } catch {
      setError("Failed to create token.");
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(tokenId: string) {
    if (pendingDelete) return;
    setPendingDelete(tokenId);
    setError(null);
    try {
      const result = await deleteProjectToken(projectId, tokenId);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      if (revealed?.id === tokenId) setRevealed(null);
      await loadTokens();
    } catch {
      setError("Failed to delete token.");
    } finally {
      setPendingDelete(null);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay
          className={cn(
            "fixed inset-0 z-50 bg-black/60",
            "data-[state=open]:animate-in data-[state=open]:fade-in-0",
            "data-[state=closed]:animate-out data-[state=closed]:fade-out-0",
          )}
        />
        <Dialog.Content
          onKeyDown={(e) => {
            if (
              e.key === "Enter" &&
              !creating &&
              (e.target as HTMLElement).tagName !== "INPUT"
            ) {
              e.preventDefault();
              onOpenChange(false);
            }
          }}
          className={cn(
            "fixed top-1/2 left-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2",
            "rounded-xl border border-border bg-popover shadow-[0_16px_48px_rgba(0,0,0,0.7)]",
            "outline-none",
            "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
            "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
          )}
        >
          <div className="flex flex-col gap-5 p-6">
            <div className="flex flex-col gap-1.5">
              <Dialog.Title className="text-sm font-semibold leading-snug tracking-tight text-foreground">
                Tokens for &ldquo;{projectName}&rdquo;
              </Dialog.Title>
              <Dialog.Description className="text-xs leading-relaxed text-muted-foreground">
                Tokens can publish changelogs to this project and read limited
                metadata (name, latest release) - no other permissions.{" "}
                <span className="font-semibold">Once created, tokens are only shown once.</span>
              </Dialog.Description>
            </div>

            <form
              onSubmit={handleCreate}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Token name (e.g. CI)"
                maxLength={60}
                autoComplete="off"
                spellCheck={false}
                className={cn(
                  "h-8 min-w-0 flex-1 rounded-md border border-border bg-background px-3",
                  "text-xs text-foreground placeholder:text-muted-foreground/40",
                  "outline-none transition-[border-color,box-shadow]",
                  "focus:border-ring focus:ring-3 focus:ring-ring/20",
                )}
              />
              <Button
                type="submit"
                variant="outline"
                size="sm"
                disabled={creating || newName.trim().length === 0}
              >
                {creating ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <Plus />
                )}
                Create
              </Button>
            </form>

            <TokensList
              tokens={tokens}
              revealed={revealed}
              pendingDelete={pendingDelete}
              onDelete={handleDelete}
            />

            {error && (
              <p className="text-xs text-destructive">{error}</p>
            )}
          </div>

          <div className="flex items-center justify-end border-t border-border/60 px-6 py-4">
            <Dialog.Close asChild>
              <Button variant="outline" size="sm">
                Done
                <Kbd variant="outline" className="ml-auto">
                  ↵
                </Kbd>
              </Button>
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function TokensList({
  tokens,
  revealed,
  pendingDelete,
  onDelete,
}: {
  tokens: TokenRow[] | null;
  revealed: RevealedToken | null;
  pendingDelete: string | null;
  onDelete: (id: string) => void;
}) {
  if (tokens === null) {
    return (
      <div className="flex h-9 items-center justify-center text-muted-foreground/60">
        <Loader2 className="size-4 animate-spin" />
      </div>
    );
  }

  if (tokens.length === 0) {
    return (
      <div className="flex h-9 items-center justify-center text-xs text-muted-foreground/60">
        No tokens yet.
      </div>
    );
  }

  return (
    <ul role="list" className="flex flex-col divide-y divide-border/30">
      {tokens.map((token) => {
        const isRevealed = revealed?.id === token.id;
        return (
          <li
            key={token.id}
            className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
          >
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="truncate text-xs font-medium leading-none tracking-tight text-foreground">
                {token.name}
              </span>
              <span className="truncate font-mono text-xs leading-none text-muted-foreground/70">
                {isRevealed ? revealed!.value : `${token.tokenStart}…`}
              </span>
            </div>
            {isRevealed ? (
              <CopyButton value={revealed!.value} />
            ) : (
              <span className="shrink-0 text-xs tabular-nums text-muted-foreground/60">
                {token.lastUsedAt
                  ? `Used ${formatRelative(new Date(token.lastUsedAt))}`
                  : "Never used"}
              </span>
            )}
            <button
              type="button"
              aria-label={`Delete token ${token.name}`}
              onClick={() => onDelete(token.id)}
              disabled={pendingDelete === token.id}
              className={cn(
                "flex size-7 shrink-0 items-center justify-center rounded-md",
                "text-muted-foreground/50 outline-none transition-colors",
                "hover:bg-destructive/10 hover:text-destructive",
                "focus-visible:ring-2 focus-visible:ring-ring/40",
                "disabled:pointer-events-none disabled:opacity-50",
              )}
            >
              {pendingDelete === token.id ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Trash2 className="size-4" />
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function CopyButton({ value }: { value: string }) {
  const { copied, copy } = useCopy();

  return (
    <button
      type="button"
      onClick={() => copy(value)}
      aria-label="Copy token"
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1",
        "text-xs font-medium text-muted-foreground outline-none transition-colors",
        "hover:bg-muted hover:text-foreground",
        "focus-visible:ring-2 focus-visible:ring-ring/40",
      )}
    >
      {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

function formatRelative(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const sec = Math.round(diffMs / 1000);
  if (sec < 60) return "just now";
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hour = Math.round(min / 60);
  if (hour < 24) return `${hour}h ago`;
  const day = Math.round(hour / 24);
  if (day < 7) return `${day}d ago`;
  const week = Math.round(day / 7);
  if (week < 5) return `${week}w ago`;
  const month = Math.round(day / 30);
  if (month < 12) return `${month}mo ago`;
  const year = Math.round(day / 365);
  return `${year}y ago`;
}
