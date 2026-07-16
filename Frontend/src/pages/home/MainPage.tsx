import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"

import { sharedImages } from "@/assets"
import { useAuth } from "@/app/providers/AuthProvider"
import { GlitchFx } from "@/components/effects/GlitchFx"
import { ApiError, fetchMyDecks, type DeckSummary } from "@/lib/api"

/**
 * Logged-in home: operator profile + list of decks they own.
 */
export function MainPage() {
  const navigate = useNavigate()
  const { user, token, isAuthenticated } = useAuth()
  const [decks, setDecks] = useState<DeckSummary[]>([])
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading")
  const [errorText, setErrorText] = useState("")

  useEffect(() => {
    if (!isAuthenticated || !token) {
      setStatus("ready")
      setDecks([])
      return
    }

    let cancelled = false
    setStatus("loading")

    fetchMyDecks(token)
      .then((list) => {
        if (cancelled) return
        setDecks(list)
        setStatus("ready")
      })
      .catch((error: unknown) => {
        if (cancelled) return
        setStatus("error")
        if (error instanceof ApiError) {
          setErrorText(
            error.detail === "missing_bearer_token" ||
              error.detail === "invalid_token" ||
              error.detail === "token_expired"
              ? "Session expired — please log in again."
              : "Could not load decks."
          )
        } else {
          setErrorText("Could not reach the server.")
        }
      })

    return () => {
      cancelled = true
    }
  }, [isAuthenticated, token])

  if (!isAuthenticated || !user) {
    return (
      <section
        className="relative min-h-screen bg-cover bg-center bg-no-repeat px-6 py-16"
        style={{ backgroundImage: `url(${sharedImages.ZONE_BACKGROUND})` }}
      >
        <div className="absolute inset-0 bg-black/70" aria-hidden />
        <div className="relative z-10 mx-auto max-w-lg text-center">
          <h1 className="font-glitch text-3xl text-cyan-300">OPERATOR ACCESS</h1>
          <p className="mt-3 text-white/70">
            Sign in to view your decks and operator profile.
          </p>
          <div className="mt-6">
            <GlitchFx
              type="button"
              label="LOGIN"
              size="lg"
              className="font-buahs93 h-10 rounded-none bg-cyan-700 px-8 hover:bg-cyan-900"
              onClick={() => navigate("/login")}
            />
          </div>
        </div>
      </section>
    )
  }

  return (
    <section
      className="relative min-h-screen bg-cover bg-center bg-no-repeat px-6 py-12"
      style={{ backgroundImage: `url(${sharedImages.ZONE_BACKGROUND})` }}
    >
      <div className="absolute inset-0 bg-black/65" aria-hidden />

      <div className="relative z-10 mx-auto w-full max-w-4xl pt-8">
        <header className="mb-10 border-b border-cyan-500/20 pb-6">
          <p className="font-buahs93 text-xs tracking-widest text-cyan-400/70">
            OPERATOR
          </p>
          <h1 className="font-glitch mt-1 text-3xl text-cyan-300 sm:text-4xl">
            {user.user_name}
          </h1>
          <p className="mt-2 text-sm text-white/55">{user.email}</p>
        </header>

        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-buahs93 text-xl text-white">YOUR DECKS</h2>
            <p className="mt-1 text-sm text-white/50">
              Decks linked to this account.
            </p>
          </div>
        </div>

        {status === "loading" && (
          <p className="font-mono text-sm text-cyan-300/70">Loading deck archive…</p>
        )}

        {status === "error" && (
          <p className="text-sm text-red-400" role="alert">
            {errorText}
          </p>
        )}

        {status === "ready" && decks.length === 0 && (
          <div className="border border-dashed border-cyan-500/30 bg-black/40 px-6 py-12 text-center">
            <p className="font-buahs93 text-lg text-cyan-200/80">NO DECKS YET</p>
            <p className="mt-2 text-sm text-white/50">
              Build your first list when the deck editor comes online.
            </p>
          </div>
        )}

        {status === "ready" && decks.length > 0 && (
          <ul className="grid gap-4 sm:grid-cols-2">
            {decks.map((deck) => (
              <li key={deck.id}>
                <article className="h-full border border-cyan-500/25 bg-black/50 p-5 transition-colors hover:border-cyan-400/50">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-buahs93 text-lg text-cyan-100">
                      {deck.name ?? `Deck #${deck.id}`}
                    </h3>
                    <span
                      className={
                        deck.is_public
                          ? "shrink-0 text-[10px] tracking-wide text-emerald-400/90"
                          : "shrink-0 text-[10px] tracking-wide text-white/40"
                      }
                    >
                      {deck.is_public ? "PUBLIC" : "PRIVATE"}
                    </span>
                  </div>
                  {deck.description ? (
                    <p className="mt-2 line-clamp-3 text-sm leading-snug text-white/55">
                      {deck.description}
                    </p>
                  ) : null}
                  <p className="mt-4 font-mono text-xs text-cyan-300/60">
                    {deck.card_count} cards
                  </p>
                </article>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
