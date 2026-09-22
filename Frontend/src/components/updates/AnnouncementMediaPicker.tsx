/**
 * Staff picker: reusable uploads + card art/thumbs.
 * Cards tab uses the same admin-library filters as Cards DB so you can browse.
 */

import { useCallback, useEffect, useRef, useState } from "react"

import { CardSearchBar } from "@/components/cards/CardSearchBar"
import { costTokenToIcon } from "@/components/cards/constants"
import { SearchPaginationBar } from "@/components/cards/SearchPaginationBar"
import { GameIcon } from "@/components/common/GameIcon"
import { GlitchFx } from "@/components/effects/GlitchFx"
import { Button } from "@/components/ui/button"
import { EditBox } from "@/components/ui/EditBox"
import type { AnnouncementImageKind } from "@/lib/announcement.logic"
import {
  announcementMediaUrl,
  fetchAnnouncementMedia,
  uploadAnnouncementMedia,
  type AnnouncementMediaItem,
} from "@/lib/api/announcements"
import {
  fetchCardFacets,
  type CardLibraryFacets,
} from "@/lib/api/cards"
import {
  PUBLISH_STATUSES,
  fetchAdminCardLibrary,
  type AdminCardItem,
  type PublishStatus,
} from "@/lib/api/cards_admin"
import { cardArtUrl, cardFaceUrl } from "@/lib/api/decks"
import { cn } from "@/lib/utils"

export type PickedMedia =
  | { source: "media"; id: number; label: string }
  | { source: "card"; id: number; face: "art" | "thumb"; label: string }

type PickerTab = "uploads" | "cards"
type FaceFilter = "any" | "thumb" | "art"

const FACE_FILTERS: { id: FaceFilter; label: string }[] = [
  { id: "any", label: "BOTH" },
  { id: "thumb", label: "THUMB" },
  { id: "art", label: "ART" },
]

type AnnouncementMediaPickerProps = {
  token: string
  open: boolean
  onClose: () => void
  onPick: (picked: PickedMedia) => void
  /** Cover flow starts on cards; body insert starts on uploads. */
  initialTab?: PickerTab
}

const PAGE_SIZE = 24

const EMPTY_FACETS: CardLibraryFacets = {
  colors: ["LIF", "MET", "POW", "RAM", "TIM", "STL"],
  super_types: [],
  sub_types: [],
  types_lines: [],
  invoke_cost_min: 0,
  invoke_cost_max: 15,
}

const secondaryActionClassName =
  "font-buahs93 h-8 rounded-none border border-cyan-500/35 bg-black/70 px-3 text-xs text-cyan-100 hover:border-cyan-400/60 hover:bg-cyan-500/10 hover:text-white disabled:opacity-60"

const filterSelectClassName =
  "h-8 w-full rounded-none border border-cyan-500/35 bg-black/80 px-2 font-mono text-xs text-cyan-50 outline-none focus-visible:border-cyan-300"

function cardFaces(card: AdminCardItem) {
  return {
    thumb: cardFaceUrl(card),
    art: cardArtUrl(card.card_art_path, card.card_art_version),
  }
}

function FacePickButton({
  src,
  label,
  onPick,
}: {
  src: string
  label: "THUMB" | "ART"
  onPick: () => void
}) {
  return (
    <button
      type="button"
      className={cn(
        "group w-full border border-cyan-500/25 bg-black/70 p-1",
        "transition duration-150 ease-out",
        "hover:z-10 hover:scale-[1.04] hover:border-cyan-300",
        "hover:bg-cyan-500/15 hover:shadow-[0_0_18px_rgba(34,211,238,0.35)]"
      )}
      onClick={onPick}
    >
      <img
        src={src}
        alt=""
        className="h-36 w-full object-contain transition duration-150 group-hover:brightness-110"
      />
      <span className="mt-1 block font-buahs93 text-[10px] text-cyan-200/70 transition group-hover:text-cyan-50">
        {label}
      </span>
    </button>
  )
}

