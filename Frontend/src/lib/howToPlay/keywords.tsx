/**
 * Shared keyword ability definitions — used by How To Play and card library help.
 */

import type { ReactNode } from "react"

import { GameIcon } from "@/components/common/GameIcon"

export type KeywordAbility = {
  name: string
  text: ReactNode
}

export const KEYWORD_ABILITIES: KeywordAbility[] = [
  {
    name: "AIRBORNE",
    text: "Only assets with Airborne or Long Range can attack this entity.",
  },
  {
    name: "BLOCK X",
    text: "When you block with a unit, augment, program, technology, process, or quick hack to reduce the damage an asset would deal, reduce it by an additional X.",
  },
  {
    name: "CORROSIVE BILE",
    text: "Whenever this entity deals damage to a unit, destroy that unit.",
  },
  {
    name: "DEGRADE X",
    text: "The affected player puts the top X cards of their deck into their discard pile. When card text says a player degrades X, that player is the affected player; if no player is stated, that player is you.",
  },
  {
    name: "Desperate Maneuver X",
    text: "When you draw this card you may reveal it, if you do dismantle X, and play it immediately as though it had surge without paying its invoke cost. Otherwise you may put it into your hand."
  },
  {
    name: "DURABLE X",
    text: (
      <>
        This entity can take X damage more than its{" "}
        <GameIcon name="threat_lvl" /> rating before being defeated.
      </>
    ),
  },
  {
    name: "PREEMPTIVE STRIKE",
    text: "When this entity deals damage in a fight, it deals damage first, unless the opposing entity also has Preemptive Strike.",
  },
  {
    name: "HARDENED X",
    text: "Whenever this entity takes damage, reduce that damage by X.",
  },
  {
    name: "HARD POINT",
    text: "You may have a second copy of this card equipped as an augment for your deck.",
  },
  {
    name: "INSATIABLE HUNGER",
    text: "Attacks must target a unit the defender controls if they control one.",
  },
  {
    name: "INVULNERABLE",
    text: "This entity cannot be dismantled, trashed, or destroyed by effects that say to trash, dismantle, or destroy. Players cannot choose it as a valid target for those effects or costs.",
  },
  {
    name: "LETHAL X",
    text: "Whenever this unit, cyberspell, or augment deals damage, it deals X additional damage.",
  },
  {
    name: "LONG RANGE",
    text: "This asset can attack units with Airborne.",
  },
  {
    name: "PEER X",
    text: "Look at the top X cards of your deck. You may put any of them into your discard pile, then put the rest back on top of your deck in any order.",
  },
  {
    name: "PIERCE",
    text: "Any excess damage this asset deals to its target is redirected to the target's controller.",
  },
  {
    name: "RECURSIVE",
    text: "You may play this asset from your discard pile by paying its invoke cost. If you do, allocate the top card of your deck face down to the played card; the next time this asset would go to the discard pile, dismantle it and the face-down card instead.",
  },
  {
    name: "REFURBISHED",
    text: (
      <>
        Dismantle any number of cards from your discard pile; for each card
        dismantled this way, pay for one <GameIcon name="gen1" /> of this card's invoke 
        cost.
      </>
    ),
  },
  {
    name: "SPIRIT LINK",
    text: "Damage this asset deals is gained as life by its controller.",
  },
  {
    name: "STALWART",
    text: "When this entity attacks, it does not expend as part of the attack.",
  },
  {
    name: "STATIONARY",
    text: "This entity cannot attack.",
  },
  {
    name: "STEALTH X",
    text: "As an additional cost to target or attack this entity, the controller of the attack or targeted effect must pay X for each cyberspell, ability, or attack. If they do not pay it, that action does nothing.",
  },
  {
    name: "STURDY",
    text: 'This entity cannot be destroyed by effects that say "destroy."',
  },
  {
    name: "SURGE",
    text: "This card can be invoked any time a Quick Hack can be played.",
  },
  {
    name: "WEAKENED X",
    text: "Whenever this asset deals damage, it deals X less damage.",
  },

]

const KEYWORD_ALIASES: Record<string, string> = {
  PEIRCE: "PIERCE",
  REFURBISH: "REFURBISHED",
  SPRITLINK: "SPIRIT LINK",
  HARDPOINT: "HARD POINT",
  CORROSIVE_BILE: "CORROSIVE BILE",
  CORROSIVEBILE: "CORROSIVE BILE",
  PREEMPTIVE_STRIKE: "PREEMPTIVE STRIKE",
  LONG_RANGE: "LONG RANGE",
  LONGRANGE: "LONG RANGE",
  INSATIABLE_HUNGER: "INSATIABLE HUNGER",
  SPIRITLINK: "SPIRIT LINK",
}

function normalizeKeywordBase(rawName: string): string {
  const spaced = rawName.replace(/_/g, " ").replace(/\s+/g, " ").trim().toUpperCase()
  return (
    KEYWORD_ALIASES[spaced] ??
    KEYWORD_ALIASES[spaced.replace(/\s+/g, "_")] ??
    spaced
  )
}

/** Match "STEALTH", "STEALTH X", or "Block:2" style names to How To Play entries. */
export function findKeywordAbility(rawName: string): KeywordAbility | null {
  const base = normalizeKeywordBase(rawName)
  const exact = KEYWORD_ABILITIES.find((k) => k.name === base)
  if (exact) return exact

  const withX = KEYWORD_ABILITIES.find((k) => k.name === `${base} X`)
  if (withX) return withX

  // "BLOCK X" when base is already "BLOCK X"
  const strippedX = base.replace(/\s+X$/, "")
  if (strippedX !== base) {
    return (
      KEYWORD_ABILITIES.find((k) => k.name === strippedX) ??
      KEYWORD_ABILITIES.find((k) => k.name === `${strippedX} X`) ??
      null
    )
  }

  return null
}
