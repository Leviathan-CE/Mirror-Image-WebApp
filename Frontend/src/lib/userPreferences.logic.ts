/**
 * Account UI preferences — deck board + card library.
 * Guests persist to localStorage; signed-in users use the server blob.
 */

import type { CardLibrarySortMode } from "@/lib/api/cards"
import {
  DEFAULT_DECK_CATEGORY_NAMES,
  PILOT_SECTION_NAME,
} from "@/lib/api/decks"
import { nextNewSectionName } from "@/components/decks/deck.logic"
import type { DeckCardSortMode } from "@/components/decks/DeckCardSortControls"
import type { DeckCardViewMode } from "@/components/decks/DeckCardViewControls"
import { containsProfanity } from "@/lib/profanity"

export const PREF_STORAGE = {
  deckView: "mi-deck-card-view-mode",
  deckSort: "mi-deck-card-sort-mode",
  deckBrowseWidth: "mi-deck-browse-width-px",
  librarySort: "mi-library-sort-mode",
  libraryPageSize: "mi-library-page-size",
  libraryPreviewPx: "mi-library-preview-card-min-px",
  deckStartSections: "mi-deck-start-sections",
} as const

export const LIBRARY_PAGE_SIZES = [50, 100, 150, 200] as const
export type LibraryPageSize = (typeof LIBRARY_PAGE_SIZES)[number]

export const BROWSE_WIDTH_MIN = 280
export const BROWSE_WIDTH_MAX = 2400
export const BROWSE_WIDTH_DEFAULT = 352
export const PREVIEW_PX_MIN = 72
export const PREVIEW_PX_MAX = 200
export const PREVIEW_PX_DEFAULT = 112
export const SECTION_NAME_MAX = 60
export const SECTION_COUNT_MIN = 1
export const SECTION_COUNT_MAX = 12

export const LIBRARY_SORT_OPTIONS: { id: CardLibrarySortMode; label: string }[] =
  [
    { id: "name", label: "A–Z" },
    { id: "name_desc", label: "Z–A" },
    { id: "invoke", label: "Invoke cost ↑" },
    { id: "invoke_desc", label: "Invoke cost ↓" },
    { id: "relevance", label: "Best match" },
  ]

export type UserPreferences = {
  deck_view: DeckCardViewMode
  deck_sort: DeckCardSortMode
  deck_browse_width_px: number
  library_sort: CardLibrarySortMode
  library_page_size: LibraryPageSize
  library_preview_px: number
  deck_start_sections: string[]
}

export const DEFAULT_USER_PREFERENCES: UserPreferences = {
  deck_view: "cards",
  deck_sort: "type",
  deck_browse_width_px: BROWSE_WIDTH_DEFAULT,
  library_sort: "name",
  library_page_size: 50,
  library_preview_px: PREVIEW_PX_DEFAULT,
  deck_start_sections: [...DEFAULT_DECK_CATEGORY_NAMES],
}

export type UserPreferencesPatch = Partial<UserPreferences>

function clampInt(value: unknown, lo: number, hi: number, fallback: number): number {
  const n = typeof value === "number" ? value : Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.min(hi, Math.max(lo, Math.round(n)))
}

function isDeckView(value: string): value is DeckCardViewMode {
  return value === "cards" || value === "list"
}

function isDeckSort(value: string): value is DeckCardSortMode {
  return value === "type" || value === "invoke" || value === "name"
}

export function isLibrarySortMode(value: string): value is CardLibrarySortMode {
  return LIBRARY_SORT_OPTIONS.some((option) => option.id === value)
}

export function isLibraryPageSize(value: number): value is LibraryPageSize {
  return (LIBRARY_PAGE_SIZES as readonly number[]).includes(value)
}

export function clampPreviewPx(value: number): number {
  return clampInt(value, PREVIEW_PX_MIN, PREVIEW_PX_MAX, PREVIEW_PX_DEFAULT)
}

export function clampBrowseWidth(value: number, viewportMax?: number): number {
  const hi =
    viewportMax != null
      ? Math.min(BROWSE_WIDTH_MAX, Math.max(BROWSE_WIDTH_MIN, viewportMax))
      : BROWSE_WIDTH_MAX
  return clampInt(value, BROWSE_WIDTH_MIN, hi, BROWSE_WIDTH_DEFAULT)
}

