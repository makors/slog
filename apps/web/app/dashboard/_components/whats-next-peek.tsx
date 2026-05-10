"use client"

import { useState } from "react"

// A tiny "Kilroy was here" character peeking up from the bottom edge of the
// viewport — the screen edge itself plays the role of the "wall" he hides
// behind. Sits below the projects list as a soft, atmospheric flourish.
// ^ thanks, claude!
export function WhatsNextPeek() {
  const [isClicking, setIsClicking] = useState(false)

  return (
    <div
      // `mt-auto` parks him at the bottom of the main area when the project
      // list is short. `pt-16` keeps breathing room above when the list is
      // long enough that the auto margin collapses to zero.
      className="mt-auto flex flex-col items-center pt-16 select-none"
    >
      <p className="mb-3 text-sm tracking-tight text-muted-foreground/45">
        what else will you ship?
      </p>

      {/* The SVG is sized so its bottom edge corresponds to the implicit
          ground line — the bottom of the viewport. The page section has no
          bottom padding, so the head + hands sit flush against the screen
          edge as if peeking up from below. */}
      <button
        type="button"
        aria-label="Animate Kilroy"
        data-clicking={isClicking}
        onAnimationEnd={() => setIsClicking(false)}
        onClick={() => setIsClicking(true)}
        className="block rounded-sm text-muted-foreground/55 transition-colors hover:text-muted-foreground/75 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 focus-visible:ring-offset-background focus-visible:outline-none active:scale-95 motion-safe:data-[clicking=true]:animate-[kilroy-click_420ms_cubic-bezier(0.2,0.8,0.2,1)]"
      >
        <span className="block motion-safe:animate-[peek-bob_4.5s_ease-in-out_infinite]">
          <svg
            aria-hidden
            viewBox="0 0 280 30"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.25"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="block h-11 w-[380px]"
          >
            {/* Head dome */}
            <path d="M125 30 Q125 10 140 10 Q155 10 155 30" />

            {/* Eyes */}
            <circle
              cx="133"
              cy="22"
              r="1.4"
              fill="currentColor"
              stroke="none"
            />
            <circle
              cx="147"
              cy="22"
              r="1.4"
              fill="currentColor"
              stroke="none"
            />

            {/* Signature Kilroy hook nose — curves down and drapes over the
                edge, with the tail lost beneath the screen line. */}
            <path d="M140 24 Q140 30 143 30" />

            {/* Left hand gripping the edge */}
            <path d="M108 30 Q108 25 113 25 Q118 25 118 30" />
            {/* Right hand gripping the edge */}
            <path d="M162 30 Q162 25 167 25 Q172 25 172 30" />
          </svg>
        </span>
      </button>
    </div>
  )
}
