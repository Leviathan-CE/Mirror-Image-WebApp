/**
 * Selection paint helpers — local cyan rings only.
 * Kept out of `constants.ts` so Windows path-casing (Constants vs constants)
 * cannot double-load these exports in the TS language service.
 */

import type { PlayerSlot } from "@/components/Playtester/constants"

/** Local selection ring (cyan). */
export function selectionRingClass(): string {
  return "ring-2 ring-cyan-300 ring-offset-1 ring-offset-black/80"
}

/** Paint only this client's own `card.selected` (action targeting). */
export function cardIsPaintSelected(
  card: { owner: PlayerSlot; selected?: boolean },
  localSeat: PlayerSlot
): boolean {
  return card.owner === localSeat && Boolean(card.selected)
}
