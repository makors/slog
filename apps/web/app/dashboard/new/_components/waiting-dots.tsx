"use client";

const DELAYS_MS = [0, 180, 360];

export function WaitingDots() {
  return (
    <span aria-hidden className="flex items-center gap-1">
      {DELAYS_MS.map((delay) => (
        <span
          key={delay}
          className="size-1 animate-pulse rounded-full bg-foreground/45"
          style={{ animationDelay: `${delay}ms`, animationDuration: "1100ms" }}
        />
      ))}
    </span>
  );
}
