/** 2FA helpers for Settings (no React). */

export type TwoFactorTogglePhase = "idle" | "enabling" | "disabling"

export function twoFactorMethodLabel(method: string | null | undefined): string {
  if (method === "email") return "email"
  return "off"
}

/** Visual switch position: intent while a confirm step is open. */
export function twoFactorToggleChecked(
  enabled: boolean,
  phase: TwoFactorTogglePhase
): boolean {
  if (phase === "enabling") return true
  if (phase === "disabling") return false
  return enabled
}

/** Click the switch: start the opposite flow, or cancel a pending confirm. */
export function twoFactorTogglePhaseAfterClick(
  enabled: boolean,
  phase: TwoFactorTogglePhase
): TwoFactorTogglePhase {
  if (phase !== "idle") return "idle"
  if (enabled) return "disabling"
  return "enabling"
}
