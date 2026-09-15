/**
 * Dedicated Subscribe / supporter page (not buried in Account settings).
 * Hosts Stripe checkout return handling via SubscriptionSettingsPanel.
 */

import { sharedImages } from "@/assets"
import { SubscriptionSettingsPanel } from "@/components/billing/SubscriptionSettingsPanel"

export function SubscribePage() {
  return (
    <section
      className="relative min-h-screen bg-cover bg-center bg-no-repeat px-4 py-12 sm:px-6 lg:px-8"
      style={{ backgroundImage: `url(${sharedImages.ZONE_BACKGROUND})` }}
    >
      <div className="absolute inset-0 bg-black/70" aria-hidden />
      <div className="relative z-10 mx-auto w-full max-w-3xl pt-14">
        <header className="mb-8 border-b border-cyan-500/20 pb-5">
          <p className="font-buahs93 text-xs tracking-widest text-cyan-400/70">
            SUPPORT
          </p>
          <h1 className="font-glitch mt-1 text-3xl text-cyan-300 sm:text-4xl">
            SUBSCRIBE
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-white/55">
            Fund Alpha development and unlock supporter perks — preview cards
            and Playtester with friends.
          </p>
        </header>

        <SubscriptionSettingsPanel />
      </div>
    </section>
  )
}
