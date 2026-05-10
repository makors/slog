"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";

import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";

const SHORTCUT_KEY = "c";
const TARGET_HREF = "/dashboard/new";

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

export function CreateChangelogButton() {
  const linkRef = useRef<HTMLAnchorElement | null>(null);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented) return;
      if (event.isComposing || event.repeat) return;
      if (
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        event.shiftKey
      )
        return;
      if (event.key.toLowerCase() !== SHORTCUT_KEY) return;
      if (isTypingTarget(event.target)) return;
      if (isOverlayOpen()) return;

      event.preventDefault();
      linkRef.current?.click();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <Button
      asChild
      variant="outline"
      className="group/cp gap-2.5 pr-2.5 tracking-tight"
    >
      <Link
        ref={linkRef}
        href={TARGET_HREF}
        aria-keyshortcuts="C"
      >
        <span>Create changelog</span>
        <Kbd
          aria-hidden
          variant="outline"
          className="uppercase transition-colors duration-150 group-hover/cp:bg-background"
        >
          C
        </Kbd>
      </Link>
    </Button>
  );
}
