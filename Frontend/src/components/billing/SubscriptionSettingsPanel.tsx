/**
 * Subscription / billing block for Account Settings.
 * Handles Stripe checkout return query params (?success=1 / ?canceled=1).
 */

import { useEffect, useState } from "react"
import { useSearchParams } from "react-router-dom"

import { useAuth } from "@/app/providers/AuthProvider"
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
  formatSubscriptionDate,
  isUserSubscribed,
  subscriptionPeriodLabel,
} from "@/lib/subscription.logic"
import { cn } from "@/lib/utils"

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

  useEffect(() => {
    if (params.get("success") === "1") {
      setInfoText("Payment complete — syncing your subscription…")
    } else if (params.get("canceled") === "1") {
      setInfoText("Checkout canceled. You can try again anytime.")
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

    const statusPromise = afterCheckout
      ? syncBillingFromStripe(token)
      : fetchBillingStatus(token)

    void statusPromise
      .then(async (data) => {
        if (cancelled) return
        setStatus(data)
        if (afterCheckout && data.is_subscribed) {
          setInfoText("Payment complete — subscription is active.")
        }
        try {
          const fresh = await fetchCurrentUser(token)
          if (!cancelled) setSession(token, fresh)
        } catch {
          /* keep existing session */
        }
        if (afterCheckout || params.get("canceled") === "1") {
          const next = new URLSearchParams(params)
          next.delete("success")
          next.delete("canceled")
          setParams(next, { replace: true })
        }
      })
      .catch(() => {
        if (!cancelled) {
          setStatus(null)
          if (afterCheckout) {
            setInfoText(
              "Payment may have succeeded, but we could not sync yet. Refresh in a moment."
            )
          }
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
  }, [token, setSession, params, setParams])

  async function onSubscribe() {
    if (!token) return
    setBusy(true)
    setErrorText("")
    try {
      const { url } = await createCheckoutSession(token)
      window.location.assign(url)
    } catch (error: unknown) {
      setBusy(false)
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
      const { url } = await createPortalSession(token)
      window.location.assign(url)
    } catch (error: unknown) {
      setBusy(false)
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

      <div className="mt-5 flex flex-wrap gap-3">
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
