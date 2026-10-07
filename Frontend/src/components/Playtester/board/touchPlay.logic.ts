/**
 * Solo playtester touch / coarse-pointer thresholds.
 * Fine pointers keep the tight desktop drag threshold; coarse gets more slack
 * so a long-press can open the context menu without becoming a drag.
 */

export const DRAG_THRESHOLD_FINE_PX = 5
export const DRAG_THRESHOLD_COARSE_PX = 14
/** Hold time before opening the same menu right-click would. */
export const LONG_PRESS_MS = 480
/** Finger jitter allowed while the long-press timer is armed. */
export const LONG_PRESS_MOVE_CANCEL_PX = 10

export function dragThresholdPx(coarsePointer: boolean): number {
  if (coarsePointer) return DRAG_THRESHOLD_COARSE_PX
  return DRAG_THRESHOLD_FINE_PX
}

export function longPressShouldCancel(
  startX: number,
  startY: number,
  clientX: number,
  clientY: number,
  cancelPx: number = LONG_PRESS_MOVE_CANCEL_PX
): boolean {
  if (!Number.isFinite(startX) || !Number.isFinite(startY)) return true
  if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) return true
  if (!Number.isFinite(cancelPx) || cancelPx < 0) return true
  const dist = Math.hypot(clientX - startX, clientY - startY)
  return dist > cancelPx
}
