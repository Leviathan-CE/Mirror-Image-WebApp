/**
 * Map Unity `<sprite name=…>` tags onto GameIcon names.
 */

import type { GameIconName } from "@/components/common/GameIcon"
import { costTokenToIcon } from "@/components/cards/CardCostIcons"

const SPRITE_TO_ICON: Record<string, GameIconName> = {
  EFFECT: "effect",
  IF: "conditional",
  ATOMIC: "atomic",
  STATIC: "static",
  ENTERS: "entersPlay",
  BATTLEFIELD: "battlefield",
  STOCKPILE: "stockpile",
  ATTACK: "attack",
  END: "endTurn",
  START: "start",
  DEFEATED: "defeated",
  INVOKE: "invoke",
  TLV: "threat_lvl",
  EX: "expend",
  RE: "recycle",
  TR: "trash",
  DIS: "dismantle",
  LIF: "life",
  MET: "metal",
  POW: "power",
  RAM: "ram",
  TIM: "time",
  STL: "steel",
  GEN: "genX",
  GEN0: "gen0",
  GEN1: "gen1",
  GEN2: "gen2",
  GEN3: "gen3",
  GEN4: "gen4",
  GEN5: "gen5",
  GEN6: "gen6",
  GEN7: "gen7",
  GEN8: "gen8",
  GEN10: "gen10",
  GENX: "genX",
}

export function spriteNameToIcon(sprite: string): GameIconName | null {
  const key = sprite.trim().toUpperCase()
  if (!key) return null
  if (SPRITE_TO_ICON[key]) return SPRITE_TO_ICON[key]
  return costTokenToIcon(key)
}
