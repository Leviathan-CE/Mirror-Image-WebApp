/**
 * Subscription status / manage block for the Subscribe page.
 * Plan picking is SubscriptionTierBar; payment is SubscribePayPage.
 */

import { useEffect, useState } from "react"
import { useSearchParams } from "react-router-dom"

import { useAuth } from "@/app/providers/AuthProvider"
import { StripeCtaButton } from "@/components/billing/StripeWordmark"
import { ApiError } from "@/lib/api/client"
import { fetchCurrentUser } from "@/lib/api/auth"
import {
  createPortalSession,
  fetchBillingStatus,
  syncBillingFromStripe,
  type BillingStatus,
} from "@/lib/api/billing"
import {
  clearBillingReturn,
  rememberBillingReturn,
  repairBillingReturnOrigin,
} from "@/lib/billingReturn"
import { ROUTES } from "@/lib/route"
import {
  formatSubscriptionDate,
  isUserSubscribed,
  subscriptionPeriodLabel,
} from "@/lib/subscription.logic"
import { cn } from "@/lib/utils"

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms)
  })
}

async function syncUntilEntitled(
  token: string,
  attempts = 5
): Promise<BillingStatus> {
  let last: BillingStatus | null = null
  for (let i = 0; i < attempts; i++) {
    last = await syncBillingFromStripe(token)
    if (last.is_subscribed) return last
    if (i < attempts - 1) await delay(1200)
  }
  return last ?? fetchBillingStatus(token)
}

export function SubscriptionSettingsPanel() {
  const { token, user, setSession } = useAuth()
  const [params, setParams] = useSearchParams()
  const [status, setStatus] = useState<BillingStatus | null>(null)
  const [busy, setBusy] = useState(false)
  const [errorText, setErrorText] = useState("")
  const [infoText, setInfoText] = useState("")

  const entitled = isUserSubscribed(user) || Boolean(status?.is_subscribed)

  useEffect(() => {
    if (repairBillingReturnOrigin()) return
  }, [])

  useEffect(() => {
    if (params.get("success") === "1") {
      setInfoText("Payment complete — syncing your subscription…")
    } else if (params.get("canceled") === "1") {
      setInfoText("Checkout canceled. You can try again anytime.")
      clearBillingReturn()
    }
  }, [params])

  useEffect(() => {
    if (!token) return

    let cancelled = false
    const afterCheckout = params.get("success") === "1"
    const afterCancel = params.get("canceled") === "1"

    // Always pull Stripe into the local row so Manage shows the
    // live tier — not a stale users.subscription_type snapshot.
    const statusPromise = afterCheckout
      ? syncUntilEntitled(token)
      : syncBillingFromStripe(token).catch(() => {
          return fetchBillingStatus(token)
        })

    void statusPromise
      .then(async (data) => {
        if (cancelled) return
        setStatus(data)
        if (afterCheckout) {
          if (data.is_subscribed) {
            setInfoText("Payment complete — subscription is active.")
            clearBillingReturn()
          } else {
            setInfoText(
              "Payment received — still waiting for Stripe to confirm. "
              + "You can refresh this page in a moment."
            )
          }
        }
        try {
          const fresh = await fetchCurrentUser(token)
          if (!cancelled) setSession(fresh)
        } catch {
          /* keep existing session */
        }
        if (afterCancel || (afterCheckout && data.is_subscribed)) {
          const next = new URLSearchParams(params)
          next.delete("success")
          next.delete("canceled")
          setParams(next, { replace: true })
        }
      })
      .catch((error: unknown) => {
        if (cancelled) return
        if (!afterCheckout) return
        const detail =
          error instanceof ApiError ? error.detail : "billing_sync_failed"
        setInfoText(
          `Payment may have succeeded, but sync failed (${detail}). `
          + "Stay on this page and refresh — do not check out again yet."
        )
      })

    return () => {
      cancelled = true
    }
  }, [token, setSession, setParams, params])

  async function onManage() {
    if (!token) return
    setBusy(true)
    setErrorText("")
    try {
      rememberBillingReturn(ROUTES.SUBSCRIPTION)
      const { url } = await createPortalSession(token)
      window.location.assign(url)
    } catch (error: unknown) {
      setBusy(false)
      clearBillingReturn()
      if (error instanceof ApiError && error.detail === "no_stripe_customer") {
        setErrorText("No Stripe customer yet — subscribe first.")
      } else {
        setErrorText("Could not open the billing portal.")
      }
    }
  }

  return (
    <section className="mb-6 border border-cyan-500/25 bg-black/50 p-5">
      <h2 className="font-buahs93 text-sm tracking-wide text-cyan-100">
        YOUR SUBSCRIPTION
      </h2>
      <p className="mt-1 font-mono text-[11px] text-cyan-100/45">
        {entitled
          ? "Manage billing in the Stripe customer portal."
          : "Pick a tier above, then complete payment on the next page."}
      </p>

      <dl className="mt-4 space-y-2 border-t border-cyan-500/15 pt-4 font-mono text-xs text-cyan-100/80">
        <div className="flex justify-between gap-4">
          <dt className="text-cyan-400/60">Status</dt>
          <dd
            className={cn(
              entitled ? "text-emerald-300/90" : "text-white/55"
            )}
          >
            {status?.subscription_status
              ?? user?.subscription_status
              ?? "none"}
          </dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-cyan-400/60">Type</dt>
          <dd>
            {status?.subscription_type || user?.subscription_type || "—"}
          </dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-cyan-400/60">Entitled</dt>
          <dd>{entitled ? "yes" : "no"}</dd>
        </div>
        {status?.subscription_current_period_end ? (
          <div className="flex justify-between gap-4">
            <dt className="text-cyan-400/60">
              {subscriptionPeriodLabel(status)}
            </dt>
            <dd>
              {formatSubscriptionDate(status.subscription_current_period_end)}
            </dd>
          </div>
        ) : null}
      </dl>

      {infoText ? (
        <p className="mt-4 font-mono text-xs text-cyan-200/80">{infoText}</p>
      ) : null}
      {errorText ? (
        <p className="mt-4 font-mono text-xs text-red-300" role="alert">
          {errorText}
        </p>
      ) : null}

      {entitled ? (
        <div className="mt-5">
          <StripeCtaButton
            verb="Manage"
            busy={busy}
            onClick={() => void onManage()}
          />
        </div>
      ) : null}
    </section>
  )
}
