import { useEffect, useState } from "react"

import { sharedImages } from "@/assets/shared"
import { DeckListCard } from "@/components/decks/DeckListCard"
import { fetchPublicDecks, type DeckSummary } from "@/lib/api/decks"

export function ComunityDecksPage() {
  const [decks, setDecks] = useState<DeckSummary[]>([])
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading")

  useEffect(() => {
    let cancelled = false
    setStatus("loading")

    fetchPublicDecks()
      .then((list) => {
        if (cancelled) return
        setDecks(list)
        setStatus("ready")
      })
      .catch(() => {
        if (cancelled) return
        setStatus("error")
      })

    return () => {
      cancelled = true
    }
  }, [])

  return (
    <section
      className="relative min-h-screen bg-cover bg-center bg-no-repeat px-4 py-12 sm:px-6 lg:px-8 xl:px-10 2xl:px-12"
      style={{ backgroundImage: `url(${sharedImages.ZONE_BACKGROUND})` }}
    >
      <div className="absolute inset-0 bg-black/65" aria-hidden />

      <div className="relative z-10 mx-auto w-full max-w-4xl pt-8">
        <h1 className="font-glitch text-3xl text-cyan-300">COMMUNITY DECKS</h1>
        <p className="mt-2 text-sm text-white/50">
          Browse public decks from other operators.
        </p>

        {status === "loading" && <p>Loading community decks…</p>}
        {status === "error" && (
          <p role="alert">Could not load community decks.</p>
        )}
        {status === "ready" && decks.length === 0 && <p>NO PUBLIC DECKS</p>}
        {status === "ready" && decks.length > 0 && (
          <ul className="mt-6 grid gap-4 sm:grid-cols-2">
            {decks.map((deck) => (
              <li key={deck.id}>
                <DeckListCard deck={deck} showAuthor />
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
