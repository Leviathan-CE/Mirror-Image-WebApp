/**
 * Face-down card back — src comes from auth-gated signed media, not public/.
 */

import { useCardBackSrc } from "@/app/providers/CardBackProvider"
import { cn } from "@/lib/utils"

type CardBackImgProps = {
  className?: string
}

export function CardBackImg({ className }: CardBackImgProps) {
  const src = useCardBackSrc()
  if (!src) {
    return (
      <div
        className={cn("h-full w-full bg-black/85", className)}
        aria-hidden
      />
    )
  }
  return (
    <img
      src={src}
      alt=""
      draggable={false}
      className={cn("h-full w-full object-cover", className)}
    />
  )
}
