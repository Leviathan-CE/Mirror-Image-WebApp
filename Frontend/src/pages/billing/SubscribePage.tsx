/**
 * Account subscription page — Standard Supporter plan + Stripe Checkout.
 * Preview cards + Playtester unlocks gate on entitlement once those features ship.
 */

import { useEffect, useState } from "react"
import { useSearchParams } from "react-router-dom"

import { useAuth } from "@/app/providers/AuthProvider"
import { sharedImages } from "@/assets"
import { Button } from "@/components/ui/button"
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

const primaryActionClassName =
  "font-buahs93 h-10 rounded-none bg-cyan-700 px-6 text-sm text-white hover:bg-cyan-900 disabled:opacity-60"

const secondaryActionClassName =
  "font-buahs93 h-10 rounded-none border border-cyan-500/35 bg-black/70 px-5 text-sm text-cyan-100 hover:border-cyan-400/60 hover:bg-cyan-500/10 hover:text-white disabled:opacity-60"

export function SubscribePage() {
  const { token, user, setSession } = useAuth()
  const [params] = useSearchParams()
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
      setInfoText(
        "Payment complete — syncing your subscription…"
      )
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

    // After Checkout, pull Stripe → DB so entitlement works even if the webhook
    // was missed (common locally when `stripe listen` is not running).
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
        // Refresh /auth/me so header/gates see the new entitlement.
        try {
          const fresh = await fetchCurrentUser(token)
          if (!cancelled) setSession(token, fresh)
        } catch {
          /* keep existing session */
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
  }, [token, setSession, params])

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
          setErrorText("Admins already have full access — no subscription needed.")
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
    <section
      className="relative min-h-screen bg-cover bg-center bg-no-repeat px-4 py-12 sm:px-6"
      style={{ backgroundImage: `url(${sharedImages.ZONE_BACKGROUND})` }}
    >
      <div className="absolute inset-0 bg-black/70" aria-hidden />
      <div className="relative z-10 mx-auto w-full max-w-xl pt-14">
        <header className="mb-8 border-b border-cyan-500/20 pb-5">
          <p className="font-buahs93 text-xs tracking-widest text-cyan-400/70">
            ACCOUNT
          </p>
          <h1 className="font-glitch mt-1 text-3xl text-cyan-300 sm:text-4xl">
            SUBSCRIBE
          </h1>
          <p className="mt-2 text-sm text-white/55">
            {plan?.tagline ??
              "Support Mirror Image development and unlock early-access play spaces."}
          </p>
        </header>

        <article className="mb-4 border border-cyan-500/25 bg-black/55 p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 className="font-buahs93 text-xl text-cyan-200">
              {plan?.name ?? "Standard Supporter"}
            </h2>
            <p className="font-glitch text-2xl text-white">
              {plan?.price_display ?? "…"}
            </p>
          </div>
          <p className="mt-1 font-mono text-[10px] uppercase tracking-wide text-cyan-400/55">
            tier · {plan?.type ?? "standard supporter"}
          </p>

          <ul className="mt-5 space-y-2 border-t border-cyan-500/15 pt-4">
            {(plan?.features ?? [
              "Access preview cards still in design",
              "Play with friends in the Playtester",
            ]).map((feature) => (
              <li
                key={feature}
                className="flex gap-2 font-mono text-xs text-cyan-50/85"
              >
                <span className="text-cyan-400/70" aria-hidden>
                  ▸
                </span>
                <span>
                  {feature}
                  <span className="ml-2 text-white/35"></span>
                </span>
              </li>
            ))}
          </ul>
        </article>

        <div className="border border-cyan-500/25 bg-black/55 p-5">
          <dl className="space-y-2 font-mono text-xs text-cyan-100/80">
            <div className="flex justify-between gap-4">
              <dt className="text-cyan-400/60">Status</dt>
              <dd
                className={cn(
                  entitled ? "text-emerald-300/90" : "text-white/55"
                )}
              >
                {status?.subscription_status ??
                  user?.subscription_status ??
                  "none"}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-cyan-400/60">Type</dt>
              <dd>
                {status?.subscription_type ||
                  user?.subscription_type ||
                  "—"}
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
                  {formatSubscriptionDate(
                    status.subscription_current_period_end
                  )}
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

          <div className="mt-6 flex flex-wrap gap-3">
            {!entitled ? (
              <Button
                type="button"
                className={primaryActionClassName}
                disabled={busy || !stripeReady}
                onClick={() => void onSubscribe()}
              >
                {busy ? "REDIRECTING…" : "BECOME A SUPPORTER"}
              </Button>
            ) : null}
            <Button
              type="button"
              className={secondaryActionClassName}
              disabled={busy}
              onClick={() => void onManage()}
            >
              MANAGE BILLING
            </Button>
          </div>

          {!stripeReady ? (
            <p className="mt-4 font-mono text-[11px] text-amber-200/80">
              Server is missing STRIPE_SECRET_KEY / STRIPE_PRICE_ID. Add them to
              your `.env`, then rebuild the API.
            </p>
          ) : null}
        </div>
      </div>
    </section>
  )
}