export function AnnouncementMediaPicker({
  token,
  open,
  onClose,
  onPick,
  initialTab = "uploads",
}: AnnouncementMediaPickerProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [tab, setTab] = useState<PickerTab>(initialTab)
  const [uploadQ, setUploadQ] = useState("")
  const [uploads, setUploads] = useState<AnnouncementMediaItem[]>([])
  const [cards, setCards] = useState<AdminCardItem[]>([])
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const [facets, setFacets] = useState<CardLibraryFacets>(EMPTY_FACETS)
  const [nameQuery, setNameQuery] = useState("")
  const [debouncedName, setDebouncedName] = useState("")
  const [descriptionQuery, setDescriptionQuery] = useState("")
  const [debouncedDescription, setDebouncedDescription] = useState("")
  const [colors, setColors] = useState<string[]>([])
  const [invokeMin, setInvokeMin] = useState("")
  const [invokeMax, setInvokeMax] = useState("")
  const [typesLine, setTypesLine] = useState("")
  const [superType, setSuperType] = useState("")
  const [subType, setSubType] = useState("")
  const [publishedFilter, setPublishedFilter] = useState<PublishStatus | "">("")
  const [faceFilter, setFaceFilter] = useState<FaceFilter>("any")
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [loadingCards, setLoadingCards] = useState(false)

  useEffect(() => {
    if (!open) return
    setTab(initialTab)
  }, [open, initialTab])

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedName(nameQuery.trim()), 200)
    return () => window.clearTimeout(timer)
  }, [nameQuery])

  useEffect(() => {
    const timer = window.setTimeout(
      () => setDebouncedDescription(descriptionQuery.trim()),
      200
    )
    return () => window.clearTimeout(timer)
  }, [descriptionQuery])

  useEffect(() => {
    setOffset(0)
  }, [
    debouncedName,
    debouncedDescription,
    colors,
    invokeMin,
    invokeMax,
    typesLine,
    superType,
    subType,
    publishedFilter,
  ])

  useEffect(() => {
    if (!open) return
    let cancelled = false
    fetchCardFacets(token)
      .then((data) => {
        if (!cancelled) setFacets(data)
      })
      .catch(() => {
        /* keep EMPTY_FACETS */
      })
    return () => {
      cancelled = true
    }
  }, [open, token])

  const loadUploads = useCallback(async () => {
    try {
      setUploads(await fetchAnnouncementMedia(token, uploadQ))
      setError(null)
    } catch {
      setError("Could not load uploads.")
    }
  }, [token, uploadQ])

  const loadCards = useCallback(async () => {
    const min = Number.parseInt(invokeMin, 10)
    const max = Number.parseInt(invokeMax, 10)
    setLoadingCards(true)
    try {
      const result = await fetchAdminCardLibrary(token, {
        q: debouncedName || undefined,
        description: debouncedDescription || undefined,
        colors,
        invokeCostMin: Number.isFinite(min) ? min : null,
        invokeCostMax: Number.isFinite(max) ? max : null,
        typesLine: typesLine || undefined,
        superType: superType || undefined,
        subType: subType || undefined,
        published: publishedFilter || undefined,
        sort: debouncedName ? "relevance" : "name",
        limit: PAGE_SIZE,
        offset,
      })
      setCards(result.items)
      setTotal(result.total)
      setError(null)
    } catch {
      setError("Could not load cards.")
    } finally {
      setLoadingCards(false)
    }
  }, [
    token,
    debouncedName,
    debouncedDescription,
    colors,
    invokeMin,
    invokeMax,
    typesLine,
    superType,
    subType,
    publishedFilter,
    offset,
  ])

  useEffect(() => {
    if (!open) return
    if (tab === "uploads") void loadUploads()
    else void loadCards()
  }, [open, tab, loadUploads, loadCards])

  const toggleColor = useCallback((color: string) => {
    setColors((prev) =>
      prev.includes(color) ? prev.filter((item) => item !== color) : [...prev, color]
    )
  }, [])

  const clearFilters = useCallback(() => {
    setNameQuery("")
    setDescriptionQuery("")
    setColors([])
    setInvokeMin("")
    setInvokeMax("")
    setTypesLine("")
    setSuperType("")
    setSubType("")
    setPublishedFilter("")
    setFaceFilter("any")
    setOffset(0)
  }, [])

  if (!open) return null

  const filtersActive =
    nameQuery.trim() !== "" ||
    descriptionQuery.trim() !== "" ||
    colors.length > 0 ||
    invokeMin !== "" ||
    invokeMax !== "" ||
    typesLine !== "" ||
    superType !== "" ||
    subType !== "" ||
    publishedFilter !== "" ||
    faceFilter !== "any"

  const advancedActive =
    descriptionQuery.trim() !== "" ||
    invokeMin !== "" ||
    invokeMax !== "" ||
    typesLine !== "" ||
    superType !== "" ||
    subType !== "" ||
    publishedFilter !== ""

  const pageStart = total === 0 ? 0 : offset + 1
  const pageEnd = Math.min(offset + cards.length, total)
  const canPrev = offset > 0
  const canNext = offset + PAGE_SIZE < total
  const visibleCards = cards.filter((card) => {
    const faces = cardFaces(card)
    if (faceFilter === "thumb") return Boolean(faces.thumb)
    if (faceFilter === "art") return Boolean(faces.art)
    return true
  })
  const showThumb = faceFilter !== "art"
  const showArt = faceFilter !== "thumb"

  async function onFile(file: File | undefined) {
    if (!file || busy) return
    setBusy(true)
    setError(null)
    try {
      const item = await uploadAnnouncementMedia(token, file)
      setUploads((prev) => [item, ...prev])
    } catch {
      setError("Upload failed. PNG, JPEG, or WebP under 1 MB.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[11000] flex items-center justify-center bg-black/80 p-3 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Choose image"
      onClick={onClose}
    >
      <div
        className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden border border-cyan-500/30 bg-black"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-cyan-500/20 p-3">
          <h2 className="font-buahs93 text-sm text-cyan-100">MEDIA</h2>
          <GlitchFx
            type="button"
            label="CLOSE"
            className={secondaryActionClassName}
            onClick={onClose}
          />
        </div>

        <div className="flex gap-2 px-3 pt-3">
          <GlitchFx
            type="button"
            label="UPLOADS"
            className={cn(
              secondaryActionClassName,
              tab === "uploads" &&
                "border-cyan-300 bg-cyan-500/20 text-cyan-50"
            )}
            onClick={() => setTab("uploads")}
          />
          <GlitchFx
            type="button"
            label="CARDS"
            className={cn(
              secondaryActionClassName,
              tab === "cards" && "border-cyan-300 bg-cyan-500/20 text-cyan-50"
            )}
            onClick={() => setTab("cards")}
          />
        </div>

        {error ? (
          <p className="px-3 pt-2 font-mono text-xs text-red-400">{error}</p>
        ) : null}

        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {tab === "uploads" ? (
            <div>
              <div className="flex flex-wrap items-end gap-2">
                <div className="min-w-0 flex-1 basis-48">
                  <EditBox
                    value={uploadQ}
                    onChange={(e) => setUploadQ(e.target.value)}
                    placeholder="Search uploads"
                  />
                </div>
                <GlitchFx
                  type="button"
                  label={busy ? "UPLOADING…" : "UPLOAD NEW (1 MB)"}
                  disabled={busy}
                  className={secondaryActionClassName}
                  onClick={() => fileRef.current?.click()}
                />
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  disabled={busy}
                  onChange={(e) => {
                    void onFile(e.target.files?.[0])
                    e.target.value = ""
                  }}
                />
              </div>
              <ul className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
                {uploads.map((item) => {
                  const src = announcementMediaUrl(item.url)
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        className={cn(
                          "w-full border border-cyan-500/20 bg-black/60 p-1 text-left",
                          "transition duration-150",
                          "hover:scale-[1.03] hover:border-cyan-300 hover:bg-cyan-500/15",
                          "hover:shadow-[0_0_16px_rgba(34,211,238,0.3)]"
                        )}
                        onClick={() =>
                          onPick({
                            source: "media",
                            id: item.id,
                            label: item.label,
                          })
                        }
                      >
                        {src ? (
                          <img
                            src={src}
                            alt=""
                            className="h-24 w-full object-cover"
                          />
                        ) : (
                          <div className="h-24 bg-cyan-950/40" />
                        )}
                        <p className="mt-1 truncate font-mono text-[10px] text-cyan-100/70">
                          {item.label}
                        </p>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-wrap items-end gap-x-3 gap-y-2">
                <div className="min-w-0 flex-1 basis-48">
                  <CardSearchBar
                    label=""
                    value={nameQuery}
                    onChange={setNameQuery}
                    placeholder="Closest name match…"
                  />
                </div>
                <div className="grid w-fit grid-cols-6 gap-1.5">
                  {facets.colors.map((color) => {
                    const on = colors.includes(color)
                    const icon = costTokenToIcon(color)
                    return (
                      <Button
                        key={color}
                        type="button"
                        variant="outline"
                        size="icon"
                        aria-pressed={on}
                        aria-label={`Filter ${color}`}
                        title={color}
                        className={cn(
                          "size-8 overflow-visible rounded-none border",
                          on
                            ? "border-cyan-400 bg-cyan-700 hover:bg-cyan-800"
                            : "border-cyan-500/40 bg-black/70 hover:border-cyan-400/70 hover:bg-cyan-500/10"
                        )}
                        onClick={() => toggleColor(color)}
                      >
                        {icon ? (
                          <GameIcon
                            name={icon}
                            className="!h-4 !w-4 shrink-0 object-contain"
                          />
                        ) : (
                          <span className="font-buahs93 text-[10px] text-cyan-100">
                            {color}
                          </span>
                        )}
                      </Button>
                    )
                  })}
                </div>
                <GlitchFx
                  type="button"
                  label="CLEAR FILTERS"
                  disabled={!filtersActive}
                  className={cn(secondaryActionClassName, "shrink-0 px-2")}
                  onClick={clearFilters}
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="font-buahs93 text-[10px] text-cyan-300/70">
                  FACE
                </span>
                {FACE_FILTERS.map((option) => (
                  <GlitchFx
                    key={option.id}
                    type="button"
                    label={option.label}
                    aria-pressed={faceFilter === option.id}
                    className={cn(
                      secondaryActionClassName,
                      faceFilter === option.id &&
                        "border-cyan-300 bg-cyan-500/20 text-cyan-50"
                    )}
                    onClick={() => setFaceFilter(option.id)}
                  />
                ))}
              </div>

              <button
                type="button"
                aria-expanded={advancedOpen}
                className={cn(
                  "flex w-full items-center justify-between border border-cyan-500/30 bg-black/60 px-3 py-2",
                  "font-buahs93 text-xs tracking-wide text-cyan-100 hover:border-cyan-400/50 hover:bg-cyan-500/10"
                )}
                onClick={() => setAdvancedOpen((prev) => !prev)}
              >
                <span className="inline-flex items-center gap-2">
                  ADVANCED SEARCH
                  {advancedActive ? (
                    <span
                      className="inline-block size-1.5 rounded-full bg-cyan-400"
                      title="Filters active"
                      aria-label="Advanced filters active"
                    />
                  ) : null}
                </span>
                <span className="font-mono text-[10px] text-cyan-300/70">
                  {advancedOpen ? "▲" : "▼"}
                </span>
              </button>

              {advancedOpen ? (
                <div className="grid gap-3 border border-cyan-500/20 border-t-0 bg-black/40 p-3 sm:grid-cols-2">
                  <label className="block sm:col-span-2">
                    <span className="mb-1 block font-buahs93 text-xs text-cyan-200/70">
                      DESCRIPTION
                    </span>
                    <EditBox
                      value={descriptionQuery}
                      onChange={(e) => setDescriptionQuery(e.target.value)}
                      placeholder="Rules text contains…"
                      size="sm"
                      autoComplete="off"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block font-buahs93 text-xs text-cyan-200/70">
                      INVOKE MIN
                    </span>
                    <EditBox
                      value={invokeMin}
                      onChange={(e) =>
                        setInvokeMin(e.target.value.replace(/\D/g, ""))
                      }
                      placeholder={`${facets.invoke_cost_min}`}
                      size="sm"
                      inputMode="numeric"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block font-buahs93 text-xs text-cyan-200/70">
                      INVOKE MAX
                    </span>
                    <EditBox
                      value={invokeMax}
                      onChange={(e) =>
                        setInvokeMax(e.target.value.replace(/\D/g, ""))
                      }
                      placeholder={`${facets.invoke_cost_max}`}
                      size="sm"
                      inputMode="numeric"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block font-buahs93 text-xs text-cyan-200/70">
                      TYPE LINE
                    </span>
                    <select
                      value={typesLine}
                      onChange={(e) => setTypesLine(e.target.value)}
                      className={filterSelectClassName}
                    >
                      <option value="">Any</option>
                      {facets.types_lines.map((line) => (
                        <option key={line} value={line}>
                          {line}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className="mb-1 block font-buahs93 text-xs text-cyan-200/70">
                      SUPER TYPE
                    </span>
                    <select
                      value={superType}
                      onChange={(e) => setSuperType(e.target.value)}
                      className={filterSelectClassName}
                    >
                      <option value="">Any</option>
                      {facets.super_types.map((value) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block sm:col-span-2">
                    <span className="mb-1 block font-buahs93 text-xs text-cyan-200/70">
                      SUB TYPE
                    </span>
                    <select
                      value={subType}
                      onChange={(e) => setSubType(e.target.value)}
                      className={filterSelectClassName}
                    >
                      <option value="">Any</option>
                      {facets.sub_types.map((value) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block sm:col-span-2">
                    <span className="mb-1 block font-buahs93 text-xs text-cyan-200/70">
                      PUBLISH STATUS
                    </span>
                    <select
                      value={publishedFilter}
                      onChange={(e) =>
                        setPublishedFilter(e.target.value as PublishStatus | "")
                      }
                      className={filterSelectClassName}
                    >
                      <option value="">Any</option>
                      {PUBLISH_STATUSES.map((value) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              ) : null}

              <SearchPaginationBar
                variant="glitch"
                compact
                canPrev={canPrev}
                canNext={canNext}
                disabled={loadingCards}
                onPrev={() => setOffset((prev) => Math.max(0, prev - PAGE_SIZE))}
                onNext={() => setOffset((prev) => prev + PAGE_SIZE)}
                summary={
                  loadingCards
                    ? "Loading…"
                    : `${pageStart}–${pageEnd} of ${total}`
                }
              />

              {cards.length === 0 && !loadingCards ? (
                <p className="font-mono text-xs text-cyan-100/45">
                  No cards match these filters.
                </p>
              ) : null}
              {cards.length > 0 && visibleCards.length === 0 && !loadingCards ? (
                <p className="font-mono text-xs text-cyan-100/45">
                  No cards on this page have that face. Try BOTH or the next page.
                </p>
              ) : null}

              <ul
                className={cn(
                  "grid gap-3",
                  faceFilter === "any"
                    ? "grid-cols-1 sm:grid-cols-2"
                    : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4"
                )}
              >
                {visibleCards.map((card) => {
                  const faces = cardFaces(card)
                  return (
                    <li
                      key={card.id}
                      className="border border-cyan-500/20 bg-black/50 p-2"
                    >
                      <p className="font-mono text-xs text-cyan-100">
                        {card.card_name}
                        <span className="block text-[10px] text-cyan-100/45">
                          {card.card_set_name} · {card.published}
                        </span>
                      </p>
                      <div
                        className={cn(
                          "mt-2 grid gap-2",
                          faceFilter === "any" ? "grid-cols-2" : "grid-cols-1"
                        )}
                      >
                        {showThumb && faces.thumb ? (
                          <FacePickButton
                            src={faces.thumb}
                            label="THUMB"
                            onPick={() =>
                              onPick({
                                source: "card",
                                id: card.id,
                                face: "thumb",
                                label: card.card_name,
                              })
                            }
                          />
                        ) : null}
                        {showArt && faces.art ? (
                          <FacePickButton
                            src={faces.art}
                            label="ART"
                            onPick={() =>
                              onPick({
                                source: "card",
                                id: card.id,
                                face: "art",
                                label: card.card_name,
                              })
                            }
                          />
                        ) : null}
                      </div>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export function pickedToKind(picked: PickedMedia): AnnouncementImageKind {
  if (picked.source === "media") return "media"
  return picked.face === "art" ? "card-art" : "card-thumb"
}
