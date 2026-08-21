/**
 * Subscription entitlement helpers (mirrors backend rules).
 *
 * Source of truth is still the API (`is_subscribed` on /auth/me).
 * Use these for UI gating once features exist.
 */

import { ADMIN_ROLE } from "@/lib/route"
import type { AuthUser } from "@/lib/api/auth"

const ENTITLED_STATUSES = new Set(["active", "trialing"])

/** Always available — no account / no grant (mirrors backend PUBLIC_FEATURES). */
const PUBLIC_FEATURES = new Set(["playtester"])

export function isUserSubscribed(user: AuthUser | null | undefined): boolean {
  if (!user) return false
  if (typeof user.is_subscribed === "boolean") return user.is_subscribed
  if (user.role === ADMIN_ROLE) return true
  return ENTITLED_STATUSES.has(user.subscription_status ?? "none")
}

/** Effective feature unlock (public ∪ /auth/me grants ∪ subscriber defaults ∪ admin). */
export function userHasFeature(
  user: AuthUser | null | undefined,
  featureKey: string
): boolean {
  if (PUBLIC_FEATURES.has(featureKey)) return true
  if (!user) return false
  if (user.role === ADMIN_ROLE) return true
  if (user.features?.includes(featureKey)) return true
  // Fallback when older /me payloads omit features[]:
  if (featureKey === "preview_cards") return isUserSubscribed(user)
  return false
}

export type PeriodLabelStatus = {
  subscription_status: string
  cancel_at_period_end?: boolean
}

/**
 * Same timestamp, different meaning:
 * - renewing active/trialing → next charge date
 * - cancel scheduled or canceled → access end date
 */
export function subscriptionPeriodLabel(
  status: PeriodLabelStatus
): "Next billing period" | "Period end" {
  if (
    status.cancel_at_period_end ||
    status.subscription_status === "canceled"
  ) {
    return "Period end"
  }
  if (
    status.subscription_status === "active" ||
    status.subscription_status === "trialing"
  ) {
    return "Next billing period"
  }
  return "Period end"
}

/** Date-only display (no clock time). */
export function formatSubscriptionDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}
