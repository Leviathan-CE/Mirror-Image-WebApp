/**
 * Catalogue New/Updated banners from unread card notifications.
 * Seen ids are local to the browser so hover / page leave / inbox
 * preview can hide a ribbon without waiting on a network round-trip.
 */

import type { CardLibraryItem } from "@/lib/api/cards"
import type { NotificationItem } from "@/lib/api/notifications"
import {
  asCardSnapshot,
  cardDiffRows,
  type CardDiffRow,
  type CardSnapshot,
} from "@/lib/inboxCardDiff.logic"

export const CARD_BANNER_SEEN_PREFIX = "mi_card_banner_seen_"
export const CARD_BANNER_SEEN_CAP = 500

export type CardBannerKind = "new" | "updated"

export type CardChangeChipKind = CardBannerKind | "removed"

export type CardBanner = {
  eventId: number
  cardId: number
  kind: CardBannerKind
  payload: Record<string, unknown>
}

export type CardDetailChange = {
  kind: CardChangeChipKind
  rows: CardDiffRow[]
  /** Invoke-cost icon tokens from the notify snapshots. */
  beforeCost: string[]
  afterCost: string[]
}

export function bannerKindForNotificationKind(
  kind: string
): CardBannerKind | null {
  if (kind === "card.created") return "new"
  if (kind === "card.updated") return "updated"
  return null
}

export function isCardNotificationKind(kind: string): boolean {
  if (kind === "card.created") return true
  if (kind === "card.updated") return true
  if (kind === "card.removed") return true
  return false
}

export function changeChipLabel(kind: CardChangeChipKind): string {
  if (kind === "new") return "New"
  if (kind === "removed") return "Removed"
  return "Updated"
}

function asString(value: unknown): string {
  if (value == null) return ""
  return String(value)
}

function asNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value
  }
  const parsed = Number(value)
  if (Number.isFinite(parsed)) return parsed
  return 0
}

function asBool(value: unknown): boolean {
  if (value === true) return true
  return false
}

function asStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.map((item) => String(item))
}

export function mergeSeenEventIds(
  current: number[],
  added: number[],
  cap: number = CARD_BANNER_SEEN_CAP
): number[] {
  const merged: number[] = []
  const used = new Set<number>()
  const sources = [added, current]
  for (const source of sources) {
    for (const id of source) {
      if (id <= 0) continue
      if (used.has(id)) continue
      used.add(id)
      merged.push(id)
    }
  }
  if (merged.length <= cap) return merged
  return merged.slice(0, cap)
}

export function loadSeenEventIds(userId: number): number[] {
  if (userId <= 0) return []
  if (typeof window === "undefined") return []
  try {
    const raw = window.localStorage.getItem(
      `${CARD_BANNER_SEEN_PREFIX}${userId}`
    )
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    const ids: number[] = []
    for (const value of parsed) {
      if (typeof value !== "number") continue
      if (!Number.isInteger(value)) continue
      if (value <= 0) continue
      ids.push(value)
    }
    return ids
  } catch {
    return []
  }
}

export function saveSeenEventIds(
  userId: number,
  ids: number[]
): void {
  if (userId <= 0) return
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(
      `${CARD_BANNER_SEEN_PREFIX}${userId}`,
      JSON.stringify(ids)
    )
  } catch {
    /* ignore quota / private mode */
  }
}

export function bannersFromNotifications(
  items: NotificationItem[],
  seenEventIds: Set<number>
): Map<number, CardBanner> {
  const out = new Map<number, CardBanner>()
  for (const item of items) {
    if (item.read) continue
    if (seenEventIds.has(item.id)) continue
    const kind = bannerKindForNotificationKind(item.kind)
    if (kind == null) continue
    if (item.subject_id <= 0) continue
    if (out.has(item.subject_id)) continue
    out.set(item.subject_id, {
      eventId: item.id,
      cardId: item.subject_id,
      kind,
      payload: item.payload,
    })
  }
  return out
}

