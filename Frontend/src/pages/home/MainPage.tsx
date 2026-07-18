import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"

import { sharedImages } from "@/assets"
import { useAuth } from "@/app/providers/AuthProvider"
import { Tabs } from "@/components/ui/Tabs"
import { DeckListCard } from "@/components/decks/DeckListCard"
import { GlitchFx } from "@/components/effects/GlitchFx"
import { Button } from "@/components/ui/button"
import { EditBox } from "@/components/ui/EditBox"
import { ApiError } from "@/lib/api/client"
import {
  createDeck,
  fetchMyDecks,
  fetchPublicDecks,
  type DeckSummary,
} from "@/lib/api/decks"

type DeckTab = "mine" | "community"

/**
 * Logged-in home: operator profile + my decks / community public decks.
 */
export function MainPage() {
  const navigate = useNavigate()
  const { user, token, isAuthenticated } = useAuth()
  const [tab, setTab] = useState<DeckTab>("mine")
  const [myDecks, setMyDecks] = useState<DeckSummary[]>([])
  const [communityDecks, setCommunityDecks] = useState<DeckSummary[]>([])
  const [myStatus, setMyStatus] = useState<"idle" | "loading" | "ready" | "error">(
    "idle"
  )
  const [communityStatus, setCommunityStatus] = useState<
    "idle" | "loading" | "ready" | "error"
  >("idle")
  const [errorText, setErrorText] = useState("")
  const [creating, setCreating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [newName, setNewName] = useState("")
  const [newDescription, setNewDescription] = useState("")
  const [newIsPublic, setNewIsPublic] = useState(true)

  useEffect(() => {
    if (!isAuthenticated || !token) return
    if (tab !== "mine") return

    let cancelled = false
    setMyStatus("loading")
    setErrorText("")

    fetchMyDecks(token)
      .then((list) => {
        if (cancelled) return
        setMyDecks(list)
        setMyStatus("ready")
      })
      .catch((error: unknown) => {
        if (cancelled) return
        setMyStatus("error")
        if (error instanceof ApiError) {
          setErrorText(
            error.detail === "missing_bearer_token" ||
              error.detail === "invalid_token" ||
              error.detail === "token_expired"
              ? "Session expired — please log in again."
              : "Could not load your decks."
          )
        } else {
          setErrorText("Could not reach the server.")
        }
      })

    return () => {
      cancelled = true
    }
  }, [isAuthenticated, token, tab])

  useEffect(() => {
    if (tab !== "community") return

    let cancelled = false
    setCommunityStatus("loading")
    setErrorText("")

    fetchPublicDecks()
      .then((list) => {
        if (cancelled) return
        setCommunityDecks(list)
        setCommunityStatus("ready")
      })
      .catch(() => {
        if (cancelled) return
        setCommunityStatus("error")
        setErrorText("Could not load community decks.")
      })

    return () => {
      cancelled = true
    }
  }, [tab])

  function resetCreateForm() {
    setCreating(false)
    setNewName("")
    setNewDescription("")
    setNewIsPublic(true)
  }

  function onTabChange(id: string) {
    const next = id === "community" ? "community" : "mine"
    setErrorText("")
    if (next !== "mine") resetCreateForm()
    setTab(next)
  }

  async function onCreateDeck() {
    if (!token) return
    const name = newName.trim()
    if (!name) return

    setSaving(true)
    setErrorText("")
    try {
      const created = await createDeck(token, {
        name,
        description: newDescription.trim() || null,
        is_public: newIsPublic,
      })
      setMyDecks((prev) => [created, ...prev])
      setMyStatus("ready")
      if (created.is_public && communityStatus === "ready") {
        setCommunityDecks((prev) => [created, ...prev])
      }
      resetCreateForm()
      navigate(`/decks/${created.id}`)
    } catch (error) {
      setErrorText(
        error instanceof ApiError
          ? "Could not create deck."
          : "Create failed."
      )
    } finally {
      setSaving(false)
    }
  }

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

  const activeStatus = tab === "mine" ? myStatus : communityStatus
  const activeDecks = tab === "mine" ? myDecks : communityDecks

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

        <Tabs
          label="Deck archive views"
          className="mb-6"
          value={tab}
          onValueChange={onTabChange}
          items={[
            { id: "mine", label: "MY DECKS" },
            { id: "community", label: "COMMUNITY" },
          ]}
        />

        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-buahs93 text-xl text-white">
              {tab === "mine" ? "YOUR DECKS" : "COMMUNITY DECKS"}
            </h2>
            <p className="mt-1 text-sm text-white/50">
              {tab === "mine"
                ? "Create, edit, or open a deck to build."
                : "Browse public decks from other operators."}
            </p>
          </div>
          {tab === "mine" && !creating ? (
            <GlitchFx
              type="button"
              label="NEW DECK"
              disabled={saving || activeStatus === "loading"}
              className="font-buahs93 h-9 rounded-none bg-cyan-700 px-5 hover:bg-cyan-900 disabled:opacity-60"
              onClick={() => {
                setErrorText("")
                setCreating(true)
              }}
            />
          ) : null}
        </div>

        {tab === "mine" && creating && token ? (
          <div className="mb-6 border border-cyan-500/40 bg-black/60 p-5">
            <h3 className="font-buahs93 mb-3 text-sm tracking-wide text-cyan-200/80">
              NEW DECK
            </h3>
            <div className="flex flex-col gap-3">
              <EditBox
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="deck name"
                disabled={saving}
                autoFocus
              />
              <textarea
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="description (optional)"
                disabled={saving}
                rows={3}
                className="w-full border border-white/40 bg-black/80 px-3 py-2 font-mono text-sm text-white outline-none placeholder:text-white/40 focus-visible:border-white"
              />
              <label className="flex items-center gap-2 font-buahs93 text-sm text-cyan-200/80">
                <input
                  type="checkbox"
                  checked={newIsPublic}
                  onChange={(e) => setNewIsPublic(e.target.checked)}
                  disabled={saving}
                  className="accent-cyan-400"
                />
                PUBLIC
              </label>
              <div className="flex flex-wrap gap-2">
                <GlitchFx
                  type="button"
                  label={saving ? "CREATING…" : "CREATE"}
                  disabled={saving || !newName.trim()}
                  className="font-buahs93 h-9 rounded-none bg-cyan-700 px-5 hover:bg-cyan-900 disabled:opacity-60"
                  onClick={() => void onCreateDeck()}
                />
                <Button
                  className="font-buahs93 h-9 rounded-none bg-card px-4 text-sm text-white"
                  disabled={saving}
                  onClick={resetCreateForm}
                >
                  CANCEL
                </Button>
              </div>
            </div>
          </div>
        ) : null}

        {activeStatus === "loading" && (
          <p className="font-mono text-sm text-cyan-300/70">
            {tab === "mine"
              ? "Loading deck archive…"
              : "Loading community decks…"}
          </p>
        )}

        {(activeStatus === "error" || errorText) && (
          <p className="mb-4 text-sm text-red-400" role="alert">
            {errorText ||
              (tab === "mine"
                ? "Could not load your decks."
                : "Could not load community decks.")}
          </p>
        )}

        {activeStatus === "ready" &&
          activeDecks.length === 0 &&
          !(tab === "mine" && creating) && (
            <div className="border border-dashed border-cyan-500/30 bg-black/40 px-6 py-12 text-center">
              <p className="font-buahs93 text-lg text-cyan-200/80">
                {tab === "mine" ? "NO DECKS YET" : "NO PUBLIC DECKS"}
              </p>
              <p className="mt-2 text-sm text-white/50">
                {tab === "mine"
                  ? "Hit NEW DECK to start building."
                  : "When operators mark a deck public, it shows up here."}
              </p>
            </div>
          )}

        {activeStatus === "ready" && activeDecks.length > 0 ? (
          <ul className="grid gap-4 sm:grid-cols-2">
            {activeDecks.map((deck) => (
              <li key={deck.id}>
                {tab === "mine" && token ? (
                  <DeckListCard
                    deck={deck}
                    token={token}
                    canManage
                    locked={saving}
                    onBusyChange={setSaving}
                    onError={setErrorText}
                    onUpdated={(updated) => {
                      setMyDecks((prev) =>
                        prev.map((d) => (d.id === updated.id ? updated : d))
                      )
                      setCommunityDecks((prev) => {
                        if (!updated.is_public) {
                          return prev.filter((d) => d.id !== updated.id)
                        }
                        const exists = prev.some((d) => d.id === updated.id)
                        if (exists) {
                          return prev.map((d) =>
                            d.id === updated.id ? updated : d
                          )
                        }
                        if (communityStatus === "ready") {
                          return [updated, ...prev]
                        }
                        return prev
                      })
                    }}
                    onDeleted={(deckId) => {
                      setMyDecks((prev) => prev.filter((d) => d.id !== deckId))
                      setCommunityDecks((prev) =>
                        prev.filter((d) => d.id !== deckId)
                      )
                    }}
                  />
                ) : (
                  <DeckListCard deck={deck} showAuthor />
                )}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </section>
  )
}
