/**
 * Payment step after choosing a subscription tier.
 * Dual path: Stripe Checkout redirect + on-site Payment Element.
 */

import { useEffect, useRef, useState } from "react"
import { Link, useParams, useSearchParams } from "react-router-dom"

import { useAuth } from "@/app/providers/AuthProvider"
import { StripePaymentForm } from "@/components/billing/StripePaymentForm"
import { StripeCtaButton } from "@/components/billing/StripeWordmark"
import { PrivacyNotice } from "@/components/legal/PrivacyNotice"
import { sharedImages } from "@/assets"
import { ApiError } from "@/lib/api/client"
import { fetchCurrentUser } from "@/lib/api/auth"
import {
  createCheckoutSession,
  createSubscriptionIntent,
  fetchBillingConfig,
  fetchBillingPlans,
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
import { isUserSubscribed } from "@/lib/subscription.logic"
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
  return last as BillingStatus
}

export function SubscribePayPage() {
  const { offerId = "" } = useParams()
  const [params, setParams] = useSearchParams()
  const { token, user, setSession } = useAuth()

  const [plan, setPlan] = useState<BillingPlan | null>(null)
  const [busy, setBusy] = useState(false)
  const [intentLoading, setIntentLoading] = useState(false)
  const [errorText, setErrorText] = useState("")
  const [infoText, setInfoText] = useState("")
  const [publishableKey, setPublishableKey] = useState("")
  const [clientSecret, setClientSecret] = useState("")

  const entitled = isUserSubscribed(user)
  const elementReady = Boolean(publishableKey && clientSecret)
  const intentRequestId = useRef(0)

  useEffect(() => {
    if (repairBillingReturnOrigin()) return
  }, [])

  useEffect(() => {
    let cancelled = false
    void fetchBillingPlans()
      .then((data) => {
        if (cancelled) return
        const match = data.plans.find((p) => p.offer_id === offerId)
        setPlan(match ?? null)
        if (!match) {
          setErrorText("Unknown subscription plan.")
        }
      })
      .catch(() => {
        if (!cancelled) setErrorText("Could not load plan.")
      })
    return () => {
      cancelled = true
    }
  }, [offerId])

  useEffect(() => {
    if (!token) return
    if (params.get("success") !== "1") return

    let cancelled = false
    setInfoText("Payment complete — syncing your subscription…")
    void syncUntilEntitled(token)
      .then(async (status) => {
        if (cancelled) return
        try {
          const me = await fetchCurrentUser(token)
          setSession(token, me)
        } catch {
          /* keep session */
        }
        if (status.is_subscribed) {
          setInfoText("Subscription active. Thank you for the support.")
          clearBillingReturn()
          const next = new URLSearchParams(params)
          next.delete("success")
          setParams(next, { replace: true })
        } else {
          setInfoText(
            "Payment received — refresh in a moment if perks are not visible yet."
          )
        }
      })
      .catch(() => {
        if (!cancelled) {
          setInfoText(
            "Payment may have succeeded, but sync failed. Refresh shortly."
          )
        }
      })
    return () => {
      cancelled = true
    }
  }, [token, params, setParams, setSession])

  useEffect(() => {
    if (params.get("canceled") === "1") {
      setInfoText("Checkout canceled. You can try again anytime.")
      clearBillingReturn()
    }
  }, [params])

  function mapSubscribeError(error: unknown): string {
    if (error instanceof ApiError) {
      if (error.detail === "admin_already_entitled") {
        return "Admins already have full access — no subscription needed."
      }
      if (error.detail === "stripe_not_configured") {
        return "Stripe is not configured on the server yet."
      }
      if (error.detail === "stripe_publishable_key_missing") {
        return "Add STRIPE_PUBLISHABLE_KEY for on-site pay."
      }
      if (error.detail === "stripe_price_missing_for_offer") {
        return "This tier’s Stripe price id is missing in .env."
      }
      return error.detail || "Could not start checkout."
    }
    return "Could not reach the server."
  }

  useEffect(() => {
    if (!token || !offerId) return
    if (!plan?.price_configured) return
    if (params.get("success") === "1") return

    const requestId = intentRequestId.current + 1
    intentRequestId.current = requestId
    setIntentLoading(true)
    setErrorText("")
    setInfoText("")
    setClientSecret("")
    setPublishableKey("")

    void (async () => {
      try {
        const [config, intent] = await Promise.all([
          fetchBillingConfig(),
          createSubscriptionIntent(token, offerId),
        ])
        if (intentRequestId.current !== requestId) return

        if (intent.already_on_plan) {
          setClientSecret("")
          setPublishableKey("")
          setInfoText("You are already on this plan.")
          try {
            await syncBillingFromStripe(token)
            const me = await fetchCurrentUser(token)
            if (intentRequestId.current !== requestId) return
            setSession(token, me)
          } catch {
            /* keep session — status may still be stale */
          }
          return
        }

        if (intent.payment_required === false || !intent.client_secret) {
          setClientSecret("")
          setPublishableKey("")
          setInfoText("Plan updated — syncing your subscription…")
          try {
            const next = await syncUntilEntitled(token)
            const me = await fetchCurrentUser(token)
            if (intentRequestId.current !== requestId) return
            setSession(token, me)
            setInfoText(
              next.is_subscribed
                ? "Plan updated. Your new tier is active."
                : "Plan change saved — refresh if perks look stale."
            )
          } catch {
            if (intentRequestId.current === requestId) {
              setInfoText(
                "Plan change may have completed — refresh in a moment."
              )
            }
          }
          return
        }

        if (!config.publishable_key) {
          setErrorText("Add STRIPE_PUBLISHABLE_KEY for on-site pay.")
          return
        }
        setPublishableKey(config.publishable_key)
        setClientSecret(intent.client_secret)
      } catch (error: unknown) {
        if (intentRequestId.current === requestId) {
          setClientSecret("")
          setPublishableKey("")
          setErrorText(mapSubscribeError(error))
        }
      } finally {
        if (intentRequestId.current === requestId) {
          setIntentLoading(false)
        }
      }
    })()
  }, [token, offerId, plan?.price_configured, params, setSession])

  async function onCheckout() {
    if (!token || !offerId || busy) return
    setBusy(true)
    setErrorText("")
    try {
      rememberBillingReturn(
        `${ROUTES.plansPay(offerId)}?success=1`
      )
      const { url } = await createCheckoutSession(token, offerId)
      window.location.assign(url)
    } catch (error: unknown) {
      setBusy(false)
      clearBillingReturn()
      setErrorText(mapSubscribeError(error))
    }
  }

  async function onElementPaid() {
    if (!token) return
    setInfoText("Payment complete — syncing your subscription…")
    setClientSecret("")
    try {
      const next = await syncUntilEntitled(token)
      const me = await fetchCurrentUser(token)
      setSession(token, me)
      if (next.is_subscribed) {
        setInfoText("Subscription active. Thank you for the support.")
      }
    } catch {
      setInfoText(
        "Payment received — refresh in a moment if perks are not visible yet."
      )
    }
  }

  return (
    <section
      className={cn(
        "relative min-h-screen bg-cover bg-center bg-no-repeat",
        "px-4 py-12 sm:px-6 lg:px-8"
      )}
      style={{ backgroundImage: `url(${sharedImages.ZONE_BACKGROUND})` }}
    >
      <div className="absolute inset-0 bg-black/70" aria-hidden />
      <div className="relative z-10 mx-auto w-full max-w-xl pt-14">
        <p className="mb-4">
          <Link
            to={ROUTES.PLANS}
            className="font-mono text-xs text-cyan-300/80 hover:text-cyan-200"
          >
            ← Back to plans
          </Link>
        </p>
        <header className="mb-6 border-b border-cyan-500/20 pb-4">
          <p className="font-buahs93 text-xs tracking-widest text-cyan-400/70">
            PAYMENT
          </p>
          <h1 className="font-glitch mt-1 text-3xl text-cyan-300">
            {plan?.name ?? "SUBSCRIBE"}
          </h1>
          {plan ? (
            <p className="mt-2 font-mono text-sm text-white/60">
              {plan.price_display}
            </p>
          ) : null}
        </header>

        <div className="border border-cyan-500/25 bg-black/50 p-5">
          {entitled ? (
            <p className="mb-3 font-mono text-[11px] text-cyan-100/55">
              You already have a subscription — pay for the new plan to
              switch. Your current plan stays active until payment succeeds.
            </p>
          ) : (
            <p className="font-mono text-[11px] text-cyan-100/55">
              Pay on this site. Card details are handled by Stripe — we
              never see your full card number. Billing status is stored
              on your account.
            </p>
          )}
          <div className="mt-2">
            <PrivacyNotice />
          </div>
          {intentLoading ? (
            <p className="mt-4 font-mono text-[11px] text-cyan-100/50">
              Preparing secure payment…
            </p>
          ) : null}
          {elementReady ? (
            <StripePaymentForm
              publishableKey={publishableKey}
              clientSecret={clientSecret}
              submitLabel={entitled ? "UPDATE PLAN" : "SUBSCRIBE"}
              disabled={busy || intentLoading}
              onPaid={() => void onElementPaid()}
              onError={(message) => setErrorText(message)}
            />
          ) : null}

          <div className="mt-8 border-t border-cyan-500/20 pt-5">
            <p className="font-buahs93 text-[10px] tracking-wide text-cyan-400/60">
              ALTERNATE OPTIONS
            </p>
            <p className="mt-1 font-mono text-[11px] text-cyan-100/45">
              Prefer Stripe’s hosted page instead.
            </p>
            <div className="mt-3">
              <StripeCtaButton
                verb="Subscribe"
                busy={busy}
                disabled={!plan?.price_configured || intentLoading}
                onClick={() => void onCheckout()}
              />
            </div>
          </div>
        </div>

        {infoText ? (
          <p className="mt-4 font-mono text-[11px] text-cyan-100/70">
            {infoText}
          </p>
        ) : null}
        {errorText ? (
          <p className="mt-3 font-mono text-[11px] text-red-300" role="alert">
            {errorText}
          </p>
        ) : null}
      </div>
    </section>
  )
}
