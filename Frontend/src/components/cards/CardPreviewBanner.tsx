/**
 * Top-right corner ribbon for preview-status catalogue cards.
 */

import { cn } from "@/lib/utils"

type CardPreviewBannerProps = {
  className?: string
}

export function CardPreviewBanner({ className }: CardPreviewBannerProps) {
  return (
    <span
      className={cn(
        "pointer-events-none z-[1] px-1.5 py-0.5",
        "font-buahs93 text-[9px] uppercase tracking-wide",
        "bg-amber-400 text-black",
        className
      )}
    >
      PREVIEW
    </span>
  )
}
