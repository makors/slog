"use client"

import { useCallback, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft } from "lucide-react"

type DetailBackLinkProps = {
  href: string
  releaseVersion: string
}

export function DetailBackLink({ href, releaseVersion }: DetailBackLinkProps) {
  const router = useRouter()

  const goBack = useCallback(() => {
    router.push(href)
  }, [href, router])

  useEffect(() => {
    router.prefetch(getPrefetchHref(href))
  }, [href, router])

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape" || event.defaultPrevented) return
      if (isTypingTarget(event.target)) return

      event.preventDefault()
      goBack()
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [goBack])

  return (
    <Link
      href={href}
      aria-keyshortcuts="Escape"
      className="inline-flex w-fit items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
    >
      <ArrowLeft className="size-3.5" />
      Back to {releaseVersion}
    </Link>
  )
}

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false

  return (
    target.isContentEditable ||
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.tagName === "SELECT"
  )
}

function getPrefetchHref(href: string) {
  return href.split("#", 1)[0] || href
}
