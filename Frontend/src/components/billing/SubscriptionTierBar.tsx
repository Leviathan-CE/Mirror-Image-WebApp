/**
 * Horizontal three-tier subscription picker for the Subscribe page.
 */

import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"

import { GlitchFx } from "@/components/effects/GlitchFx"
import {
  fetchBillingPlans,
  type BillingPlan,
} from "@/lib/api/billing"
import { ROUTES } from "@/lib/route"
import { cn } from "@/lib/utils"

type SubscriptionTierBarProps = {
  disabled?: boolean
  highlightedOfferId?: string | null
}

export function SubscriptionTierBar({
  disabled = false,
  highlightedOfferId = null,
}: SubscriptionTierBarProps) {
  const navigate = useNavigate()
  const [plans, setPlans] = useState<BillingPlan[]>([])
  const [stripeReady, setStripeReady] = useState(false)
  const [loadError, setLoadError] = useState("")

  useEffect(() => {
    let cancelled = false
    void fetchBillingPlans()
      .then((data) => {
        if (cancelled) return
        setPlans(data.plans)
        setStripeReady(data.stripe_configured)
      })
      .catch(() => {
        if (!cancelled) {
          setLoadError("Could not load subscription plans.")
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (loadError) {
    return (
      <p className="font-mono text-sm text-red-300" role="alert">
        {loadError}
      </p>
    )
  }

  if (plans.length === 0) {
    return (
      <p className="font-mono text-[11px] text-cyan-100/50">
        Loading plans…
      </p>
    )
  }

  return (
    <div className="space-y-3">
      <div
        className={cn(
          "mi-scrollbar flex gap-3 overflow-x-auto pb-2",
          "lg:grid lg:grid-cols-3 lg:overflow-visible lg:pb-0"
        )}
      >
        {plans.map((plan) => {
          const featured = plan.offer_id === "level3_warmachine"
          const active = plan.offer_id === highlightedOfferId
          return (
            <article
              key={plan.offer_id}
              className={cn(
                "flex min-w-[16rem] flex-1 flex-col border p-4",
                "bg-black/55 lg:min-w-0",
                featured
                  ? "border-cyan-400/50"
                  : "border-cyan-500/25",
                active && "ring-1 ring-cyan-300/60"
              )}
            >
              <h3 className="font-buahs93 text-sm tracking-wide text-cyan-100">
                {plan.name}
              </h3>
              <p className="font-glitch mt-2 text-2xl text-white">
                {plan.price_display}
              </p>
              <p className="mt-2 font-mono text-[11px] text-cyan-100/55">
                {plan.tagline}
              </p>
              <ul className="mt-4 flex-1 space-y-2">
                {plan.features.map((feature) => (
                  <li
                    key={feature}
                    className={cn(
                      "flex gap-2 font-mono text-xs",
                      "text-cyan-50/85"
                    )}
                  >
                    <span className="text-cyan-400/70" aria-hidden>
                      ▸
                    </span>
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              <GlitchFx
                type="button"
                label="SUBSCRIBE"
                disabled={
                  disabled
                  || !stripeReady
                  || !plan.price_configured
                }
                className={cn(
                  "font-buahs93 mt-5 h-9 w-full rounded-none",
                  featured
                    ? "bg-cyan-700 text-white hover:bg-cyan-900"
                    : (
                      "border border-cyan-500/40 bg-black/70 "
                      + "text-cyan-100 hover:bg-cyan-500/10"
                    ),
                  "disabled:opacity-60"
                )}
                onClick={() => {
                  navigate(ROUTES.plansPay(plan.offer_id))
                }}
              />
              {!plan.price_configured ? (
                <p className="mt-2 font-mono text-[10px] text-amber-200/80">
                  Price id not configured for this tier.
                </p>
              ) : null}
            </article>
          )
        })}
      </div>
      {!stripeReady ? (
        <p className="font-mono text-[11px] text-amber-200/80">
          Stripe is not fully configured — add secret key and at least
          one STRIPE_PRICE_ID_LVL_* value, then recreate the API.
        </p>
      ) : null}
    </div>
  )
}
