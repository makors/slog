"use client";

import { useEffect, useRef, useState } from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { ArrowLeft, ArrowUpRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { requestJoinCode } from "@/lib/join-code";
import { cn } from "@/lib/utils";

import { ConnectPhase } from "./_components/connect-phase";
import { DeployPhase } from "./_components/deploy-phase";
import { StepConnector, StepDot } from "./_components/step-rail";
import { getPhaseState, PHASES, type PhaseId } from "./_lib/phases";

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

function isOverlayOpen() {
  return Boolean(
    document.querySelector(
      '[data-state="open"][role="dialog"], [data-state="open"][role="menu"], [data-radix-popper-content-wrapper]',
    ),
  );
}

export function NewProjectStepper() {
  const router = useRouter();

  const [code, setCode] = useState<string | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [siteUrl, setSiteUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [active, setActive] = useState<PhaseId>("connect");
  const [allDone, setAllDone] = useState(false);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented) return;
      if (event.isComposing || event.repeat) return;
      if (event.key !== "Escape") return;
      if (isTypingTarget(event.target)) return;
      if (isOverlayOpen()) return;

      event.preventDefault();
      router.push("/dashboard");
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [router]);

  // Mint a join code once the page mounts.
  useEffect(() => {
    let cancelled = false;
    requestJoinCode().then((res) => {
      if (cancelled) return;
      if ("error" in res) setError(res.error);
      else setCode(res.code);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return <Failure message={error} onBack={() => router.push("/dashboard")} />;
  }

  return (
    <div className="mx-auto flex w-full max-w-xl flex-1 flex-col px-6 pt-6 pb-10">
      <BackLink />

      <div className="mt-7 flex w-full flex-col gap-10">
        <Header />

        <ol className="flex flex-col">
          {PHASES.map((phase, i) => {
            const isLast = i === PHASES.length - 1;
            const rawState = getPhaseState(phase.id, active, allDone);
            // Last step uses "complete" (green dot, content stays visible).
            const state = isLast && rawState === "done" ? "complete" : rawState;

            return (
              <li key={phase.id} className="flex gap-5">
                <div className="flex flex-col items-center pt-[7px]">
                  <StepDot state={state} />
                  {!isLast && <StepConnector state={state} />}
                </div>

                <div
                  className={cn(
                    "flex min-w-0 flex-1 flex-col gap-4",
                    isLast ? "pb-0" : "pb-8",
                  )}
                >
                  <div className="flex min-h-5 flex-col gap-1 pt-px">
                    {state === "complete" && siteUrl ? (
                      <a
                        href={siteUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex w-fit items-center gap-1.5 text-base font-medium leading-tight tracking-tight text-foreground underline-offset-4 hover:underline"
                      >
                        <span>Published to {siteUrl}</span>
                        <ArrowUpRight className="size-4 shrink-0 text-muted-foreground" />
                      </a>
                    ) : (
                      <span
                        className={cn(
                          "text-base font-medium leading-tight tracking-tight transition-colors duration-200",
                          state === "pending" && "text-muted-foreground/55",
                          state === "active" && "text-foreground",
                          state === "done" && "text-muted-foreground",
                        )}
                      >
                        {state === "done" && !isLast
                          ? phase.doneLabel
                          : phase.label}
                      </span>
                    )}
                    {state === "active" && (
                      <span className="text-sm leading-relaxed text-muted-foreground/80">
                        {phase.hint}
                      </span>
                    )}
                  </div>

                  {(state === "active" || state === "complete") && (
                    <div className="animate-in fade-in slide-in-from-top-1 duration-200">
                      {phase.id === "connect" && (
                        <ConnectPhase
                          code={code}
                          onConnected={({ projectId: id }) => {
                            setProjectId(id);
                            setActive("deploy");
                          }}
                        />
                      )}
                      {phase.id === "deploy" && (
                        <DeployPhase
                          projectId={projectId}
                          siteUrl={siteUrl}
                          onDeployed={(url) => {
                            setSiteUrl(url);
                            setAllDone(true);
                          }}
                        />
                      )}
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ol>

        <Footer allDone={allDone} onDone={() => router.push("/dashboard")} />
      </div>
    </div>
  );
}

function BackLink() {
  return (
    <Link
      href="/dashboard"
      className={cn(
        "inline-flex w-fit items-center gap-1.5 -ml-1 px-1 py-1 rounded",
        "text-sm text-muted-foreground/70 transition-colors",
        "hover:text-foreground focus-visible:text-foreground",
        "focus-visible:outline-none",
      )}
    >
      <ArrowLeft aria-hidden className="size-4" />
      <span>Dashboard</span>
    </Link>
  );
}

function Header() {
  return (
    <div className="flex flex-col items-start gap-2">
      <h1 className="text-lg font-medium tracking-tight">
        Create a project
      </h1>
    </div>
  );
}

function Footer({
  allDone,
  onDone,
}: {
  allDone: boolean;
  onDone: () => void;
}) {
  const doneRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (allDone) doneRef.current?.focus();
  }, [allDone]);

  useEffect(() => {
    if (!allDone) return;
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Enter") return;
      if (e.defaultPrevented || e.isComposing || e.repeat) return;
      if (isTypingTarget(e.target) || isOverlayOpen()) return;
      e.preventDefault();
      onDone();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [allDone, onDone]);

  if (!allDone) return null;

  return (
    <div className="flex">
      <Button
        ref={doneRef}
        variant="outline"
        onClick={onDone}
        className="animate-in fade-in slide-in-from-bottom-1 w-full gap-3 pr-3 tracking-tight duration-200"
      >
        <span>Done</span>
        <Kbd
          aria-hidden
          variant="outline"
          className="uppercase"
        >
          ↵
        </Kbd>
      </Button>
    </div>
  );
}

function Failure({
  message,
  onBack,
}: {
  message: string;
  onBack: () => void;
}) {
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-4 px-6 py-20">
      <p className="text-sm text-destructive">{message}</p>
      <Button variant="outline" size="sm" onClick={onBack}>
        Back to dashboard
      </Button>
    </div>
  );
}
