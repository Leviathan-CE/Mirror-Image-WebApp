import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

type ImportantProps = {
  children: ReactNode
  className?: string
}

/** Red callout for rules that override or clarify the rulebook. */
export function Important({ children, className }: ImportantProps) {
  return (
    <p
      className={cn(
        "rounded border-l-2 border-red-400 bg-red-900/40 px-3 py-6 text-base lg:text-lg 2xl:text-xl",
        className
      )}
    >
      {children}
    </p>
  )
}
