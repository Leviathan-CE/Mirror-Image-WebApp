/**
 * Deck view / edit page (`/decks/:deckId`).
 *
 * - Anyone can view a public deck (or an owned private deck when logged in).
 * - Owner can edit name, description, visibility, and categories.
 */

import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react"
import { ThumbsUp } from "lucide-react"
import { Link, useNavigate, useParams } from "react-router-dom"

import { useAuth } from "@/app/providers/AuthProvider"
import {
  useCardBackOptions,
} from "@/app/providers/CardBackProvider"
import { useUserPreferences } from "@/app/providers/PreferencesProvider"
import { sharedImages } from "@/assets"
import { GlitchFx } from "@/components/effects/GlitchFx"
import { DeckBoard } from "@/components/decks/DeckBoard"
import { DeckCardSearch } from "@/components/decks/DeckCardSearch"
import { DeckDescription } from "@/components/decks/DeckDescription"
import { collectDeckPrintoutSlots } from "@/components/decks/deckPrintout.logic"
import { DeckPrintoutDialog } from "@/components/decks/DeckPrintoutDialog"
import { DeckPrintPayPanel } from "@/components/decks/DeckPrintPayPanel"
import {
  DeckCardSortControls,
} from "@/components/decks/DeckCardSortControls"
import {
  DeckCardViewControls,
} from "@/components/decks/DeckCardViewControls"
import { DeckPanelToggle } from "@/components/decks/DeckPanelToggle"
import { CardLibraryBrowser } from "@/components/cards/CardLibraryBrowser"
import { DeckStatsPanel } from "@/components/decks/DeckStatsPanel"
import "@/components/decks/DeckCardStack.css"
import { useCardSelection } from "@/hooks/useCardSelection"
import { useDeckDetail } from "@/hooks/useDeckDetail"
import { useDeckBoardMutations } from "@/hooks/useDeckBoardMutations"
import { DeckTagSuggestInput } from "@/components/decks/DeckTagSuggestInput"
import { ConfirmDialog } from "@/components/ui/ConfirmDialog"
import { DropdownMenu, type DropdownMenuItem } from "@/components/ui/DropdownMenu"
import {
  PublicTextArea,
  PublicTextField,
} from "@/components/ui/PublicTextField"
import { ApiError } from "@/lib/api/client"
import { redeemPrintDownload } from "@/lib/api/billing"
import {
  isPublicTextClean,
  PROFANITY_REJECTED,
  PUBLIC_TEXT_BLOCKED_MESSAGE,
} from "@/lib/profanity"
import {
  addDeckTag,
  copyDeck,
  deleteDeck,
  likeDeck,
  removeDeckTag,
  unlikeDeck,
  updateDeck,
} from "@/lib/api/decks"
import { ROUTES, isStaffRole } from "@/lib/route"
import {
  FEATURE_DECK_PRINTOUT,
  FEATURE_DUPLEX_PRINT,
  userHasFeature,
} from "@/lib/subscription.logic"
import { cn } from "@/lib/utils"
import {
  BROWSE_WIDTH_DEFAULT,
  BROWSE_WIDTH_MIN,
  clampBrowseWidth,
} from "@/lib/userPreferences.logic"

/** Leave this much horizontal room for the deck board while resizing. */
const BROWSE_WIDTH_DECK_REMAIN_MIN = 280

/** Widest the library panel may grow — viewport minus a thin deck strip. */
function maxBrowseWidth(): number {
  if (typeof window === "undefined") return BROWSE_WIDTH_MIN
  return Math.max(
    BROWSE_WIDTH_MIN,
    window.innerWidth - BROWSE_WIDTH_DECK_REMAIN_MIN
  )
}

function clampDeckBrowseWidth(width: number): number {
  return clampBrowseWidth(width, maxBrowseWidth())
}

