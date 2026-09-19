import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

type NoteProps = {
  children: ReactNode
  className?: string
}

/** Italic, cyan-accented aside for supplementary notes, flavor text, or quotes. */
export function Note({ children, className }: NoteProps) {
  return (
    <p
      className={cn(
        "border-l-2 border-cyan-500/40 pl-4 text-base italic text-gray-400 lg:text-lg 2xl:text-xl",
        className
      )}
    >
      {children}
    </p>
  )
}
