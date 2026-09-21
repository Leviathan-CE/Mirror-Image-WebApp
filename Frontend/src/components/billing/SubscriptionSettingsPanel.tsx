/**
 * Subscription / billing block for the Subscribe page.
 * Handles Stripe checkout return query params (?success=1 / ?canceled=1).
 */

import { useEffect, useState } from "react"
import { useSearchParams } from "react-router-dom"

import { useAuth } from "@/app/providers/AuthProvider"
import { PayWithStripe } from "@/components/billing/StripeWordmark"
import { GlitchFx } from "@/components/effects/GlitchFx"
import { ApiError } from "@/lib/api/client"
import { fetchCurrentUser } from "@/lib/api/auth"
import {
  createCheckoutSession,
  createPortalSession,
  fetchBillingPlan,
  fetchBillingStatus,
  syncBillingFromStripe,
  type BillingPlan,
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

/** Webhooks can lag locally — pull Stripe a few times before giving up. */
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
  const [plan, setPlan] = useState<BillingPlan | null>(null)
  const [status, setStatus] = useState<BillingStatus | null>(null)
  const [busy, setBusy] = useState(false)
  const [errorText, setErrorText] = useState("")
  const [infoText, setInfoText] = useState("")

  const entitled = isUserSubscribed(user) || Boolean(status?.is_subscribed)
  const stripeReady =
    plan?.stripe_configured ?? status?.stripe_configured ?? false

  // If Stripe returned on 127.0.0.1 but we left from localhost (or vice versa),
  // jump back so the JWT in localStorage is on this origin again.
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
    let cancelled = false
    void fetchBillingPlan()
      .then((data) => {
        if (!cancelled) setPlan(data)
      })
      .catch(() => {
        if (!cancelled) setPlan(null)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!token) return

    let cancelled = false
    const afterCheckout = params.get("success") === "1"
    const afterCancel = params.get("canceled") === "1"

    const statusPromise = afterCheckout
      ? syncUntilEntitled(token)
      : fetchBillingStatus(token)

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
              "Payment received — still waiting for Stripe to confirm. You can refresh this page in a moment."
            )
          }
        }
        try {
          const fresh = await fetchCurrentUser(token)
          if (!cancelled) setSession(token, fresh)
        } catch {
          /* keep existing session — never treat sync UI as logout */
        }
        // Only strip query flags once we know entitlement (or cancel).
        if (afterCancel || (afterCheckout && data.is_subscribed)) {
          const next = new URLSearchParams(params)
          next.delete("success")
          next.delete("canceled")
          setParams(next, { replace: true })
        }
      })
      .catch((error: unknown) => {
        if (cancelled) return
        if (afterCheckout) {
          const detail =
            error instanceof ApiError ? error.detail : "billing_sync_failed"
          setInfoText(
            `Payment may have succeeded, but sync failed (${detail}). Stay on this page and refresh — do not check out again yet.`
          )
        }
      })

    if (!afterCheckout) {
      void fetchCurrentUser(token)
        .then((fresh) => {
          if (!cancelled) setSession(token, fresh)
        })
        .catch(() => {
          /* keep existing session */
        })
    }

    return () => {
      cancelled = true
    }
  }, [token, setSession, setParams, params])

  async function onSubscribe() {
    if (!token) return
    setBusy(true)
    setErrorText("")
    try {
      rememberBillingReturn(`${ROUTES.SUBSCRIBE}?success=1`)
      const { url } = await createCheckoutSession(token)
      window.location.assign(url)
    } catch (error: unknown) {
      setBusy(false)
      clearBillingReturn()
      if (error instanceof ApiError) {
        if (error.detail === "already_subscribed") {
          setErrorText("You already have an active subscription.")
        } else if (error.detail === "admin_already_entitled") {
          setErrorText(
            "Admins already have full access — no subscription needed."
          )
        } else if (error.detail === "stripe_not_configured") {
          setErrorText(
            "Stripe is not configured on the server yet (missing keys / price id)."
          )
        } else {
          setErrorText("Could not start checkout.")
        }
      } else {
        setErrorText("Could not reach the server.")
      }
    }
  }

  async function onManage() {
    if (!token) return
    setBusy(true)
    setErrorText("")
    try {
      rememberBillingReturn(ROUTES.SUBSCRIBE)
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
        SUBSCRIPTION
      </h2>
      <p className="mt-1 font-mono text-[11px] text-cyan-100/45">
        {plan?.tagline ??
          "Support Mirror Image and unlock early-access play spaces."}
      </p>

      <div className="mt-4 flex flex-wrap items-baseline justify-between gap-3 border border-cyan-500/15 bg-black/40 p-4">
        <div>
          <h3 className="font-buahs93 text-base text-cyan-200">
            {plan?.name ?? "Standard Supporter"}
          </h3>
          <p className="mt-1 font-mono text-[10px] uppercase tracking-wide text-cyan-400/55">
            tier · {plan?.type ?? "standard supporter"}
          </p>
        </div>
        <p className="font-glitch text-2xl text-white">
          {plan?.price_display ?? "…"}
        </p>
      </div>

      <ul className="mt-4 space-y-2">
        {(
          plan?.features ?? [
            "Access preview cards still in design",
            "Create duplex print-and-play PDFs from your decks",
            "Play with friends in the Playtester",
          ]
        ).map((feature) => (
          <li
            key={feature}
            className="flex gap-2 font-mono text-xs text-cyan-50/85"
          >
            <span className="text-cyan-400/70" aria-hidden>
              ▸
            </span>
            <span>{feature}</span>
          </li>
        ))}
      </ul>

      <dl className="mt-4 space-y-2 border-t border-cyan-500/15 pt-4 font-mono text-xs text-cyan-100/80">
        <div className="flex justify-between gap-4">
          <dt className="text-cyan-400/60">Status</dt>
          <dd
            className={cn(entitled ? "text-emerald-300/90" : "text-white/55")}
          >
            {status?.subscription_status ?? user?.subscription_status ?? "none"}
          </dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-cyan-400/60">Type</dt>
          <dd>{status?.subscription_type || user?.subscription_type || "—"}</dd>
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

      <div className="mt-5 flex flex-wrap items-center gap-3">
        {!entitled ? (
          <GlitchFx
            type="button"
            label={busy ? "REDIRECTING…" : "BECOME A SUPPORTER"}
            disabled={busy || !stripeReady}
            className="font-buahs93 h-9 rounded-none bg-cyan-700 px-5 hover:bg-cyan-900 disabled:opacity-60"
            onClick={() => void onSubscribe()}
          />
        ) : (
          <GlitchFx
            type="button"
            label="MANAGE BILLING"
            disabled={busy}
            className="font-buahs93 h-9 rounded-none border border-cyan-500/40 bg-black/70 px-5 text-cyan-100 hover:border-cyan-400/70 hover:bg-cyan-500/10 disabled:opacity-60"
            onClick={() => void onManage()}
          />
        )}
        <PayWithStripe verb={entitled ? "Manage with" : "Pay with"} />
      </div>

      {!stripeReady ? (
        <p className="mt-4 font-mono text-[11px] text-amber-200/80">
          Server is missing STRIPE_SECRET_KEY / STRIPE_PRICE_ID. Add them to
          your `.env`, then rebuild the API.
        </p>
      ) : null}
    </section>
  )
}
