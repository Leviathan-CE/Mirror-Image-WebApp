/** Resource-token session rules (destroy on illegal zone entry). */

import { PLAY_ZONE, type PlayZone } from "./playtesterConstants"
import { removeCard, type PlayingCardInstance } from "./playCard.logic"

/** Resource tokens cease to exist in these zones (do not relocate there). */
const RESOURCE_DESTROY_ZONES: ReadonlySet<PlayZone> = new Set([
  PLAY_ZONE.library,
  PLAY_ZONE.hand,
  PLAY_ZONE.trashyard,
  PLAY_ZONE.dismantled,
  PLAY_ZONE.pilot,
])

export function isResourceTokenInstance(
  card: PlayingCardInstance | undefined | null
): boolean {
  return Boolean(card?.isResourceToken)
}

/**
 * If `instanceId` is a resource token and `targetZone` destroys tokens,
 * remove it and return the new list. Otherwise return null (caller moves normally).
 */
export function destroyResourceTokenIfLeaving(
  cards: PlayingCardInstance[],
  instanceId: string,
  targetZone: PlayZone
): PlayingCardInstance[] | null {
  if (!RESOURCE_DESTROY_ZONES.has(targetZone)) return null
  const card = cards.find((c) => c.instanceId === instanceId)
  if (!isResourceTokenInstance(card)) return null
  return removeCard(cards, instanceId)
}

/**
 * If `card` is a resource token headed to a destroy zone, drop it from the
 * session instead of seating it. Otherwise return null.
 */
export function destroyResourceCardIfLeaving(
  cards: PlayingCardInstance[],
  card: PlayingCardInstance,
  targetZone: PlayZone
): PlayingCardInstance[] | null {
  if (!RESOURCE_DESTROY_ZONES.has(targetZone)) return null
  if (!isResourceTokenInstance(card)) return null
  return removeCard(cards, card.instanceId)
}
