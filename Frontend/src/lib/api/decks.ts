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
  like_count?: number
  view_count?: number
  tags?: string[]
  liked_by_me?: boolean
  card_art_path?: string | null
  card_art_version?: number | null
}

export type DeckListPage = {
  items: DeckSummary[]
  total: number
  limit: number
  offset: number
}

export type PublicDeckSort =
  | "newest"
  | "likes"
  | "likes_asc"
  | "views"
  | "views_asc"
  | "name"

export type PublicDeckColorMode = "or" | "and" | "not"

export type PublicDeckQuery = {
  q?: string
  author?: string
  tag?: string
  card?: string
  cardId?: number
  colors?: string[]
  colorMode?: PublicDeckColorMode
  sort?: PublicDeckSort
  limit?: number
  offset?: number
  token?: string | null
}

/** Names seeded on new decks — users can rename/add/remove per deck. */
export const DEFAULT_DECK_CATEGORY_NAMES = [
  "Entity",
  "Cyberspell",
] as const

/** Visual reserved section names (created on the client when needed). */
export const PILOT_SECTION_NAME = "Pilot"
export const AUGMENT_SECTION_NAME = "Augments"

export type DeckCategoryOut = {
  id: number
  name: string
  sort_order: number
  /** False = list-only pile (not shuffled into the RIG). */
  in_deck?: boolean
}

/** Shared catalogue projection — defined with the card domain. */
export type { CardSummary } from "@/lib/api/cards"
import type { CardSummary } from "@/lib/api/cards"

/** One deck membership row: section placement + nested card summary. */
export type DeckCardEntry = {
  quantity: number
  category_id: number
  category_name: string
  sort_order: number
  card: CardSummary
  /**
   * Server stripped preview / unpublished art for this viewer.
   * Trust this flag — do not re-derive from subscription client-side alone.
   */
  is_classified?: boolean
  /**
   * Why the card is redacted:
   * - classified — preview card (subscribe CTA)
   * - top_secret — not published (coming soon)
   */
  classification?: "classified" | "top_secret" | null
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

/** Public deck catalogue — no auth required (send token for liked_by_me). */
export async function fetchPublicDecks(
  query: PublicDeckQuery = {}
): Promise<DeckListPage> {
  const url = new URL(`${apiBaseUrl()}/decks/public`)
  if (query.q?.trim()) url.searchParams.set("q", query.q.trim())
  if (query.author?.trim()) url.searchParams.set("author", query.author.trim())
  if (query.tag?.trim()) url.searchParams.set("tag", query.tag.trim())
  if (query.card?.trim()) url.searchParams.set("card", query.card.trim())
  if (query.cardId != null) url.searchParams.set("card_id", String(query.cardId))
  for (const color of query.colors ?? []) {
    const token = color.trim()
    if (token) url.searchParams.append("color", token)
  }
  if (query.colorMode && query.colorMode !== "or") {
    url.searchParams.set("color_mode", query.colorMode)
  }
  if (query.sort) url.searchParams.set("sort", query.sort)
  url.searchParams.set("limit", String(query.limit ?? 24))
  url.searchParams.set("offset", String(query.offset ?? 0))

  const response = await fetch(url.toString(), {
    headers: authHeaders(query.token),
  })
  return readJsonOrThrow<DeckListPage>(response, "public_decks_fetch_failed")
}

export async function likeDeck(
  deckId: number,
  token: string
): Promise<DeckSummary> {
  const response = await fetch(`${apiBaseUrl()}/decks/${deckId}/like`, {
    method: "POST",
    headers: authHeaders(token),
  })
  return readJsonOrThrow<DeckSummary>(response, "deck_like_failed")
}

export async function unlikeDeck(
  deckId: number,
  token: string
): Promise<DeckSummary> {
  const response = await fetch(`${apiBaseUrl()}/decks/${deckId}/like`, {
    method: "DELETE",
    headers: authHeaders(token),
  })
  return readJsonOrThrow<DeckSummary>(response, "deck_unlike_failed")
}

export async function addDeckTag(
  deckId: number,
  token: string,
  tag: string
): Promise<DeckSummary> {
  const response = await fetch(`${apiBaseUrl()}/decks/${deckId}/tags`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(token),
    },
    body: JSON.stringify({ tag }),
  })
  return readJsonOrThrow<DeckSummary>(response, "deck_tag_add_failed")
}

