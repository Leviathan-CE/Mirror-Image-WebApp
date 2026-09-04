import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"

import { sharedImages } from "@/assets"
import { useAuth } from "@/app/providers/AuthProvider"
import { useUserPreferences } from "@/app/providers/PreferencesProvider"
import { Tabs } from "@/components/ui/Tabs"
import { CommunityDeckBrowser } from "@/components/decks/CommunityDeckBrowser"
import { DeckListCard } from "@/components/decks/DeckListCard"
import { GlitchFx } from "@/components/effects/GlitchFx"
import {
  PublicTextArea,
  PublicTextField,
} from "@/components/ui/PublicTextField"
import { ApiError } from "@/lib/api/client"
import { createDeck, fetchMyDecks, type DeckSummary } from "@/lib/api/decks"
import {
  isPublicTextClean,
  PROFANITY_REJECTED,
  PUBLIC_TEXT_BLOCKED_MESSAGE,
} from "@/lib/profanity"
import { readLocalPreferences } from "@/lib/userPreferences.logic"
import { ROUTES } from "@/lib/route"

type DeckTab = "mine" | "community"

type FetchStatus = "idle" | "loading" | "ready" | "error"

/** Show loading on first fetch (idle) without syncing setState inside an effect. */
function tabFetchStatus(
  status: FetchStatus,
  shouldFetch: boolean
): FetchStatus {
  if (!shouldFetch) return status
  if (status === "idle") return "loading"
  return status
}

/**
 * Logged-in home: operator profile + my decks / community public decks.
 */
export function MainPage() {
  const navigate = useNavigate()
  const { user, token, isAuthenticated } = useAuth()
  const { flushServerPrefs } = useUserPreferences()
  const [tab, setTab] = useState<DeckTab>("mine")
  const [myDecks, setMyDecks] = useState<DeckSummary[]>([])
  const [myStatus, setMyStatus] = useState<FetchStatus>("idle")
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
    else if (isAuthenticated && token) setMyStatus("loading")
    setTab(next)
  }

  async function onCreateDeck() {
    if (!token) return
    const name = newName.trim()
    if (!name) return
    if (!isPublicTextClean(name, newDescription)) {
      setErrorText(PUBLIC_TEXT_BLOCKED_MESSAGE)
      return
    }

    setSaving(true)
    setErrorText("")
    try {
      // Push any pending Settings prefs, then seed from this device's local copy
      // (do not wait on React state — localStorage is the runtime source of truth).
      await flushServerPrefs()
      const startSections = readLocalPreferences().deck_start_sections
      const created = await createDeck(token, {
        name,
        description: newDescription.trim() || null,
        is_public: newIsPublic,
        start_sections: startSections,
      })
      setMyDecks((prev) => [created, ...prev])
      setMyStatus("ready")
      resetCreateForm()
      navigate(ROUTES.deck(created.id))
    } catch (error) {
      setErrorText(
        error instanceof ApiError && error.detail === PROFANITY_REJECTED
          ? PUBLIC_TEXT_BLOCKED_MESSAGE
          : error instanceof ApiError
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
              onClick={() => navigate(ROUTES.LOGIN)}
            />
          </div>
        </div>
      </section>
    )
  }

  const shouldFetchMine = isAuthenticated && !!token && tab === "mine"
  const myFetchStatus = tabFetchStatus(myStatus, shouldFetchMine)

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

        {tab === "community" ? (
          <CommunityDeckBrowser
            token={token}
            title="COMMUNITY DECKS"
            description="Browse public decks from other operators."
          />
        ) : (
          <>
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="font-buahs93 text-xl text-white">YOUR DECKS</h2>
                <p className="mt-1 text-sm text-white/50">
                  Create, edit, or open a deck to build.
                </p>
              </div>
              {!creating ? (
                <GlitchFx
                  type="button"
                  label="NEW DECK"
                  disabled={saving || myFetchStatus === "loading"}
                  className="font-buahs93 h-9 rounded-none bg-cyan-700 px-5 hover:bg-cyan-900 disabled:opacity-60"
                  onClick={() => {
                    setErrorText("")
                    setCreating(true)
                  }}
                />
              ) : null}
            </div>

            {creating && token ? (
              <div className="mb-6 border border-cyan-500/40 bg-black/60 p-5">
                <h3 className="font-buahs93 mb-3 text-sm tracking-wide text-cyan-200/80">
                  NEW DECK
                </h3>
                <div className="flex flex-col gap-3">
                  <PublicTextField
                    value={newName}
                    onChange={setNewName}
                    placeholder="deck name"
                    disabled={saving}
                    autoFocus
                  />
                  <PublicTextArea
                    value={newDescription}
                    onChange={setNewDescription}
                    placeholder="description (optional)"
                    disabled={saving}
                    rows={3}
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
                      disabled={
                        saving ||
                        !newName.trim() ||
                        !isPublicTextClean(newName, newDescription)
                      }
                      className="font-buahs93 h-9 rounded-none bg-cyan-700 px-5 hover:bg-cyan-900 disabled:opacity-60"
                      onClick={() => void onCreateDeck()}
                    />
                    <GlitchFx
                      type="button"
                      label="CANCEL"
                      disabled={saving}
                      className="font-buahs93 h-9 rounded-none border border-cyan-500/40 bg-black/70 px-5 text-cyan-100 hover:border-cyan-400/70 hover:bg-cyan-500/10 disabled:opacity-60"
                      onClick={resetCreateForm}
                    />
                  </div>
                </div>
              </div>
            ) : null}

            {myFetchStatus === "loading" ? (
              <p className="font-mono text-sm text-cyan-300/70">
                Loading deck archive…
              </p>
            ) : null}

            {(myFetchStatus === "error" || errorText) && (
              <p className="mb-4 text-sm text-red-400" role="alert">
                {errorText || "Could not load your decks."}
              </p>
            )}

            {myFetchStatus === "ready" &&
              myDecks.length === 0 &&
              !creating && (
                <div className="border border-dashed border-cyan-500/30 bg-black/40 px-6 py-12 text-center">
                  <p className="font-buahs93 text-lg text-cyan-200/80">
                    NO DECKS YET
                  </p>
                  <p className="mt-2 text-sm text-white/50">
                    Hit NEW DECK to start building.
                  </p>
                </div>
              )}

            {myFetchStatus === "ready" && myDecks.length > 0 && token ? (
              <ul className="grid auto-rows-fr gap-4 sm:grid-cols-2">
                {myDecks.map((deck) => (
                  <li key={deck.id} className="h-full">
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
                      }}
                      onDeleted={(deckId) => {
                        setMyDecks((prev) =>
                          prev.filter((d) => d.id !== deckId)
                        )
                      }}
                    />
                  </li>
                ))}
              </ul>
            ) : null}
          </>
        )}
      </div>
    </section>
  )
}
