/**
 * Deck management API client (list, detail, meta, categories).
 */

import {
  ApiError,
  apiBaseUrl,
  authHeaders,
  parseErrorDetail,
  readJsonOrThrow,
} from "@/lib/api/client"

export type DeckSummary = {
  id: number
  name: string | null
  description: string | null
  is_public: boolean
  author_name: string
  cover_image_path: string | null
  card_count: number
}

/** Names seeded on new decks — users can rename/add/remove per deck. */
export const DEFAULT_DECK_CATEGORY_NAMES = [
  "Main",
  "Side",
  "Maybe",
  "Extra",
] as const

/** Visual reserved section names (created on the client when needed). */
export const PILOT_SECTION_NAME = "Pilot"
export const AUGMENT_SECTION_NAME = "Augments"

export type DeckCategoryOut = {
  id: number
  name: string
  sort_order: number
}

export type DeckCardEntry = {
  card_id: number
  card_name: string
  quantity: number
  category_id: number
  category_name: string
  sort_order: number
  card_art_path: string | null
  invoke_cost?: number
  types_line?: string
  /** Epoch seconds — changes when card art is re-uploaded. */
  card_art_version?: number | null
}

export type DeckDetail = DeckSummary & {
  categories: DeckCategoryOut[]
  cards: DeckCardEntry[]
}

export type DeckCreatePayload = {
  name: string
  description?: string | null
  is_public?: boolean
}

export type DeckUpdatePayload = {
  name?: string
  description?: string | null
  is_public?: boolean
}

export async function fetchMyDecks(token: string): Promise<DeckSummary[]> {
  const response = await fetch(`${apiBaseUrl()}/decks/me`, {
    headers: authHeaders(token),
  })
  return readJsonOrThrow<DeckSummary[]>(response, "decks_fetch_failed")
}

/** Public deck catalogue — no auth required. */
export async function fetchPublicDecks(): Promise<DeckSummary[]> {
  const response = await fetch(`${apiBaseUrl()}/decks/public`)
  return readJsonOrThrow<DeckSummary[]>(response, "public_decks_fetch_failed")
}

export async function createDeck(
  token: string,
  payload: DeckCreatePayload
): Promise<DeckSummary> {
  const response = await fetch(`${apiBaseUrl()}/decks`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(token),
    },
    body: JSON.stringify(payload),
  })
  return readJsonOrThrow<DeckSummary>(response, "deck_create_failed")
}

/** Public or owned deck detail (send token when logged in). */
export async function fetchDeckDetail(
  deckId: number,
  token?: string | null
): Promise<DeckDetail> {
  const response = await fetch(`${apiBaseUrl()}/decks/${deckId}`, {
    headers: authHeaders(token),
  })
  return readJsonOrThrow<DeckDetail>(response, "deck_fetch_failed")
}

export async function updateDeck(
  deckId: number,
  token: string,
  payload: DeckUpdatePayload
): Promise<DeckSummary> {
  const response = await fetch(`${apiBaseUrl()}/decks/${deckId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(token),
    },
    body: JSON.stringify(payload),
  })
  return readJsonOrThrow<DeckSummary>(response, "deck_update_failed")
}

export async function deleteDeck(
  deckId: number,
  token: string
): Promise<void> {
  const response = await fetch(`${apiBaseUrl()}/decks/${deckId}`, {
    method: "DELETE",
    headers: authHeaders(token),
  })
  if (!response.ok) {
    throw new ApiError(
      response.status,
      await parseErrorDetail(response, "deck_delete_failed")
    )
  }
}

export type AddDeckCardPayload = {
  card_id: number
  quantity?: number
  category_id?: number
  sort_order?: number
}

export async function addDeckCard(
  deckId: number,
  token: string,
  payload: AddDeckCardPayload
): Promise<DeckCardEntry> {
  const response = await fetch(`${apiBaseUrl()}/decks/${deckId}/cards`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(token),
    },
    body: JSON.stringify(payload),
  })
  return readJsonOrThrow<DeckCardEntry>(response, "deck_card_add_failed")
}

export async function createDeckCategory(
  deckId: number,
  token: string,
  name: string
): Promise<DeckCategoryOut> {
  const response = await fetch(`${apiBaseUrl()}/decks/${deckId}/categories`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(token),
    },
    body: JSON.stringify({ name }),
  })
  return readJsonOrThrow<DeckCategoryOut>(response, "category_create_failed")
}

export async function updateDeckCategory(
  deckId: number,
  categoryId: number,
  token: string,
  payload: { name?: string; sort_order?: number }
): Promise<DeckCategoryOut> {
  const response = await fetch(
    `${apiBaseUrl()}/decks/${deckId}/categories/${categoryId}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(token),
      },
      body: JSON.stringify(payload),
    }
  )
  return readJsonOrThrow<DeckCategoryOut>(response, "category_update_failed")
}

export async function deleteDeckCategory(
  deckId: number,
  categoryId: number,
  token: string
): Promise<void> {
  const response = await fetch(
    `${apiBaseUrl()}/decks/${deckId}/categories/${categoryId}`,
    {
      method: "DELETE",
      headers: authHeaders(token),
    }
  )
  if (!response.ok) {
    throw new ApiError(
      response.status,
      await parseErrorDetail(response, "category_delete_failed")
    )
  }
}

export type UpdateDeckCardPayload = {
  quantity?: number
  category_id?: number
  sort_order?: number
}

/** Move / update a card entry. Pass `fromCategoryId` as the current category query param. */
export async function updateDeckCard(
  deckId: number,
  cardId: number,
  fromCategoryId: number,
  token: string,
  payload: UpdateDeckCardPayload
): Promise<DeckCardEntry> {
  const url = new URL(`${apiBaseUrl()}/decks/${deckId}/cards/${cardId}`)
  url.searchParams.set("category_id", String(fromCategoryId))
  const response = await fetch(url, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(token),
    },
    body: JSON.stringify(payload),
  })
  return readJsonOrThrow<DeckCardEntry>(response, "deck_card_update_failed")
}

export async function removeDeckCard(
  deckId: number,
  cardId: number,
  categoryId: number,
  token: string
): Promise<void> {
  const url = new URL(`${apiBaseUrl()}/decks/${deckId}/cards/${cardId}`)
  url.searchParams.set("category_id", String(categoryId))
  const response = await fetch(url, {
    method: "DELETE",
    headers: authHeaders(token),
  })
  if (!response.ok) {
    throw new ApiError(
      response.status,
      await parseErrorDetail(response, "deck_card_remove_failed")
    )
  }
}

export function deckCoverUrl(path: string | null | undefined): string | null {
  if (!path) return null
  if (path.startsWith("http")) return path
  return `${apiBaseUrl()}/thumbnails/${path.replace(/^\//, "")}`
}

/**
 * Card art is stored as `thumbnails/...` while StaticFiles mounts that folder at `/thumbnails`.
 * Pass `version` (e.g. card_art_version) so re-uploads bust the browser cache.
 */
export function cardArtUrl(
  path: string | null | undefined,
  version?: number | null
): string | null {
  if (!path) return null
  if (path.startsWith("http")) return path
  const cleaned = path.replace(/^\/?thumbnails\//, "")
  const base = `${apiBaseUrl()}/thumbnails/${cleaned}`
  if (version == null) return base
  return `${base}?v=${version}`
}
