/**
 * Stripe billing client — checkout, portal, status.
 */

import { apiBaseUrl, authHeaders, readJsonOrThrow } from "@/lib/api/client"

export type BillingStatus = {
  subscription_status: string
  subscription_type: string
  subscription_current_period_end: string | null
  cancel_at_period_end: boolean
  is_subscribed: boolean
  stripe_configured: boolean
}

export async function fetchBillingStatus(
  token: string
): Promise<BillingStatus> {
  const response = await fetch(`${apiBaseUrl()}/billing/status`, {
    headers: authHeaders(token),
  })
  return readJsonOrThrow<BillingStatus>(response, "billing_status_failed")
}

/** Creates a Checkout Session and returns the Stripe-hosted URL to open. */
export async function createCheckoutSession(
  token: string,
  returnOrigin: string = window.location.origin
): Promise<{ url: string }> {
  const response = await fetch(`${apiBaseUrl()}/billing/checkout`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(token),
    },
    body: JSON.stringify({ return_origin: returnOrigin }),
  })
  return readJsonOrThrow<{ url: string }>(response, "checkout_failed")
}

export type BillingPlan = {
  name: string
  type: string
  tagline: string
  features: string[]
  price_display: string
  currency: string | null
  unit_amount: number | null
  interval: string | null
  stripe_configured: boolean
}

/** Public plan card (name / price / unlock list). */
export async function fetchBillingPlan(): Promise<BillingPlan> {
  const response = await fetch(`${apiBaseUrl()}/billing/plan`)
  return readJsonOrThrow<BillingPlan>(response, "billing_plan_failed")
}

/** Pull Stripe subscription state into the local users row (missed webhooks). */
export async function syncBillingFromStripe(
  token: string
): Promise<BillingStatus> {
  const response = await fetch(`${apiBaseUrl()}/billing/sync`, {
    method: "POST",
    headers: authHeaders(token),
  })
  return readJsonOrThrow<BillingStatus>(response, "billing_sync_failed")
}

/** Opens Stripe Customer Portal for cancel / payment method updates. */
export async function createPortalSession(
  token: string,
  returnOrigin: string = window.location.origin
): Promise<{ url: string }> {
  const response = await fetch(`${apiBaseUrl()}/billing/portal`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(token),
    },
    body: JSON.stringify({ return_origin: returnOrigin }),
  })
  return readJsonOrThrow<{ url: string }>(response, "portal_failed")
}