export function latestChangeForCard(
  items: NotificationItem[],
  cardId: number
): CardDetailChange | null {
  if (cardId <= 0) return null
  let fallback: CardDetailChange | null = null
  for (const item of items) {
    if (item.subject_id !== cardId) continue
    if (!isCardNotificationKind(item.kind)) continue
    const view = changeViewFromPayload(item.kind, item.payload)
    if (!item.read) return view
    if (fallback == null) fallback = view
  }
  return fallback
}

export function eventIdsForCards(
  items: NotificationItem[],
  cardIds: number[]
): number[] {
  if (cardIds.length === 0) return []
  const wanted = new Set(cardIds)
  const ids: number[] = []
  for (const item of items) {
    if (!wanted.has(item.subject_id)) continue
    if (!isCardNotificationKind(item.kind)) continue
    ids.push(item.id)
  }
  return ids
}

export function libraryItemFromSnapshot(
  cardId: number,
  snap: CardSnapshot | null
): CardLibraryItem | null {
  if (snap == null) return null
  if (cardId <= 0) return null
  const cost = asStringList(snap.cost)
  const invokeCost = asNumber(snap.invoke_cost)
  const name = asString(snap.card_name)
  return {
    id: cardId,
    card_name: name === "" ? `Card #${cardId}` : name,
    card_art_path: null,
    card_set_name: asString(snap.card_set_name),
    rarity: asString(snap.rarity),
    description: asString(snap.description),
    keywords: asStringList(snap.keywords),
    show_help_text: true,
    invoke_cost: invokeCost,
    has_invoke_cost: cost.length > 0 || invokeCost > 0,
    has_tlv: asBool(snap.has_tlv),
    cost,
    super_types: asStringList(snap.super_types),
    sub_types: asStringList(snap.sub_types),
    types_line: asString(snap.types_line),
    threat_level: asString(snap.threat_level) || "0",
    is_pilot: asBool(snap.is_pilot),
    is_augment: asBool(snap.is_augment),
    hand_size: asNumber(snap.hand_size),
    ram_capacity: asNumber(snap.ram_capacity),
    power_capacity: asNumber(snap.power_capacity),
    metal_capacity: asNumber(snap.metal_capacity),
    spirit_capacity: asNumber(snap.spirit_capacity),
    steel_capacity: asNumber(snap.steel_capacity),
    time_capacity: asNumber(snap.time_capacity),
    lif_capacity: asNumber(snap.lif_capacity),
  }
}

export function libraryItemFromNotification(
  item: Pick<NotificationItem, "subject_id" | "payload">
): CardLibraryItem | null {
  const after = asCardSnapshot(item.payload.after)
  const fromAfter = libraryItemFromSnapshot(item.subject_id, after)
  if (fromAfter) return fromAfter
  const before = asCardSnapshot(item.payload.before)
  return libraryItemFromSnapshot(item.subject_id, before)
}

export function changeViewFromPayload(
  kind: string,
  payload: Record<string, unknown>
): CardDetailChange | null {
  const before = asCardSnapshot(payload.before)
  const after = asCardSnapshot(payload.after)
  const rows = cardDiffRows(before, after)
  const beforeCost = asStringList(before?.cost)
  const afterCost = asStringList(after?.cost)
  if (kind === "card.created") {
    return { kind: "new", rows, beforeCost, afterCost }
  }
  if (kind === "card.updated") {
    return { kind: "updated", rows, beforeCost, afterCost }
  }
  if (kind === "card.removed") {
    return { kind: "removed", rows, beforeCost, afterCost }
  }
  return null
}

export function changedRow(
  rows: CardDiffRow[],
  key: string
): CardDiffRow | null {
  const row = rows.find((entry) => entry.key === key)
  if (!row) return null
  if (!row.changed) return null
  return row
}
