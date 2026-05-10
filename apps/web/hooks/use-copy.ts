"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import copyToClipboard from "copy-to-clipboard";

export function useCopy({ resetMs = 1400 }: { resetMs?: number } = {}) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const flash = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setCopied(true);
    timerRef.current = setTimeout(() => {
      setCopied(false);
      timerRef.current = null;
    }, resetMs);
  }, [resetMs]);

  const copy = useCallback(
    (value: string) => {
      if (!value) return;
      if (timerRef.current) clearTimeout(timerRef.current);

      if (copyToClipboard(value)) flash();
      else setCopied(false);
    },
    [flash],
  );

  return { copied, copy };
}
