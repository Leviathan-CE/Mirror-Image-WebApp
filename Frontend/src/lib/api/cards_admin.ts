/**
 * Admin catalogue card API (publish status + lagality bulk tools).
 */

import { apiBaseUrl, authHeaders, readJsonOrThrow } from "@/lib/api/client"

export type PublishStatus = "published" | "preview" | "not published"

export const PUBLISH_STATUSES: PublishStatus[] = [
  "published",
  "preview",
  "not published",
]

/** Common lagality tags (DB column spelling is intentional). */
export const LAGALITY_OPTIONS = [
  "Legal",
  "Banned",
  "Restricted",
  "Not Legal",
] as const

export type AdminCardItem = {
  id: number
  card_name: string
  card_set_name: string
  rarity: string
  lagality: string
  published: PublishStatus | string
  is_deprecated: boolean
  card_art_path: string | null
  card_art_version?: number | null
}

export type AdminCardLibraryResponse = {
  items: AdminCardItem[]
  total: number
  limit: number
  offset: number
}

export type AdminCardBulkUpdate = {
  card_ids: number[]
  published?: PublishStatus
  lagality?: string
}

/** Admin catalogue browse — same name ranking as library/search. */
export async function fetchAdminCardLibrary(
  token: string,
  query: { q?: string; limit?: number; offset?: number } = {}
): Promise<AdminCardLibraryResponse> {
  const url = new URL(`${apiBaseUrl()}/cards/admin/library`)
  const q = query.q?.trim()
  if (q) url.searchParams.set("q", q)
  url.searchParams.set("limit", String(query.limit ?? 48))
  url.searchParams.set("offset", String(query.offset ?? 0))

  const response = await fetch(url, { headers: authHeaders(token) })
  return readJsonOrThrow<AdminCardLibraryResponse>(
    response,
    "admin_card_library_failed"
  )
}

/** Bulk-set publish status and/or lagality for selected cards. */
export async function bulkUpdateAdminCards(
  token: string,
  body: AdminCardBulkUpdate
): Promise<{ updated: number }> {
  const response = await fetch(`${apiBaseUrl()}/cards/admin/bulk`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(token),
    },
    body: JSON.stringify(body),
  })
  return readJsonOrThrow<{ updated: number }>(
    response,
    "admin_bulk_update_failed"
  )
}
