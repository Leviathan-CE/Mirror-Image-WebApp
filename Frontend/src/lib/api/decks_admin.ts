/**
 * Staff deck search and per-deck print price.
 */

import {
  apiBaseUrl,
  authHeaders,
  readJsonOrThrow,
  apiFetch,
} from "@/lib/api/client"

export type AdminDeckItem = {
  id: number
  name: string | null
  description: string | null
  is_public: boolean
  author_name: string
  owner_id: number
  card_count: number
  print_price_cents: number | null
}

export type AdminDeckList = {
  items: AdminDeckItem[]
  total: number
  limit: number
  offset: number
}

export type DeckVisibility = "all" | "public" | "private"

export async function fetchAdminDecks(
  token: string,
  query: {
    q?: string
    visibility?: DeckVisibility
    limit?: number
    offset?: number
  } = {}
): Promise<AdminDeckList> {
  const url = new URL(`${apiBaseUrl()}/admin/decks`)
  const q = query.q?.trim()
  if (q) url.searchParams.set("q", q)
  if (query.visibility) {
    url.searchParams.set("visibility", query.visibility)
  }
  if (query.limit != null) {
    url.searchParams.set("limit", String(query.limit))
  }
  if (query.offset != null) {
    url.searchParams.set("offset", String(query.offset))
  }
  const response = await apiFetch(url, { headers: authHeaders(token) })
  return readJsonOrThrow<AdminDeckList>(response, "admin_decks_failed")
}

export async function patchDeckPrintPrice(
  token: string,
  deckId: number,
  printPriceCents: number | null
): Promise<AdminDeckItem> {
  const response = await apiFetch(
    `${apiBaseUrl()}/admin/decks/${deckId}/print-price`,
    {
      method: "PATCH",
      headers: {
        ...authHeaders(token),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ print_price_cents: printPriceCents }),
    }
  )
  return readJsonOrThrow<AdminDeckItem>(
    response,
    "deck_print_price_failed"
  )
}
