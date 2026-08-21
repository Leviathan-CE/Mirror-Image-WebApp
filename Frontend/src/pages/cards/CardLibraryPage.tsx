/**
 * Card library browser — search + filters over the full card DB.
 */

import { useAuth } from "@/app/providers/AuthProvider"
import { sharedImages } from "@/assets"
import { CardLibraryBrowser } from "@/components/cards/CardLibraryBrowser"

export function CardLibraryPage() {
  const { token } = useAuth()

  return (
    <section
      className="relative min-h-screen bg-cover bg-center bg-no-repeat px-4 py-10 sm:px-6"
      style={{ backgroundImage: `url(${sharedImages.ZONE_BACKGROUND})` }}
    >
      <div className="absolute inset-0 bg-black/70" aria-hidden />

      <div className="relative z-10 mx-auto w-full max-w-6xl pt-6">
        <header className="mb-8 border-b border-cyan-500/20 pb-5">
          <p className="font-buahs93 text-xs tracking-widest text-cyan-400/70">
            ARCHIVE
          </p>
          <h1 className="font-glitch mt-1 text-3xl text-cyan-300 sm:text-4xl">
            CARD LIBRARY
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-white/55">
            Search by name (closest match), filter by cost colors, invoke cost,
            type line, super/sub types, and rules text.
          </p>
        </header>

        <CardLibraryBrowser token={token} />
      </div>
    </section>
  )
}
