/**
 * Session-token rules: Resource Token spawns and Create Copy share one flag
 * (`isResourceToken`) and leave-zone destroy policy.
 */

import { PLAY_ZONE, type PlayZone } from "./constants"
import { removeCard, type PlayingCardInstance } from "./playCard.logic"

/**
 * Session tokens cease to exist in these zones (do not relocate there).
 * Battlefield / stockpile are intentional homes — not listed.
 */
const SESSION_TOKEN_DESTROY_ZONES: ReadonlySet<PlayZone> = new Set([
  PLAY_ZONE.library,
  PLAY_ZONE.hand,
  PLAY_ZONE.trashyard,
  PLAY_ZONE.dismantled,
  PLAY_ZONE.pilot,
])

/** True for Resource Token spawns and Create Copy tokens. */
export function isSessionTokenInstance(
  card: PlayingCardInstance | undefined | null
): boolean {
  return Boolean(card?.isToken)
}

/** @deprecated Prefer `isSessionTokenInstance` — same check. */
export const isResourceTokenInstance = isSessionTokenInstance

/**
 * If `instanceId` is a session token and `targetZone` destroys tokens,
 * remove it and return the new list. Otherwise return null (caller moves normally).
 */
export function destroySessionTokenIfLeaving(
  cards: PlayingCardInstance[],
  instanceId: string,
  targetZone: PlayZone
): PlayingCardInstance[] | null {
  if (!SESSION_TOKEN_DESTROY_ZONES.has(targetZone)) return null
  const card = cards.find((c) => c.instanceId === instanceId)
  if (!isSessionTokenInstance(card)) return null
  return removeCard(cards, instanceId)
}

/**
 * If `card` is a session token headed to a destroy zone, drop it from the
 * session instead of seating it. Otherwise return null.
 */
export function destroySessionCardIfLeaving(
  cards: PlayingCardInstance[],
  card: PlayingCardInstance,
  targetZone: PlayZone
): PlayingCardInstance[] | null {
  if (!SESSION_TOKEN_DESTROY_ZONES.has(targetZone)) return null
  if (!isSessionTokenInstance(card)) return null
  return removeCard(cards, card.instanceId)
}

/** @deprecated Prefer `destroySessionTokenIfLeaving`. */
export const destroyResourceTokenIfLeaving = destroySessionTokenIfLeaving

/** @deprecated Prefer `destroySessionCardIfLeaving`. */
export const destroyResourceCardIfLeaving = destroySessionCardIfLeaving
