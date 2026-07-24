/**
 * Single playtester card face — display only.
 */

import { cardArtUrl } from "@/lib/api/decks"
import { cn } from "@/lib/utils"

import type { PlayingCardInstance } from "./types"

export type PlayingCardProps = {
  card: PlayingCardInstance
  className?: string
  isSelected?: boolean
  isExpended?: boolean
}

export function PlayingCard({ card, className}: PlayingCardProps) {
  const src = cardArtUrl(card.artPath, card.artVersion)
  
  return (
    <div
      className={cn(
        "relative h-36 w-28 shrink-0 overflow-hidden border border-cyan-500/35 bg-black/70",
        "clip-angled",
        className
      )}
      aria-label={card.name}
    >
      {src ? (
        <img
          src={src}
          alt=""
          className="h-full w-full object-cover"
          draggable={false}
       
        />
      ) : (
        <span className="flex h-full items-center justify-center px-2 text-center font-mono text-[10px] text-cyan-100/80">
          {card.name}
        </span>
      )}
    </div>
  )
}