export function normalizeStartSections(raw: unknown): string[] {
  if (!Array.isArray(raw)) {
    return [...DEFAULT_DECK_CATEGORY_NAMES]
  }
  const out: string[] = []
  const seen = new Set<string>()
  for (const item of raw) {
    const name = String(item ?? "").trim().slice(0, SECTION_NAME_MAX)
    if (!name || containsProfanity(name)) continue
    const key = name.toLowerCase()
    if (key === PILOT_SECTION_NAME.toLowerCase() || seen.has(key)) continue
    seen.add(key)
    out.push(name)
    if (out.length >= SECTION_COUNT_MAX) break
  }
  return out.length >= SECTION_COUNT_MIN
    ? out
    : [...DEFAULT_DECK_CATEGORY_NAMES]
}

export function resizeStartSections(current: string[], count: number): string[] {
  const n = clampInt(count, SECTION_COUNT_MIN, SECTION_COUNT_MAX, current.length)
  const next = [...normalizeStartSections(current)]
  while (next.length < n) {
    next.push(nextNewSectionName(next))
  }
  if (next.length > n) next.length = n
  return next
}

export function normalizeUserPreferences(raw: unknown): UserPreferences {
  const data =
    raw != null && typeof raw === "object"
      ? (raw as Record<string, unknown>)
      : {}
  const view = String(data.deck_view ?? "")
  const sort = String(data.deck_sort ?? "")
  const libSort = String(data.library_sort ?? "")
  const page = Number(data.library_page_size)
  return {
    deck_view: isDeckView(view) ? view : DEFAULT_USER_PREFERENCES.deck_view,
    deck_sort: isDeckSort(sort) ? sort : DEFAULT_USER_PREFERENCES.deck_sort,
    deck_browse_width_px: clampBrowseWidth(
      Number(data.deck_browse_width_px)
    ),
    library_sort: isLibrarySortMode(libSort)
      ? libSort
      : DEFAULT_USER_PREFERENCES.library_sort,
    library_page_size: isLibraryPageSize(page)
      ? page
      : DEFAULT_USER_PREFERENCES.library_page_size,
    library_preview_px: clampPreviewPx(Number(data.library_preview_px)),
    deck_start_sections: normalizeStartSections(data.deck_start_sections),
  }
}

export function preferencesAreUnset(raw: unknown): boolean {
  return raw == null || (typeof raw === "object" && Object.keys(raw).length === 0)
}

function readLocalRaw(key: string): string | null {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function writeLocalRaw(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    /* private mode / quota */
  }
}

/** Only keys that exist in localStorage (for one-time migrate). */
export function readLocalPreferencePatch(): UserPreferencesPatch {
  const patch: UserPreferencesPatch = {}
  const view = readLocalRaw(PREF_STORAGE.deckView)
  if (view != null && isDeckView(view)) patch.deck_view = view
  const sort = readLocalRaw(PREF_STORAGE.deckSort)
  if (sort != null && isDeckSort(sort)) patch.deck_sort = sort
  const width = readLocalRaw(PREF_STORAGE.deckBrowseWidth)
  if (width != null) patch.deck_browse_width_px = clampBrowseWidth(Number(width))
  const libSort = readLocalRaw(PREF_STORAGE.librarySort)
  if (libSort != null && isLibrarySortMode(libSort)) patch.library_sort = libSort
  const page = readLocalRaw(PREF_STORAGE.libraryPageSize)
  if (page != null) {
    const n = Number(page)
    if (isLibraryPageSize(n)) patch.library_page_size = n
  }
  const preview = readLocalRaw(PREF_STORAGE.libraryPreviewPx)
  if (preview != null) patch.library_preview_px = clampPreviewPx(Number(preview))
  const sections = readLocalRaw(PREF_STORAGE.deckStartSections)
  if (sections != null) {
    try {
      patch.deck_start_sections = normalizeStartSections(JSON.parse(sections))
    } catch {
      /* ignore bad JSON */
    }
  }
  return patch
}

export function readLocalPreferences(): UserPreferences {
  return normalizeUserPreferences({
    ...DEFAULT_USER_PREFERENCES,
    ...readLocalPreferencePatch(),
  })
}

export function writeLocalPreferences(prefs: UserPreferences): void {
  writeLocalRaw(PREF_STORAGE.deckView, prefs.deck_view)
  writeLocalRaw(PREF_STORAGE.deckSort, prefs.deck_sort)
  writeLocalRaw(PREF_STORAGE.deckBrowseWidth, String(prefs.deck_browse_width_px))
  writeLocalRaw(PREF_STORAGE.librarySort, prefs.library_sort)
  writeLocalRaw(PREF_STORAGE.libraryPageSize, String(prefs.library_page_size))
  writeLocalRaw(PREF_STORAGE.libraryPreviewPx, String(prefs.library_preview_px))
  writeLocalRaw(
    PREF_STORAGE.deckStartSections,
    JSON.stringify(prefs.deck_start_sections)
  )
}
