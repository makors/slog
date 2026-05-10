"use client"

import { useState } from "react"
import copy from "copy-to-clipboard"
import { Check, Copy } from "lucide-react"

export function CopyButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false)

  function handleCopy() {
    copy(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      onClick={handleCopy}
      className="code-copy-btn"
      aria-label={copied ? "Copied" : "Copy code"}
    >
      {copied ? (
        <Check className="size-3.5" />
      ) : (
        <Copy className="size-3.5" />
      )}
    </button>
  )
}
