/**
 * Stripe billing client — checkout, portal, status, Payment Element.
 */

import {
  apiBaseUrl,
  authHeaders,
  readJsonOrThrow,
} from "@/lib/api/client"

export type BillingStatus = {
  subscription_status: string
  subscription_type: string
  subscription_current_period_end: string | null
  cancel_at_period_end: boolean
  is_subscribed: boolean
  stripe_configured: boolean
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
  offer_id: string
  print_downloads_per_month: number | null
  price_configured: boolean
}

export type BillingPlans = {
  plans: BillingPlan[]
  stripe_configured: boolean
}

export type BillingConfig = {
  publishable_key: string
  stripe_configured: boolean
}

export type SubscriptionIntent = {
  client_secret: string
  offer_id: string
  subscription_id: string
  payment_required?: boolean
  already_on_plan?: boolean
}

export type PrintQuote = {
  deck_id: number
  card_count: number
  amount_cents: number
  amount_display: string
  currency: string
  entitled_free: boolean
}

export type PrintIntent = {
  client_secret: string
  payment_intent_id: string
  deck_id: number
  card_count: number
  amount_cents: number
  amount_display: string
}

export type PrintAccess = {
  allowed: boolean
  entitled_free: boolean
  grant_id: number | null
}

function returnOriginPayload(): { return_origin: string } {
  return { return_origin: window.location.origin }
}

export async function fetchBillingStatus(
  token: string
): Promise<BillingStatus> {
  const response = await fetch(`${apiBaseUrl()}/billing/status`, {
    headers: authHeaders(token),
  })
  return readJsonOrThrow<BillingStatus>(response, "billing_status_failed")
}

export async function syncBillingFromStripe(
  token: string
): Promise<BillingStatus> {
  const response = await fetch(`${apiBaseUrl()}/billing/sync`, {
    method: "POST",
    headers: authHeaders(token),
  })
  return readJsonOrThrow<BillingStatus>(response, "billing_sync_failed")
}

export async function createCheckoutSession(
  token: string,
  offerId?: string
): Promise<{ url: string }> {
  const response = await fetch(`${apiBaseUrl()}/billing/checkout`, {
    method: "POST",
    headers: {
      ...authHeaders(token),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      ...returnOriginPayload(),
      offer_id: offerId || undefined,
    }),
  })
  return readJsonOrThrow<{ url: string }>(response, "checkout_failed")
}

export async function fetchBillingPlan(): Promise<BillingPlan> {
  const response = await fetch(`${apiBaseUrl()}/billing/plan`)
  return readJsonOrThrow<BillingPlan>(response, "billing_plan_failed")
}

export async function fetchBillingPlans(): Promise<BillingPlans> {
  const response = await fetch(`${apiBaseUrl()}/billing/plans`)
  return readJsonOrThrow<BillingPlans>(response, "billing_plans_failed")
}

export async function createPortalSession(
  token: string
): Promise<{ url: string }> {
  const response = await fetch(`${apiBaseUrl()}/billing/portal`, {
    method: "POST",
    headers: {
      ...authHeaders(token),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(returnOriginPayload()),
  })
  return readJsonOrThrow<{ url: string }>(response, "portal_failed")
}

export async function fetchBillingConfig(): Promise<BillingConfig> {
  const response = await fetch(`${apiBaseUrl()}/billing/config`)
  return readJsonOrThrow<BillingConfig>(response, "billing_config_failed")
}

export async function createSubscriptionIntent(
  token: string,
  offerId?: string
): Promise<SubscriptionIntent> {
  const response = await fetch(
    `${apiBaseUrl()}/billing/subscription/intent`,
    {
      method: "POST",
      headers: {
        ...authHeaders(token),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        offer_id: offerId || undefined,
      }),
    }
  )
  return readJsonOrThrow<SubscriptionIntent>(
    response,
    "subscription_intent_failed"
  )
}

export async function fetchPrintQuote(
  token: string,
  deckId: number
): Promise<PrintQuote> {
  const response = await fetch(
    `${apiBaseUrl()}/billing/print/quote/${deckId}`,
    { headers: authHeaders(token) }
  )
  return readJsonOrThrow<PrintQuote>(response, "print_quote_failed")
}

export async function createPrintIntent(
  token: string,
  deckId: number
): Promise<PrintIntent> {
  const response = await fetch(`${apiBaseUrl()}/billing/print/intent`, {
    method: "POST",
    headers: {
      ...authHeaders(token),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ deck_id: deckId }),
  })
  return readJsonOrThrow<PrintIntent>(response, "print_intent_failed")
}

export async function confirmPrintPayment(
  token: string,
  paymentIntentId: string
): Promise<PrintAccess> {
  const response = await fetch(`${apiBaseUrl()}/billing/print/confirm`, {
    method: "POST",
    headers: {
      ...authHeaders(token),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ payment_intent_id: paymentIntentId }),
  })
  return readJsonOrThrow<PrintAccess>(response, "print_confirm_failed")
}

export async function fetchPrintAccess(
  token: string,
  deckId: number
): Promise<PrintAccess> {
  const response = await fetch(
    `${apiBaseUrl()}/billing/print/access/${deckId}`,
    { headers: authHeaders(token) }
  )
  return readJsonOrThrow<PrintAccess>(response, "print_access_failed")
}

/** Spend one free monthly print (or use a paid grant) before PDF build. */
export async function redeemPrintDownload(
  token: string,
  deckId: number
): Promise<PrintAccess> {
  const response = await fetch(
    `${apiBaseUrl()}/billing/print/redeem/${deckId}`,
    {
      method: "POST",
      headers: authHeaders(token),
    }
  )
  return readJsonOrThrow<PrintAccess>(response, "print_redeem_failed")
}
