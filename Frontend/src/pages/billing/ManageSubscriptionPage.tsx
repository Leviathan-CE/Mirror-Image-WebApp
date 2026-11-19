/**
 * Manage subscription: status + Stripe Customer Portal.
 * Plan picking is /plans.
 */

import { sharedImages } from "@/assets"
import { SubscriptionSettingsPanel } from "@/components/billing/SubscriptionSettingsPanel"
import { Link } from "react-router-dom"

import { ROUTES } from "@/lib/route"

export function ManageSubscriptionPage() {
  return (
    <section
      className="relative min-h-screen bg-cover bg-center bg-no-repeat px-4 py-12 sm:px-6 lg:px-8"
      style={{ backgroundImage: `url(${sharedImages.ZONE_BACKGROUND})` }}
    >
      <div className="absolute inset-0 bg-black/70" aria-hidden />
      <div className="relative z-10 mx-auto w-full max-w-3xl pt-14">
        <header className="mb-8 border-b border-cyan-500/20 pb-5">
          <p className="font-buahs93 text-xs tracking-widest text-cyan-400/70">
            ACCOUNT
          </p>
          <h1 className="font-glitch mt-1 text-3xl text-cyan-300 sm:text-4xl">
            SUBSCRIPTION
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-white/55">
            View your status or open the Stripe portal to update payment
            methods and cancel.{" "}
            <Link
              to={ROUTES.PLANS}
              className="text-cyan-300/90 underline-offset-2 hover:underline"
            >
              Browse plans
            </Link>
            .
          </p>
        </header>

        <SubscriptionSettingsPanel />
      </div>
    </section>
  )
}
