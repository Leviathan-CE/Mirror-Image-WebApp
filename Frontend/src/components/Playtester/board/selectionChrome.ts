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

/**
 * Selection frame flush with the card edge, painted *inward* (not outside).
 * Looks like a ring around the face without leaving a gap of art outside the
 * box, and without drawing outside `overflow-hidden` parents.
 */
export function selectionOverlayClass(): string {
  return "pointer-events-none absolute inset-0 z-20 shadow-[inset_0_0_0_3px_rgb(103_232_249)]"
}

/**
 * Local click-highlight. Any seat's card can be painted — drag / bulk
 * actions still filter by owner separately.
 */
export function cardIsPaintSelected(
  card: { selected?: boolean },
  _localSeat?: PlayerSlot
): boolean {
  return Boolean(card.selected)
}
