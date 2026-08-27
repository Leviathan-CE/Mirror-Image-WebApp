/**
 * Deck description with line clamp + "Show all" when content overflows.
 * Renders markdown (GFM) through SafeMarkdown.
 */

import { useEffect, useRef, useState } from "react"

import { SafeMarkdown } from "@/components/common/SafeMarkdown"
import { cn } from "@/lib/utils"

type DeckDescriptionProps = {
  text: string
  className?: string
  /** Visible lines before "Show all" appears. Defaults to one line. */
  clampLines?: 1 | 3 | 4 | 6
}

export function DeckDescription({
  text,
  className,
  clampLines = 1,
}: DeckDescriptionProps) {
  const bodyRef = useRef<HTMLDivElement>(null)
  const [expanded, setExpanded] = useState(false)
  const [truncated, setTruncated] = useState(false)

  useEffect(() => {
    setExpanded(false)
  }, [text])

  useEffect(() => {
    function measure() {
      const el = bodyRef.current
      if (!el || expanded) return
      setTruncated(el.scrollHeight > el.clientHeight + 1)
    }

    measure()
    window.addEventListener("resize", measure)
    return () => window.removeEventListener("resize", measure)
  }, [text, expanded, clampLines])

  const showToggle = truncated || expanded

  return (
    <div className={cn("max-w-2xl", className)}>
      <div
        ref={bodyRef}
        className={cn(!expanded && clampClass(clampLines))}
      >
        <SafeMarkdown text={text} />
      </div>
      {showToggle ? (
        <button
          type="button"
          className="mt-1 font-buahs93 text-xs text-cyan-400/90 hover:text-cyan-300"
          onClick={() => setExpanded((prev) => !prev)}
        >
          {expanded ? "Show less" : "Show all"}
        </button>
      ) : null}
    </div>
  )
}

function clampClass(lines: 1 | 3 | 4 | 6): string {
  switch (lines) {
    case 1:
      return "line-clamp-1"
    case 3:
      return "line-clamp-3"
    case 4:
      return "line-clamp-4"
    case 6:
      return "line-clamp-6"
  }
}
