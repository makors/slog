"use client"

import { useCallback } from "react"
import { Check, Copy, Hash } from "lucide-react"

import { Button } from "@/components/ui/button"
import { useCopy } from "@/hooks/use-copy"
import { cn } from "@/lib/utils"

interface VersionActionsProps {
  href: string
  label: string
  markdown: string
}

export function VersionActions({
  href,
  label,
  markdown,
}: VersionActionsProps) {
  const copyUrl = useCopy()
  const copyMd = useCopy()

  const handleCopyUrl = useCallback(() => {
    const url = new URL(href, window.location.href)
    copyUrl.copy(url.toString())
  }, [href, copyUrl])

  const handleCopyMd = useCallback(() => {
    copyMd.copy(markdown)
  }, [markdown, copyMd])

  return (
    <div className="mb-3 flex items-center gap-1 opacity-70">
      <Button
        asChild
        variant="ghost"
        size="icon-xs"
        className="text-muted-foreground/70 hover:text-foreground"
      >
        <a
          href={href}
          aria-label={`Permalink to ${label}`}
          title={`Permalink to ${label}`}
        >
          <Hash className="size-3" />
        </a>
      </Button>
      <div className="h-3 w-px bg-border" aria-hidden />
      <CopyBtn onClick={handleCopyMd} copied={copyMd.copied} label="Markdown" />
      <CopyBtn onClick={handleCopyUrl} copied={copyUrl.copied} label="URL" />
    </div>
  )
}

function CopyBtn({
  onClick,
  copied,
  label,
}: {
  onClick: () => void
  copied: boolean
  label: string
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="xs"
      onClick={onClick}
      aria-label={copied ? `Copied ${label}` : `Copy ${label}`}
      title={copied ? `Copied ${label}` : `Copy ${label}`}
      className={cn(
        "gap-1.5 px-1.5 text-[11px] text-muted-foreground/70 hover:text-foreground",
        copied && "text-foreground"
      )}
    >
      {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
      <span>{copied ? "Copied" : label}</span>
    </Button>
  )
}
