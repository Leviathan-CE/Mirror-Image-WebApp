/**
 * Render Unity card rules text: sprites → icons, <i>/<b> → styled text.
 */

import { type ReactNode } from "react"

import { GameIcon } from "@/components/common/GameIcon"
import { spriteNameToIcon } from "@/components/cards/spriteIcons"
import { cn } from "@/lib/utils"

const TOKEN_RE =
  /<sprite\s+name=([A-Za-z0-9_]+)\s*\/?>|<\/?([ib])>|([^<]+)/gi

type CardRulesTextProps = {
  text: string
  className?: string
  iconClassName?: string
}

export function CardRulesText({
  text,
  className,
  iconClassName,
}: CardRulesTextProps) {
  if (!text.trim()) {
    return (
      <p className={cn("text-white/50", className)}>No rules text.</p>
    )
  }

  const nodes: ReactNode[] = []
  let italic = false
  let bold = false
  let key = 0

  for (const match of text.matchAll(TOKEN_RE)) {
    const [, sprite, tag, plain] = match

    if (sprite) {
      const icon = spriteNameToIcon(sprite)
      nodes.push(
        icon ? (
          <GameIcon
            key={`s-${key++}`}
            name={icon}
            className={iconClassName ?? "mx-0 h-6 w-auto lg:h-7 2xl:h-7"}
          />
        ) : (
          <span
            key={`s-${key++}`}
            className="mx-0.5 font-mono text-[0.85em] text-cyan-300/80"
          >
            [{sprite.toUpperCase()}]
          </span>
        )
      )
      continue
    }

    if (tag) {
      const open = !match[0].startsWith("</")
      if (tag.toLowerCase() === "i") italic = open
      if (tag.toLowerCase() === "b") bold = open
      continue
    }

    if (!plain) continue

    for (const part of plain.split(/(\n)/)) {
      if (part === "\n") {
        nodes.push(<br key={`br-${key++}`} />)
        continue
      }
      if (!part) continue

      const classNameInner = cn(
        bold && "font-semibold text-white",
        italic && "italic text-white/65"
      )
      nodes.push(
        <span key={`t-${key++}`} className={classNameInner || undefined}>
          {part}
        </span>
      )
    }
  }

  return (
    <div
      className={cn(
        "text-base leading-relaxed text-white/80 sm:text-lg lg:text-xl lg:leading-relaxed",
        className
      )}
    >
      {nodes}
    </div>
  )
}
