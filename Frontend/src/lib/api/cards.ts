/**
 * Card catalog API (search / lookup).
 */

import { apiBaseUrl, readJsonOrThrow } from "@/lib/api/client"

export type CardSearchHit = {
  id: number
  card_name: string
  card_set_name: string
  rarity: string
  card_art_path: string | null
  card_art_version?: number | null
}

export type CardDetail = {
  id: number
  card_name: string
  is_pilot: boolean
  is_augment: boolean
  card_art_path: string | null
}

export async function searchCards(
  query: string,
  limit = 12
): Promise<CardSearchHit[]> {
  const q = query.trim()
  if (!q) return []

  const url = new URL(`${apiBaseUrl()}/cards/search`)
  url.searchParams.set("q", q)
  url.searchParams.set("limit", String(limit))

  const response = await fetch(url)
  return readJsonOrThrow<CardSearchHit[]>(response, "card_search_failed")
}

/** Card-by-id payload uses serialization alias `ID`. */
export async function fetchCardById(cardId: number): Promise<CardDetail> {
  const response = await fetch(`${apiBaseUrl()}/cards/${cardId}`)
  const raw = await readJsonOrThrow<{
    ID?: number
    id?: number
    card_name: string
    is_pilot: boolean
    is_augment: boolean
    card_art_path: string | null
  }>(response, "card_fetch_failed")

  const id = raw.ID ?? raw.id
  if (id == null) throw new Error("card_fetch_failed")

  return {
    id,
    card_name: raw.card_name,
    is_pilot: Boolean(raw.is_pilot),
    is_augment: Boolean(raw.is_augment),
    card_art_path: raw.card_art_path,
  }
}
