/**
 * Community deck browse page — shared CommunityDeckBrowser.
 */

import { useAuth } from "@/app/providers/AuthProvider"
import { sharedImages } from "@/assets/shared"
import { CommunityDeckBrowser } from "@/components/decks/CommunityDeckBrowser"

export function ComunityDecksPage() {
  const { token } = useAuth()

  return (
    <section
      className="relative min-h-screen bg-cover bg-center bg-no-repeat px-4 py-12 sm:px-6 lg:px-8 xl:px-10 2xl:px-12"
      style={{ backgroundImage: `url(${sharedImages.ZONE_BACKGROUND})` }}
    >
      <div className="absolute inset-0 bg-black/65" aria-hidden />

      <div className="relative z-10 mx-auto w-full max-w-4xl pt-8">
        <h1 className="font-glitch text-3xl text-cyan-300">COMMUNITY DECKS</h1>
        <p className="mt-2 text-sm text-white/50">
          Browse public decks — closest name, author, cards, colours, and sort.
        </p>

        <CommunityDeckBrowser token={token} className="mt-6" />
      </div>
    </section>
  )
}