export async function removeDeckTag(
  deckId: number,
  token: string,
  tag: string
): Promise<DeckSummary> {
  const response = await fetch(
    `${apiBaseUrl()}/decks/${deckId}/tags/${encodeURIComponent(tag)}`,
    {
      method: "DELETE",
      headers: authHeaders(token),
    }
  )
  return readJsonOrThrow<DeckSummary>(response, "deck_tag_remove_failed")
}

export type DeckTagSuggestion = {
  tag: string
  uses: number
}

/** Typeahead existing tags across all decks. */
export async function fetchDeckTagSuggestions(opts: {
  q?: string
  limit?: number
  exclude?: string[]
}): Promise<DeckTagSuggestion[]> {
  const url = new URL(`${apiBaseUrl()}/decks/tags`)
  if (opts.q?.trim()) url.searchParams.set("q", opts.q.trim())
  url.searchParams.set("limit", String(opts.limit ?? 12))
  if (opts.exclude?.length) {
    url.searchParams.set("exclude", opts.exclude.join(","))
  }
  const response = await fetch(url.toString())
  const body = await readJsonOrThrow<{ tags: DeckTagSuggestion[] }>(
    response,
    "deck_tag_suggest_failed"
  )
  return body.tags
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

/** Clone a readable deck into your collection (private copy you can edit). */
export async function copyDeck(
  deckId: number,
  token: string
): Promise<DeckSummary> {
  const response = await fetch(`${apiBaseUrl()}/decks/${deckId}/copy`, {
    method: "POST",
    headers: authHeaders(token),
  })
  return readJsonOrThrow<DeckSummary>(response, "deck_copy_failed")
}

/**
 * Public or owned deck detail (send token when logged in).
 *
 * `room` is a playtest room code: inside a live room the server pools the two
 * seated players' entitlements, so preview / unpublished cards resolve for both
 * sides and you can read the deck your opponent seated. Unknown codes are
 * ignored server-side, never an error.
 */
export async function fetchDeckDetail(
  deckId: number,
  token?: string | null,
  room?: string | null
): Promise<DeckDetail> {
  const url = new URL(`${apiBaseUrl()}/decks/${deckId}`)
  if (room) url.searchParams.set("room", room)

  const response = await fetch(url, { headers: authHeaders(token) })
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
  name: string,
  options?: { in_deck?: boolean }
): Promise<DeckCategoryOut> {
  const response = await fetch(`${apiBaseUrl()}/decks/${deckId}/categories`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(token),
    },
    body: JSON.stringify({
      name,
      ...(options?.in_deck != null ? { in_deck: options.in_deck } : {}),
    }),
  })
  return readJsonOrThrow<DeckCategoryOut>(response, "category_create_failed")
}

export async function updateDeckCategory(
  deckId: number,
  categoryId: number,
  token: string,
  payload: { name?: string; sort_order?: number; in_deck?: boolean }
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

/**
 * Images arrive as pre-signed relative URLs (`media/...?exp=..&sig=..`) minted
 * by the API for a viewer it already decided may see them. Only the origin is
 * added here: a missing path means the server withheld the image, and there is
 * no path a client could construct on its own.
 */
function mediaUrl(path: string, version?: number | null): string {
  if (path.startsWith("http")) return path
  const relative = path.replace(/^\//, "")
  const base = `${apiBaseUrl()}/${relative}`
  if (version == null) return base
  return `${base}${relative.includes("?") ? "&" : "?"}v=${version}`
}

export function deckCoverUrl(path: string | null | undefined): string | null {
  if (!path) return null
  return mediaUrl(path)
}

/** Pass `version` (card_art_version) so re-uploads bust the browser cache. */
export function cardArtUrl(
  path: string | null | undefined,
  version?: number | null
): string | null {
  if (!path) return null
  return mediaUrl(path, version)
}
