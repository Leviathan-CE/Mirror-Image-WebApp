/**
 * Corner ribbon / chip for a catalogue card that is new or updated.
 */

import { cn } from "@/lib/utils"
import {
  changeChipLabel,
  type CardChangeChipKind,
} from "@/lib/cardBanner.logic"

type CardChangeBannerProps = {
  kind: CardChangeChipKind
  className?: string
}

function toneClass(kind: CardChangeChipKind): string {
  if (kind === "new") return "bg-teal-400 text-black"
  if (kind === "removed") return "bg-red-400 text-black"
  return "bg-cyan-400 text-black"
}

export function CardChangeBanner({
  kind,
  className,
}: CardChangeBannerProps) {
  return (
    <span
      className={cn(
        "pointer-events-none z-[1] px-1.5 py-0.5",
        "font-buahs93 text-[9px] uppercase tracking-wide",
        toneClass(kind),
        className
      )}
    >
      {changeChipLabel(kind)}
    </span>
  )
}
