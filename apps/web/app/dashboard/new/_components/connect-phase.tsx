"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";

import { Check } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { useCopy } from "@/hooks/use-copy";
import { cn } from "@/lib/utils";

import { WaitingDots } from "./waiting-dots";

const PLACEHOLDER = "···-···-···";
const CLI_RUNNER = "bunx @slog-it/slog";
const subscribeToOrigin = () => () => {};
const getOriginSnapshot = () => window.location.origin;
const getServerOriginSnapshot = () => "";

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

export function ConnectPhase({
  code,
  onConnected,
}: {
  code: string | null;
  onConnected: (info: { projectId: string }) => void;
}) {
  const origin = useSyncExternalStore(
    subscribeToOrigin,
    getOriginSnapshot,
    getServerOriginSnapshot,
  );
  const [expired, setExpired] = useState(false);
  const { copied, copy: copyValue } = useCopy();
  const display = code ?? PLACEHOLDER;
  const command = `${CLI_RUNNER} init ${display}${origin ? ` \\\n  --url ${origin}` : ""}`;

  const copy = useCallback(() => {
    if (!code) return;
    copyValue(command);
  }, [code, command, copyValue]);

  // `c` copies the command (when not typing into an input).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.repeat) return; // ignore OS key-repeat while held
      if (e.key !== "c" && e.key !== "C") return;
      if (!code || isTypingTarget(e.target)) return;
      if (window.getSelection()?.toString()) return;
      e.preventDefault();
      copy();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [code, copy]);

  // Stream join-code state until the CLI redeems it at `/api/token`.
  useEffect(() => {
    if (!code) return;
    let cancelled = false;

    const events = new EventSource(
      `/api/join-code/${encodeURIComponent(code)}/events`,
    );

    events.addEventListener("claimed", (event) => {
      if (cancelled) return;
      const data = JSON.parse(event.data) as {
        project: { id: string; name: string };
      };
      events.close();
      onConnected({ projectId: data.project.id });
    });

    events.addEventListener("expired", () => {
      if (cancelled) return;
      events.close();
      setExpired(true);
    });

    return () => {
      cancelled = true;
      events.close();
    };
  }, [code, onConnected]);

  return (
    <div className="flex flex-col gap-4">
      <CommandBlock display={display} loading={!code} origin={origin} />

      <div className="flex items-center gap-3">
        {!expired && <WaitingDots />}
        <span className="text-sm text-muted-foreground">
          {expired
            ? "Join code expired. Refresh to create a new one."
            : "Waiting for the CLI…"}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={copy}
          disabled={!code}
          aria-keyshortcuts="C"
          className="group/cp ml-auto gap-3 pr-3 text-sm tracking-tight"
        >
          <span>Copy</span>
          <span className="relative flex size-5 items-center justify-center">
            <Kbd
              aria-hidden
              variant="outline"
              className={cn(
                "absolute uppercase transition-all duration-200 group-hover/cp:bg-background",
                copied ? "opacity-0 scale-75" : "opacity-100 scale-100",
              )}
            >
              C
            </Kbd>
            <Check
              aria-hidden
              className={cn(
                "absolute size-3.5 transition-all duration-200",
                copied ? "opacity-100 scale-100" : "opacity-0 scale-75",
              )}
            />
          </span>
        </Button>

      </div>
    </div>
  );
}

function CommandBlock({
  display,
  loading,
  origin,
}: {
  display: string;
  loading: boolean;
  origin: string;
}) {
  return (
    <pre
      className={cn(
        "w-full whitespace-pre rounded-lg border border-border bg-muted/40",
        "px-4 py-3.5 font-mono text-sm leading-relaxed tracking-tight",
        "transition-opacity duration-300",
        loading && "opacity-50",
      )}
    >
      <span aria-hidden className="select-none text-muted-foreground/70">$ </span>
      <span className="text-muted-foreground">{CLI_RUNNER} init</span>
      {origin ? (
        <>
          <span className="text-muted-foreground/50">{" "}</span>
          <span
            className={cn(
              "font-semibold tracking-[0.08em] text-foreground transition-opacity duration-300",
              loading && "opacity-60",
            )}
          >
            {display}
          </span>
          <span className="text-muted-foreground/50"> \{"\n"}{"  "}</span>
          <span className="text-muted-foreground">{" "}--url </span>
          <span>{origin}</span>
          <span className="text-muted-foreground/50"> # requires </span>
          <Link
            href="https://bun.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground/50 underline underline-offset-2 hover:text-muted-foreground"
          >
            bun
          </Link>
        </>
      ) : (
        <>
          <span className="text-muted-foreground"> </span>
          <span
            className={cn(
              "font-semibold tracking-[0.08em] text-foreground transition-opacity duration-300",
              loading && "opacity-60",
            )}
          >
            {display}
          </span>
        </>
      )}
    </pre>
  );
}
