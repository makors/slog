"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { Check } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { cn } from "@/lib/utils";

import { WaitingDots } from "./waiting-dots";

const PLACEHOLDER = "···-···-···";
const CLI_RUNNER = "bunx @makors/slog";

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
  const [copied, setCopied] = useState(false);
  const [origin, setOrigin] = useState("");
  const [expired, setExpired] = useState(false);
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const display = code ?? PLACEHOLDER;
  const command = `${CLI_RUNNER} init ${display}${origin ? ` \\\n  --url ${origin}` : ""}`;

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  useEffect(() => {
    return () => {
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
    };
  }, []);

  const showCopied = useCallback(() => {
    setCopied(true);
    copiedTimerRef.current = setTimeout(() => {
      setCopied(false);
      copiedTimerRef.current = null;
    }, 1400);
  }, []);

  const copy = useCallback(() => {
    if (!code) return;
    if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);

    if (copyTextSync(command)) {
      showCopied();
      return;
    }

    void copyTextAsync(command).then((ok) => {
      if (ok) showCopied();
      else setCopied(false);
    });
  }, [code, command, showCopied]);

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
    <div className="flex flex-col gap-3">
      <CommandBlock display={display} loading={!code} origin={origin} />

      <div className="flex items-center gap-2.5">
        {!expired && <WaitingDots />}
        <span className="text-[13px] text-muted-foreground">
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
          className="group/cp ml-auto gap-2.5 pr-2.5 text-[13px] tracking-tight"
        >
          <span>Copy</span>
          <span className="relative flex size-[18px] items-center justify-center">
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
                "absolute size-3 transition-all duration-200",
                copied ? "opacity-100 scale-100" : "opacity-0 scale-75",
              )}
            />
          </span>
        </Button>

      </div>
    </div>
  );
}

function copyTextSync(value: string) {
  if (typeof document === "undefined") return false;

  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "0";
  textarea.style.top = "0";
  textarea.style.width = "1px";
  textarea.style.height = "1px";
  textarea.style.padding = "0";
  textarea.style.border = "0";
  textarea.style.opacity = "0.001";
  textarea.style.pointerEvents = "none";
  document.body.appendChild(textarea);

  const previouslyFocused = document.activeElement as HTMLElement | null;
  textarea.focus();
  textarea.select();
  textarea.setSelectionRange(0, value.length);

  try {
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    document.body.removeChild(textarea);
    previouslyFocused?.focus?.();
  }
}

async function copyTextAsync(value: string) {
  if (!navigator.clipboard?.writeText) return false;

  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
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
        "px-3.5 py-3 font-mono text-[13px] leading-relaxed tracking-tight",
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
