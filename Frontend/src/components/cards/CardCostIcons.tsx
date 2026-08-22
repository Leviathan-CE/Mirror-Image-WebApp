/**
 * Map card cost JSON tokens to GameIcon glyphs (UI only).
 * Tunable token → icon tables live in `./constants`.
 */

import { GameIcon } from "@/components/common/GameIcon"
import { costTokenToIcon } from "@/components/cards/constants"

type CardCostIconsProps = {
  cost: string[]
  className?: string
  iconClassName?: string
}

export function CardCostIcons({
  cost,
  className,
  iconClassName,
}: CardCostIconsProps) {
  if (!cost.length) {
    return (
      <span className={className ?? "font-mono text-[10px] text-white/35"}>
        —
      </span>
    )
  }

  return (
    <span className={className ?? "inline-flex flex-wrap items-center gap-0"}>
      {cost.map((token, index) => {
        const icon = costTokenToIcon(token)
        if (!icon) {
          return (
            <span
              key={`${token}-${index}`}
              className="font-mono text-[10px] text-cyan-300/70"
            >
              {token}
            </span>
          )
        }
        return (
          <GameIcon
            key={`${token}-${index}`}
            name={icon}
            className={iconClassName ?? "h-6 w-auto"}
          />
        )
      })}
    </span>
  )
}
