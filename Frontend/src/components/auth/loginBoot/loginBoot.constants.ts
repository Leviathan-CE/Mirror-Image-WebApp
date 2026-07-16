/**
 * Single source of truth for login-boot copy and timing.
 * Change lines, hint text, or durations here — UI and hook both import this.
 */

export const BOOT_LINES = [
  "> ESTABLISHING UPLINK…",
  "> AUTH TOKEN VERIFIED",
  "> LOADING OPERATOR PROFILE…",
  "> SYNCING DECK ARCHIVE…",
  "> HANDSHAKE COMPLETE",
] as const

export const CONTINUE_HINT = "> PRESS ANY KEY OR CLICK TO CONTINUE"

/** Delay before click/key can continue — avoids the LOGIN click closing the overlay. */
export const INPUT_ARM_MS = 500

/** Default length of the full boot sequence. */
export const DEFAULT_BOOT_DURATION_MS = 3200
