/**
 * Plans page: three-tier picker. Payment is /plans/pay/:offerId.
 * Manage billing lives on /subscription.
 */

import { sharedImages } from "@/assets"
import { SubscriptionTierBar } from "@/components/billing/SubscriptionTierBar"

export function PlansPage() {
  return (
    <section
      className="relative min-h-screen bg-cover bg-center bg-no-repeat px-4 py-12 sm:px-6 lg:px-8"
      style={{ backgroundImage: `url(${sharedImages.ZONE_BACKGROUND})` }}
    >
      <div className="absolute inset-0 bg-black/70" aria-hidden />
      <div className="relative z-10 mx-auto w-full max-w-6xl pt-14">
        <header className="mb-8 border-b border-cyan-500/20 pb-5">
          <p className="font-buahs93 text-xs tracking-widest text-cyan-400/70">
            SUPPORT
          </p>
          <h1 className="font-glitch mt-1 text-3xl text-cyan-300 sm:text-4xl">
            PLANS
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-white/55">
            Fund Alpha development and unlock supporter perks — print
            downloads, duplex backs on higher tiers, and Playtester with
            friends.
          </p>
        </header>

        <h2 className="font-buahs93 mb-4 text-sm tracking-wide text-cyan-100">
          CHOOSE A TIER
        </h2>
        <SubscriptionTierBar />
      </div>
    </section>
  )
}
