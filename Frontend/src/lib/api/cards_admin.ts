/**
 * Admin catalogue card API (publish status + lagality bulk tools).
 */

import { apiBaseUrl, authHeaders, readJsonOrThrow } from "@/lib/api/client"
import type { CardLibraryQuery } from "@/lib/api/cards"

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

/** Admin catalogue browse — same filters as user card library + publish status. */
export type AdminCardLibraryQuery = CardLibraryQuery & {
  published?: PublishStatus
}

export async function fetchAdminCardLibrary(
  token: string,
  query: AdminCardLibraryQuery = {}
): Promise<AdminCardLibraryResponse> {
  const url = new URL(`${apiBaseUrl()}/cards/admin/library`)
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
  if (query.published) {
    url.searchParams.set("published", query.published)
  }
  if (query.sort) url.searchParams.set("sort", query.sort)
  url.searchParams.set("limit", String(query.limit ?? 48))
  url.searchParams.set("offset", String(query.offset ?? 0))

  const response = await fetch(url, { headers: authHeaders(token) })
  return readJsonOrThrow<AdminCardLibraryResponse>(
    response,
    "admin_card_library_failed"
  )
}

export type AdminCardDetail = {
  id: number
  card_name: string
  card_set_name: string
  rarity: string
  invoke_cost: number
  cost: string[]
  super_types: string[]
  sub_types: string[]
  types_line: string
  description: string
  keywords: string[]
  show_help_text: boolean
  threat_level: string
  card_art_path: string | null
  card_art_version?: number | null
  lagality: string
  published: PublishStatus | string
  is_deprecated: boolean
}

export async function fetchAdminCardDetail(
  token: string,
  cardId: number
): Promise<AdminCardDetail> {
  const response = await fetch(
    `${apiBaseUrl()}/cards/admin/library/${cardId}`,
    { headers: authHeaders(token) }
  )
  return readJsonOrThrow<AdminCardDetail>(response, "admin_card_detail_failed")
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
