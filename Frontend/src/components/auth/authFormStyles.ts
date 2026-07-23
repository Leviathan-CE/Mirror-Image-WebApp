/**
 * Shared status-tone styles for auth forms (login / register).
 */

export type HelpTone = "idle" | "error" | "success" | "pending"

export const HELP_TONE_CLASS: Record<HelpTone, string> = {
  idle: "text-white/50",
  pending: "text-cyan-300/80",
  success: "text-emerald-400",
  error: "text-red-400",
}
