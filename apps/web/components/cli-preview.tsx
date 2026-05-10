"use client";

import { useEffect, useReducer } from "react";

import { cn } from "@/lib/utils";

// One-direction shimmer sweep with a dim base layer, so the animated highlight
// can reset off-text without making the rest of the word disappear.
// Gated behind motion-safe so it does nothing for prefers-reduced-motion users.
function Shimmer({ children }: { children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "relative inline-block text-white/35",
      )}
    >
      {children}
      <span
        aria-hidden
        className={cn(
          "absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent",
          "bg-[length:50%_auto] bg-clip-text bg-no-repeat text-transparent",
          "motion-safe:animate-[text-shimmer_2s_linear_infinite]",
        )}
      >
        {children}
      </span>
    </span>
  );
}

type Step =
  | { kind: "line" }
  | { kind: "spinner-in" }
  | { kind: "progress"; verb: string; detail: string }
  | { kind: "done" };

const TIMELINE: { ms: number; step: Step }[] = [
  { ms: 300,   step: { kind: "line" } },
  { ms: 650,   step: { kind: "line" } },
  { ms: 1000,  step: { kind: "line" } },
  { ms: 1350,  step: { kind: "spinner-in" } },
  { ms: 1350,  step: { kind: "progress", verb: "slogging",  detail: "exploring git history" } },
  { ms: 3600,  step: { kind: "progress", verb: "drafting",  detail: "asking model" } },
  { ms: 5800,  step: { kind: "progress", verb: "shipping",  detail: "writing changelog" } },
  { ms: 7900,  step: { kind: "progress", verb: "polishing", detail: "refining markdown" } },
  { ms: 10200, step: { kind: "done" } },
];

type State = {
  visibleLines: number;
  spinnerVisible: boolean;
  verb: string;
  detail: string;
  stepKey: number;
  done: boolean;
};

type Action = Step;

function reducer(state: State, action: Action): State {
  switch (action.kind) {
    case "line":
      return { ...state, visibleLines: state.visibleLines + 1 };
    case "spinner-in":
      return { ...state, spinnerVisible: true };
    case "progress":
      return {
        ...state,
        verb: action.verb,
        detail: action.detail,
        stepKey: state.stepKey + 1,
      };
    case "done":
      return { ...state, done: true };
  }
}

const SUCCESS_LINES = [
  "ready to generate from recent commits",
  "release: v1.2.0",
  "created release folder",
];

export function CliPreview() {
  const [state, dispatch] = useReducer(reducer, {
    visibleLines: 0,
    spinnerVisible: false,
    verb: "slogging",
    detail: "exploring git history",
    stepKey: 0,
    done: false,
  });

  useEffect(() => {
    const timers = TIMELINE.map(({ ms, step }) =>
      setTimeout(() => dispatch(step), ms),
    );
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <div
      aria-hidden
      className={cn(
        "w-full max-w-xs select-none overflow-hidden rounded-lg border border-border",
        "bg-[#080808] font-mono text-[12px] leading-relaxed dark:bg-[#050505]",
        "shadow-[0_4px_24px_rgba(0,0,0,0.5)]",
      )}
    >
      {/* Traffic-light strip */}
      <div className="flex items-center gap-1.5 border-b border-border/60 px-3.5 py-2.5">
        <span className="size-2.5 rounded-full bg-white/[0.07]" />
        <span className="size-2.5 rounded-full bg-white/[0.07]" />
        <span className="size-2.5 rounded-full bg-white/[0.07]" />
      </div>

      {/* Terminal body */}
      <div className="flex flex-col gap-0.5 px-4 py-4">
        {/* Prompt */}
        <p className="mb-1.5 text-white/25">
          <span className="text-white/15">$</span> slog gen --release v1.2.0
        </p>

        {/* Success lines */}
        {SUCCESS_LINES.map((text, i) => (
          <p
            key={text}
            className={cn(
              "motion-safe:transition-opacity motion-safe:duration-300",
              state.visibleLines > i ? "opacity-100" : "opacity-0",
            )}
          >
            <span className="text-emerald-400">✓</span>{" "}
            <span className="text-white/50">{text}</span>
          </p>
        ))}

        {/* Spinner */}
        <div
          className={cn(
            "mt-2 flex flex-col gap-0.5 motion-safe:transition-opacity motion-safe:duration-500",
            state.spinnerVisible ? "opacity-100" : "opacity-0",
          )}
        >
          <p className="flex items-center gap-1.5">
            <span
              className={cn(
                "motion-safe:transition-colors motion-safe:duration-700",
                state.done ? "text-emerald-400" : "text-white/40",
              )}
            >
              {state.done ? "✓" : "●"}
            </span>
            {state.done ? (
              <span className="text-white/40">done</span>
            ) : (
              <Shimmer>{state.verb}</Shimmer>
            )}
          </p>
          <p className="text-white/30">
            │{" "}
            {state.done ? "wrote changelog draft" : state.detail}
          </p>
        </div>
      </div>
    </div>
  );
}
