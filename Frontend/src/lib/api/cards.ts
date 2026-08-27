/**
 * Card catalog API (search / library browse / lookup).
 * Pass an auth token when available so admin / subscriber JWTs unlock
 * unpublished or preview cards (server-side publish gate).
 */

import { apiBaseUrl, authHeaders, readJsonOrThrow } from "@/lib/api/client"

export type CardSearchHit = {
  id: number
  card_name: string
  card_set_name: string
  rarity: string
  card_art_path: string | null
  card_thumbnail_path?: string | null
  card_art_version?: number | null
}

export type CardDetail = {
  id: number
  card_name: string
  is_pilot: boolean
  is_augment: boolean
  card_art_path: string | null
  /** Used for deck copy limits (e.g. Token → unlimited). */
  super_types?: string[]
}

/**
 * Shared catalogue projection — nested under deck entries, base of library rows.
 * Keep aligned with Backend ``app.cards.schemas.CardSummary``.
 */
export type CardSummary = {
  id: number
  card_name: string
  card_art_path: string | null
  card_thumbnail_path?: string | null
  /** Epoch seconds — changes when card art is re-uploaded. */
  card_art_version?: number | null
  invoke_cost?: number
  /** Invoke-cost icon tokens (LIF, MET, GEN2, …). */
  cost?: string[]
  /** Printed threat level (TLV). */
  threat_level?: string
  types_line?: string
  super_types?: string[]
  sub_types?: string[]
  is_pilot?: boolean
  is_augment?: boolean
  /** Pilot opening hand size (0 on non-pilots). */
  hand_size?: number
  /** Starting stockpile resource counts printed on the pilot. */
  ram_capacity?: number
  power_capacity?: number
  metal_capacity?: number
  spirit_capacity?: number
  steel_capacity?: number
  time_capacity?: number
  /** Starting life total on pilots (not a resource token). */
  lif_capacity?: number
}

/** Library browse row = shared summary + set/rarity/text metadata. */
export type CardLibraryItem = CardSummary & {
  card_set_name: string
  rarity: string
  description: string
  keywords: string[]
  show_help_text: boolean
  /** Library always returns these; tighten vs optional CardSummary fields. */
  invoke_cost: number
  cost: string[]
  super_types: string[]
  sub_types: string[]
  types_line: string
  threat_level: string
}

export type CardLibraryResponse = {
  items: CardLibraryItem[]
  total: number
  limit: number
  offset: number
}

export type CardLibraryFacets = {
  colors: string[]
  super_types: string[]
  sub_types: string[]
  types_lines: string[]
  invoke_cost_min: number
  invoke_cost_max: number
}

export type CardLibrarySortMode =
  | "name"
  | "name_desc"
  | "invoke"
  | "invoke_desc"
  | "relevance"

export type CardLibraryQuery = {
  q?: string
  description?: string
  invokeCostMin?: number | null
  invokeCostMax?: number | null
  colors?: string[]
  typesLine?: string
  superType?: string
  subType?: string
  /** Result order: A–Z, Z–A, invoke ↑/↓, or name-search relevance. */
  sort?: CardLibrarySortMode
  limit?: number
  offset?: number
}

export async function searchCards(
  query: string,
  limit = 12,
  token?: string | null
): Promise<CardSearchHit[]> {
  const q = query.trim()
  if (!q) return []

  const url = new URL(`${apiBaseUrl()}/cards/search`)
  url.searchParams.set("q", q)
  url.searchParams.set("limit", String(limit))

  const response = await fetch(url, { headers: authHeaders(token) })
  return readJsonOrThrow<CardSearchHit[]>(response, "card_search_failed")
}

/** Full catalogue browse with filters; name (`q`) uses the same ranking as search. */
export async function fetchCardLibrary(
  query: CardLibraryQuery = {},
  token?: string | null
): Promise<CardLibraryResponse> {
  const url = new URL(`${apiBaseUrl()}/cards/library`)
  const q = query.q?.trim()
  if (q) url.searchParams.set("q", q)
  const description = query.description?.trim()
  if (description) url.searchParams.set("description", description)
  if (query.invokeCostMin != null) {
    url.searchParams.set("invoke_cost_min", String(query.invokeCostMin))
  }
  if (query.invokeCostMax != null) {
    url.searchParams.set("invoke_cost_max", String(query.invokeCostMax))
  }
  for (const color of query.colors ?? []) {
    const colorToken = color.trim()
    if (colorToken) url.searchParams.append("color", colorToken)
  }
  const typesLine = query.typesLine?.trim()
  if (typesLine) url.searchParams.set("types_line", typesLine)
  const superType = query.superType?.trim()
  if (superType) url.searchParams.set("super_type", superType)
  const subType = query.subType?.trim()
  if (subType) url.searchParams.set("sub_type", subType)
  if (query.sort) url.searchParams.set("sort", query.sort)
  url.searchParams.set("limit", String(query.limit ?? 48))
  url.searchParams.set("offset", String(query.offset ?? 0))

  const response = await fetch(url, { headers: authHeaders(token) })
  return readJsonOrThrow<CardLibraryResponse>(response, "card_library_failed")
}

export async function fetchCardFacets(
  token?: string | null
): Promise<CardLibraryFacets> {
  const response = await fetch(`${apiBaseUrl()}/cards/facets`, {
    headers: authHeaders(token),
  })
  return readJsonOrThrow<CardLibraryFacets>(response, "card_facets_failed")
}

/** Card-by-id payload uses serialization alias `ID`. */
export async function fetchCardById(
  cardId: number,
  token?: string | null
): Promise<CardDetail> {
  const response = await fetch(`${apiBaseUrl()}/cards/${cardId}`, {
    headers: authHeaders(token),
  })
  const raw = await readJsonOrThrow<{
    ID?: number
    id?: number
    card_name: string
    is_pilot: boolean
    is_augment: boolean
    card_art_path: string | null
    super_types?: string[] | null
  }>(response, "card_fetch_failed")

  const id = raw.ID ?? raw.id
  if (id == null) throw new Error("card_fetch_failed")

  return {
    id,
    card_name: raw.card_name,
    is_pilot: Boolean(raw.is_pilot),
    is_augment: Boolean(raw.is_augment),
    card_art_path: raw.card_art_path,
    super_types: Array.isArray(raw.super_types)
      ? raw.super_types.map(String)
      : [],
  }
}
