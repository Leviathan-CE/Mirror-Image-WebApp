import type { ReactNode } from "react"

type TermProps = {
  children: ReactNode
}

/** Inline emphasis for a defined game term, styled in the accent cyan color. */
export function Term({ children }: TermProps) {
  return <span className="font-semibold text-cyan-200">{children}</span>
}