export function DeckPage() {
  const { deckId: deckIdParam } = useParams()
  const deckId = Number(deckIdParam)
  const navigate = useNavigate()
  const { user, token, isAuthenticated } = useAuth()
  const cardBackOptions = useCardBackOptions()
  const { prefs, patchPrefs } = useUserPreferences()
  const browseWidth = clampDeckBrowseWidth(prefs.deck_browse_width_px)
  const cardSortMode = prefs.deck_sort
  const cardViewMode = prefs.deck_view

  const {
    deck,
    setDeck,
    status,
    errorText,
    setErrorText,
    loadDeck: reloadDeck,
  } = useDeckDetail(deckId, token)

  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [isPublic, setIsPublic] = useState(false)
  const [searchMenuOpen, setSearchMenuOpen] = useState(false)
  const [allowPilotInDeck, setAllowPilotInDeck] = useState(false)
  const [browseOpen, setBrowseOpen] = useState(true)
  const [tagDraft, setTagDraft] = useState("")
  const [printoutBusy, setPrintoutBusy] = useState(false)
  const [printDialogOpen, setPrintDialogOpen] = useState(false)
  const [printPayOpen, setPrintPayOpen] = useState(false)
  const browseResizeRef = useRef<{
    pointerId: number
    startX: number
    startWidth: number
  } | null>(null)

  useEffect(() => {
    const clamped = clampDeckBrowseWidth(prefs.deck_browse_width_px)
    if (clamped !== prefs.deck_browse_width_px) {
      patchPrefs({ deck_browse_width_px: clamped })
    }
  }, [prefs.deck_browse_width_px, patchPrefs])

  // If the window shrinks, pull the panel back so it still leaves room for the board.
  useEffect(() => {
    function onWindowResize() {
      const clamped = clampDeckBrowseWidth(prefs.deck_browse_width_px)
      if (clamped !== prefs.deck_browse_width_px) {
        patchPrefs({ deck_browse_width_px: clamped })
      }
    }
    window.addEventListener("resize", onWindowResize)
    return () => window.removeEventListener("resize", onWindowResize)
  }, [prefs.deck_browse_width_px, patchPrefs])

  function onBrowseResizePointerDown(
    event: ReactPointerEvent<HTMLDivElement>
  ) {
    if (event.button !== 0) return
    event.preventDefault()
    event.stopPropagation()
    browseResizeRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startWidth: browseWidth,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function onBrowseResizePointerMove(
    event: ReactPointerEvent<HTMLDivElement>
  ) {
    const drag = browseResizeRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    // Panel is on the right — drag handle leftward = wider.
    patchPrefs({
      deck_browse_width_px: clampDeckBrowseWidth(
        drag.startWidth - (event.clientX - drag.startX)
      ),
    })
  }

  function onBrowseResizePointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = browseResizeRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    browseResizeRef.current = null
    try {
      event.currentTarget.releasePointerCapture(event.pointerId)
    } catch {
      /* already released */
    }
  }

  const canEdit =
    Boolean(deck && user && deck.author_name === user.user_name && token)
  const canPrintFree = userHasFeature(user, FEATURE_DECK_PRINTOUT)
  const deckPrintFree = deck?.print_price_cents === 0
  const canDuplexPrint = userHasFeature(user, FEATURE_DUPLEX_PRINT)
  const canOfferPrint = Boolean(token) && isAuthenticated
  const isAdmin = isStaffRole(user?.role)

  const closePrintDialog = useCallback(() => {
    if (printoutBusy) return
    setPrintDialogOpen(false)
  }, [printoutBusy])

  const closePrintPay = useCallback(() => {
    if (printoutBusy) return
    setPrintPayOpen(false)
  }, [printoutBusy])

  async function createPrintout(options?: {
    includeBacks?: boolean
    marginMm?: number
    fileName?: string
    cardBackUrl?: string | null
  }) {
    if (!deck || printoutBusy) return
    const slots = collectDeckPrintoutSlots(deck)
    if (slots.length === 0) {
      setErrorText("No cards marked for the deck to print.")
      return
    }
    const includeBacks = options?.includeBacks ?? false
    const selectedBackUrl = options?.cardBackUrl ?? null
    if (includeBacks && !selectedBackUrl) {
      setErrorText(
        "Card back art is not available yet — try again in a moment."
      )
      return
    }
    setPrintoutBusy(true)
    setErrorText("")
    try {
      const { generateDeckPrintoutPdf } = await import(
        "@/components/decks/generateDeckPrintoutPdf"
      )
      const result = await generateDeckPrintoutPdf({
        deckName: deck.name ?? `Deck ${deck.id}`,
        slots,
        cardBackUrl: includeBacks ? selectedBackUrl : null,
        includeBacks,
        marginMm: options?.marginMm,
        fileName: options?.fileName,
      })
      setPrintDialogOpen(false)
      setPrintPayOpen(false)
      if (result.missingArt > 0) {
        setErrorText(
          `Printout saved — ${result.missingArt} card(s) had no art `
          + "and used name placeholders."
        )
      }
    } catch {
      setErrorText("Could not build the printout PDF.")
    } finally {
      setPrintoutBusy(false)
    }
  }

  function onPrintUnlocked() {
    setPrintPayOpen(false)
    setPrintDialogOpen(true)
  }

  async function onCreatePrintout() {
    if (!deck || printoutBusy || !token) return
    const slots = collectDeckPrintoutSlots(deck)
    if (slots.length === 0) {
      setErrorText("No cards marked for the deck to print.")
      return
    }
    // Staff skip quota; everyone else redeems then opens duplex options.
    if (isAdmin) {
      setPrintDialogOpen(true)
      return
    }
    setErrorText("")
    try {
      // Redeem spends L1/L2 monthly quota (or allows a paid grant).
      const access = await redeemPrintDownload(token, deck.id)
      if (access.allowed) {
        setPrintDialogOpen(true)
        return
      }
      setPrintPayOpen(true)
    } catch (error: unknown) {
      if (error instanceof ApiError) {
        setErrorText(error.detail || "Could not check print access.")
      } else {
        setErrorText("Could not check print access.")
      }
    }
  }

  async function onCopyDeck() {
    if (!token || !deck || saving) return
    setSaving(true)
    setErrorText("")
    try {
      const copied = await copyDeck(deck.id, token)
      navigate(ROUTES.deck(copied.id), { replace: false })
    } catch {
      setErrorText("Could not copy this deck.")
    } finally {
      setSaving(false)
    }
  }

  async function onToggleLike() {
    if (!token || !deck || saving) return
    setSaving(true)
    setErrorText("")
    try {
      const summary = deck.liked_by_me
        ? await unlikeDeck(deck.id, token)
        : await likeDeck(deck.id, token)
      setDeck((prev) =>
        prev
          ? {
            ...prev,
            like_count: summary.like_count,
            liked_by_me: summary.liked_by_me,
            view_count: summary.view_count,
            tags: summary.tags,
          }
          : prev
      )
    } catch {
      setErrorText("Could not update like.")
    } finally {
      setSaving(false)
    }
  }

  async function onAddTag(rawTag?: string) {
    if (!token || !deck || !canEdit || saving) return
    const next = (rawTag ?? tagDraft).trim()
    if (!next) return
    if (!isPublicTextClean(next)) {
      setErrorText(PUBLIC_TEXT_BLOCKED_MESSAGE)
      return
    }
    setSaving(true)
    setErrorText("")
    try {
      const summary = await addDeckTag(deck.id, token, next)
      setDeck((prev) =>
        prev
          ? {
            ...prev,
            tags: summary.tags,
            like_count: summary.like_count,
            view_count: summary.view_count,
          }
          : prev
      )
      setTagDraft("")
    } catch (error) {
      setErrorText(
        error instanceof ApiError && error.detail === "invalid_tag"
          ? "Tags: 1–32 chars, letters/numbers/spaces/-/_."
          : error instanceof ApiError && error.detail === PROFANITY_REJECTED
            ? PUBLIC_TEXT_BLOCKED_MESSAGE
            : "Could not add tag."
      )
    } finally {
      setSaving(false)
    }
  }

  async function onRemoveTag(tag: string) {
    if (!token || !deck || !canEdit || saving) return
    setSaving(true)
    setErrorText("")
    try {
      const summary = await removeDeckTag(deck.id, token, tag)
      setDeck((prev) =>
        prev
          ? {
            ...prev,
            tags: summary.tags,
            like_count: summary.like_count,
            view_count: summary.view_count,
          }
          : prev
      )
    } catch {
      setErrorText("Could not remove tag.")
    } finally {
      setSaving(false)
    }
  }

  const { selectedKeys, selectCard, clearCardSelection } = useCardSelection({
    deck,
    sortMode: cardSortMode,
    enabled: canEdit,
  })

  const loadDeck = useCallback(
    async (opts?: { silent?: boolean }) => {
      const detail = await reloadDeck(opts)
      if (detail) {
        setName(detail.name ?? "")
        setDescription(detail.description ?? "")
        setIsPublic(detail.is_public)
      }
    },
    [reloadDeck]
  )

  // Keep edit-form fields aligned when the shared hook loads/reloads this deck.
  useEffect(() => {
    if (status !== "ready" || !deck) return
    setName(deck.name ?? "")
    setDescription(deck.description ?? "")
    setIsPublic(deck.is_public)
  }, [status, deck?.id])


  // After re-uploading art elsewhere, refresh timestamps so ?v= updates.
  useEffect(() => {
    function onReturn() {
      if (document.visibilityState !== "visible") return
      void loadDeck({ silent: true })
    }
    document.addEventListener("visibilitychange", onReturn)
    window.addEventListener("focus", onReturn)
    return () => {
      document.removeEventListener("visibilitychange", onReturn)
      window.removeEventListener("focus", onReturn)
    }
  }, [loadDeck])

  const {
    onCreateSectionFromDrop,
    onRenameCategory,
    onSetCategoryInDeck,
    onSetCategoryTypes,
    loadSectionTypeChoices,
    onDeleteCategory,
    onDropCardsToCategory,
    onQuantityDelta,
    onAddCardFromSearch,
    addObjective,
    assignPilot,
    onClearPilot,
  } = useDeckBoardMutations({
    deck,
    setDeck,
    token,
    canEdit,
    saving,
    setSaving,
    setErrorText,
    loadDeck,
    clearCardSelection,
    allowPilotInDeck,
  })

  async function onSaveMeta() {
    if (!token || !deck || !canEdit) return
    if (!isPublicTextClean(name, description)) {
      setErrorText(PUBLIC_TEXT_BLOCKED_MESSAGE)
      return
    }
    setSaving(true)
    setErrorText("")
    try {
      const updated = await updateDeck(deck.id, token, {
        name: name.trim() || "Untitled Deck",
        description: description.trim() || null,
        is_public: isPublic,
      })
      setDeck((prev) =>
        prev
          ? {
            ...prev,
            ...updated,
            categories: prev.categories,
            cards: prev.cards,
          }
          : prev
      )
      setEditing(false)
    } catch (error) {
      setErrorText(
        error instanceof ApiError && error.detail === PROFANITY_REJECTED
          ? PUBLIC_TEXT_BLOCKED_MESSAGE
          : error instanceof ApiError
            ? "Could not save deck details."
            : "Save failed."
      )
    } finally {
      setSaving(false)
    }
  }

  async function onDeleteDeck() {
    if (!token || !deck || !canEdit) return
    setSaving(true)
    setErrorText("")
    try {
      await deleteDeck(deck.id, token)
      setDeleteOpen(false)
      navigate(ROUTES.MAIN)
    } catch (error) {
      setErrorText(
        error instanceof ApiError
          ? "Could not delete this deck."
          : "Delete failed."
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <section
      className="relative min-h-screen max-w-full overflow-x-clip bg-cover bg-center bg-no-repeat px-4 py-12 sm:px-6 lg:px-8 xl:px-10 2xl:px-12"
      style={{ backgroundImage: `url(${sharedImages.ZONE_BACKGROUND})` }}
    >
      <div className="absolute inset-0 bg-black/65" aria-hidden />

      <div className="relative z-10 mx-auto w-full max-w-none pt-6">
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <GlitchFx
            type="button"
            label="← BACK"
            className="font-buahs93 h-9 rounded-none bg-cyan-700 px-5 hover:bg-cyan-900"
            onClick={() => {
              navigate(ROUTES.MAIN)
            }}
          />
          {canEdit ? (
            <span className="font-mono text-[10px] tracking-wide text-cyan-400/70">
              {editing ? "EDIT MODE" : "OWNER VIEW"}
            </span>
          ) : (
            <span className="font-mono text-[10px] tracking-wide text-white/40">
              READ ONLY
            </span>
          )}
        </div>

        {status === "loading" && (
          <p className="font-mono text-sm text-cyan-300/70">Loading deck…</p>
        )}

        {status === "error" && (
          <div className="border border-red-500/30 bg-black/50 p-6">
            <p className="text-sm text-red-400" role="alert">
              {errorText}
            </p>
            {!isAuthenticated ? (
              <Link to={ROUTES.LOGIN} className="mt-4 inline-block">
                <GlitchFx
                  type="button"
                  label="LOGIN"
                  className="font-buahs93 h-9 rounded-none bg-cyan-700 px-6 hover:bg-cyan-900"
                />
              </Link>
            ) : null}
          </div>
        )}

        {status === "ready" && deck ? (
          <>
            <p className="mb-4 font-mono text-xs text-cyan-300/60">
              {deck.card_count} cards · {deck.categories.length} sections ·{" "}
              {deck.like_count ?? 0} likes · {deck.view_count ?? 0} views
            </p>
            {!editing && (deck.tags ?? []).length > 0 ? (
              <div className="mb-4 flex flex-wrap items-center gap-2">
                {(deck.tags ?? []).map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 font-mono text-[11px] text-cyan-100"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            ) : null}
            <header className="mb-8 border-b border-cyan-500/20 pb-6">
              <div className="min-w-0">
                {editing && canEdit ? (
                  <div className="flex flex-col gap-3">
                    <PublicTextField
                      value={name}
                      onChange={setName}
                      placeholder="deck name"
                      disabled={saving}
                    />
                    <PublicTextArea
                      value={description}
                      onChange={setDescription}
                      placeholder="description (markdown supported)"
                      disabled={saving}
                      rows={3}
                    />
                    <label className="flex items-center gap-2 font-buahs93 text-sm text-cyan-200/80">
                      <input
                        type="checkbox"
                        checked={isPublic}
                        onChange={(e) => setIsPublic(e.target.checked)}
                        disabled={saving}
                        className="accent-cyan-400"
                      />
                      PUBLIC
                    </label>
                    <div className="flex flex-wrap items-center gap-2">
                      {(deck.tags ?? []).map((tag) => (
                        <span
                          key={tag}
                          className="inline-flex items-center gap-1 border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 font-mono text-[11px] text-cyan-100"
                        >
                          {tag}
                          <button
                            type="button"
                            className="text-cyan-300/70 hover:text-red-300"
                            disabled={saving}
                            aria-label={`Remove tag ${tag}`}
                            onClick={() => void onRemoveTag(tag)}
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                    <div className="flex w-full min-w-0 max-w-lg items-center gap-2">
                      <DeckTagSuggestInput
                        value={tagDraft}
                        onChange={setTagDraft}
                        exclude={deck.tags ?? []}
                        disabled={saving}
                        onPick={(tag) => void onAddTag(tag)}
                      />
                      <div className="shrink-0">
                        <GlitchFx
                          type="button"
                          label="ADD TAG"
                          disabled={
                            saving ||
                            !tagDraft.trim() ||
                            !isPublicTextClean(tagDraft)
                          }
                          className="font-buahs93 h-8 rounded-none border border-cyan-500/40 bg-black/70 px-4 text-xs text-cyan-100 hover:border-cyan-400/70 hover:bg-cyan-500/10 disabled:opacity-60"
                          onClick={() => void onAddTag()}
                        />
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <GlitchFx
                        type="button"
                        label={saving ? "SAVING…" : "SAVE"}
                        disabled={
                          saving || !isPublicTextClean(name, description)
                        }
                        className="font-buahs93 h-9 rounded-none bg-cyan-700 px-5 hover:bg-cyan-900 disabled:opacity-60"
                        onClick={() => void onSaveMeta()}
                      />
                      <GlitchFx
                        type="button"
                        label="CANCEL"
                        disabled={saving}
                        className="font-buahs93 h-9 rounded-none border border-cyan-500/40 bg-black/70 px-5 text-cyan-100 hover:border-cyan-400/70 hover:bg-cyan-500/10 disabled:opacity-60"
                        onClick={() => {
                          setEditing(false)
                          setName(deck.name ?? "")
                          setDescription(deck.description ?? "")
                          setIsPublic(deck.is_public)
                          setTagDraft("")
                        }}
                      />
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex flex-wrap items-start gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <h1 className="font-glitch text-3xl text-cyan-300 sm:text-4xl">
                          {deck.name ?? `Deck #${deck.id}`}
                        </h1>
                        {isAuthenticated && token ? (
                          <button
                            type="button"
                            disabled={saving}
                            aria-pressed={deck.liked_by_me}
                            aria-label={
                              deck.liked_by_me
                                ? `Unlike deck (${deck.like_count ?? 0} likes)`
                                : `Like deck (${deck.like_count ?? 0} likes)`
                            }
                            title={
                              deck.liked_by_me
                                ? `Liked · ${deck.like_count ?? 0}`
                                : `Like · ${deck.like_count ?? 0}`
                            }
                            className={cn(
                              "clip-angled flex h-8 w-8 shrink-0 items-center justify-center rounded-none border-0 disabled:opacity-50",
                              deck.liked_by_me
                                ? "text-cyan-300 hover:bg-cyan-500/10 hover:text-cyan-100"
                                : "text-cyan-200/80 hover:bg-cyan-500/10 hover:text-white"
                            )}
                            onClick={() => void onToggleLike()}
                          >
                            <ThumbsUp
                              className={cn(
                                "h-4 w-4",
                                deck.liked_by_me && "fill-current"
                              )}
                              aria-hidden
                            />
                          </button>
                        ) : null}
                        {isAuthenticated && token ? (
                          <DropdownMenu
                            label="Deck options"
                            disabled={saving}
                            className="shrink-0"
                            items={[
                              {
                                id: "copy-deck",
                                label: saving ? "Copying…" : "Copy to my decks",
                                disabled: saving,
                                onSelect: () => void onCopyDeck(),
                              },
                              ...(canEdit
                                ? ([
                                  {
                                    id: "edit-details",
                                    label: "Edit details",
                                    onSelect: () => setEditing(true),
                                  },
                                  {
                                    id: "delete-deck",
                                    label: "Delete deck",
                                    tone: "danger" as const,
                                    onSelect: () => setDeleteOpen(true),
                                  },
                                ] satisfies DropdownMenuItem[])
                                : []),
                            ]}
                          />
                        ) : null}
                      </div>
                    </div>

                    <p className="mt-2 flex flex-wrap items-center gap-2 font-buahs93 text-sm text-cyan-200/70">
                      <span>by {deck.author_name}</span>
                      <span
                        className={cn(
                          "text-[10px] tracking-wide",
                          deck.is_public
                            ? "text-emerald-400/90"
                            : "text-white/40"
                        )}
                      >
                        {deck.is_public ? "PUBLIC" : "PRIVATE"}
                      </span>
                    </p>
                    {deck.description ? (
                      <DeckDescription
                        className="mt-3"
                        text={deck.description}
                      />
                    ) : null}
                  </>
                )}

              </div>

              <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-2">
                  {canEdit ? (
                    <>
                    <div className="min-w-[12rem] flex-1 basis-48 max-w-xl">
                      <DeckCardSearch
                        disabled={saving}
                        token={token}
                        onPick={onAddCardFromSearch}
                        onOpenChange={setSearchMenuOpen}
                      />
                    </div>
                    <label className="inline-flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={allowPilotInDeck}
                        disabled={saving}
                        className="accent-cyan-400"
                        onChange={(event) =>
                          setAllowPilotInDeck(event.target.checked)
                        }
                      />
                      <span
                        className={
                          "font-mono text-[10px] tracking-wide " +
                          "text-cyan-200/80"
                        }
                      >
                        ALLOW PILOT IN DECK
                      </span>
                    </label>
                    </>
                  ) : null}
                  <DeckCardSortControls
                    value={cardSortMode}
                    onChange={(deck_sort) => patchPrefs({ deck_sort })}
                  />
                  <DeckCardViewControls
                    value={cardViewMode}
                    onChange={(deck_view) => patchPrefs({ deck_view })}
                  />
                  {canEdit ? (
                    <DeckPanelToggle
                      statsOn={!browseOpen}
                      onChange={(statsOn) => setBrowseOpen(!statsOn)}
                    />
                  ) : null}
                </div>
                <div className="flex w-full flex-col gap-2 md:w-auto md:flex-row md:items-center md:justify-end">
                  <GlitchFx
                    type="button"
                    label="PLAY TEST"
                    fxClassName="order-1 block w-full md:order-3 md:w-auto"
                    className="font-buahs93 h-9 w-full rounded-none bg-cyan-700 px-5 hover:bg-cyan-900 md:w-auto"
                    onClick={() => navigate(ROUTES.playTester(deckId))}
                  />
                  {canOfferPrint ? (
                    <GlitchFx
                      type="button"
                      label={
                        printoutBusy
                          ? "BUILDING PDF…"
                          : deckPrintFree
                            ? "PRINT FREE"
                            : canPrintFree
                              ? "CREATE PRINTOUT"
                              : "PRINT PDF"
                      }
                      disabled={printoutBusy || saving || printPayOpen}
                      fxClassName="order-2 block w-full md:w-auto"
                      className={
                        deckPrintFree
                          ? "font-buahs93 h-9 w-full rounded-none "
                            + "bg-emerald-600 px-4 text-white "
                            + "hover:bg-emerald-800 disabled:opacity-60 "
                            + "md:w-auto"
                          : "font-buahs93 h-9 w-full rounded-none "
                            + "bg-orange-600 px-4 text-white "
                            + "hover:bg-orange-800 disabled:opacity-60 "
                            + "md:w-auto"
                      }
                      onClick={() => void onCreatePrintout()}
                    />
                  ) : null}
                </div>
              </div>
            </header>

            {errorText && status === "ready" ? (
              <p className="mb-4 text-sm text-red-400" role="alert">
                {errorText}
              </p>
            ) : null}

            <div
              className={cn(
                "flex flex-col gap-6",
                canEdit && "xl:flex-row xl:items-start"
              )}
            >
              <div className="min-w-0 flex-1">
                <DeckBoard
                  deck={deck}
                  sortMode={cardSortMode}
                  viewMode={cardViewMode}
                  canEdit={canEdit}
                  disabled={saving}
                  interactionLocked={searchMenuOpen}
                  selectedKeys={selectedKeys}
                  onSelectCard={selectCard}
                  onClearSelect={clearCardSelection}
                  onRenameCategory={onRenameCategory}
                  onDeleteCategory={onDeleteCategory}
                  onSetCategoryInDeck={onSetCategoryInDeck}
                  onSetCategoryTypes={onSetCategoryTypes}
                  loadSectionTypeChoices={loadSectionTypeChoices}
                  onDropToCategory={onDropCardsToCategory}
                  onQuantityDelta={onQuantityDelta}
                  onAssignPilot={assignPilot}
                  onClearPilot={canEdit ? onClearPilot : undefined}
                  onAddObjective={addObjective}
                  onCreateSectionFromDrop={onCreateSectionFromDrop}
                />
              </div>

              {canEdit ? (
                <aside
                  className="relative flex w-full shrink-0 flex-col overflow-visible border border-cyan-500/25 bg-black/55 p-3 xl:w-[var(--browse-w)]"
                  style={{
                    ["--browse-w" as string]: browseOpen
                      ? `${browseWidth}px`
                      : `${Math.max(browseWidth, 480)}px`,
                  }}
                >
                  {browseOpen ? (
                    <CardLibraryBrowser
                      className="min-h-0 w-full flex-1"
                      token={token}
                      compact
                      draggable
                      title="CARD LIBRARY"
                      onCardActivate={(card) =>
                        void onAddCardFromSearch({
                          id: card.id,
                          card_name: card.card_name,
                          card_set_name: card.card_set_name,
                          rarity: card.rarity,
                          card_art_path: card.card_art_path,
                          card_art_version: card.card_art_version,
                        })
                      }
                    />
                  ) : (
                    <DeckStatsPanel
                      key={deck.id}
                      deck={deck}
                      token={token}
                      disabled={saving}
                      onAddTag={(tag) => {
                        void onAddTag(tag)
                      }}
                    />
                  )}
                  <div
                    role="separator"
                    aria-orientation="vertical"
                    aria-label="Resize card library"
                    title="Drag to resize · double-click to reset"
                    className="absolute top-0 left-0 z-20 hidden h-full w-2 cursor-col-resize touch-none xl:block"
                    onPointerDown={onBrowseResizePointerDown}
                    onPointerMove={onBrowseResizePointerMove}
                    onPointerUp={onBrowseResizePointerUp}
                    onPointerCancel={onBrowseResizePointerUp}
                    onDoubleClick={() =>
                      patchPrefs({ deck_browse_width_px: BROWSE_WIDTH_DEFAULT })
                    }
                  >
                    <span
                      aria-hidden
                      className="absolute inset-y-3 left-0.5 w-0.5 bg-cyan-400/35"
                    />
                  </div>
                </aside>
              ) : null}
            </div>

            <ConfirmDialog
              open={deleteOpen}
              title="Delete deck?"
              description={`Delete “${deck.name ?? `Deck #${deck.id}`}”? This cannot be undone.`}
              confirmLabel="Delete deck"
              cancelLabel="Keep deck"
              tone="danger"
              busy={saving}
              onCancel={() => {
                if (!saving) setDeleteOpen(false)
              }}
              onConfirm={() => {
                void onDeleteDeck()
              }}
            />

            {token ? (
              <DeckPrintoutDialog
                open={printDialogOpen}
                slots={collectDeckPrintoutSlots(deck)}
                deckName={deck.name ?? `Deck ${deck.id}`}
                cardBackOptions={
                  canDuplexPrint ? cardBackOptions : []
                }
                duplexEntitled={canDuplexPrint}
                busy={printoutBusy}
                onCancel={closePrintDialog}
                onGenerate={(options) => {
                  void createPrintout(options)
                }}
              />
            ) : null}

            {token && !isAdmin ? (
              <DeckPrintPayPanel
                token={token}
                deckId={deck.id}
                open={printPayOpen}
                busy={printoutBusy}
                onClose={closePrintPay}
                onUnlocked={onPrintUnlocked}
              />
            ) : null}
          </>
        ) : null}
      </div>
    </section>
  )
}
