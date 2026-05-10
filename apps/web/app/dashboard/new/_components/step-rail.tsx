"use client";

import { cn } from "@/lib/utils";

import type { PhaseState } from "../_lib/phases";

export function StepDot({ state }: { state: PhaseState }) {
  return (
    <span
      className={cn(
        "size-2 shrink-0 rounded-full transition-colors duration-300",
        state === "pending" && "bg-border",
        state === "active" && "bg-foreground",
        state === "done" && "bg-emerald-500",
        state === "complete" && "bg-emerald-500",
      )}
    />
  );
}

export function StepConnector({ state }: { state: PhaseState }) {
  return (
    <div
      className={cn(
        "mt-2 w-px flex-1 transition-colors duration-500",
        state === "done" ? "bg-foreground/15" : "bg-border",
      )}
    />
  );
}
