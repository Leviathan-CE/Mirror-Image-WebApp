import { describe, expect, it } from "vitest"

import {
  bannersFromNotifications,
  changeViewFromPayload,
  eventIdsForCards,
  latestChangeForCard,
  libraryItemFromSnapshot,
  mergeSeenEventIds,
} from "./cardBanner.logic"
import type { NotificationItem } from "@/lib/api/notifications"

function item(
  partial: Partial<NotificationItem> &
    Pick<NotificationItem, "id" | "kind" | "subject_id">
): NotificationItem {
  return {
    title: "t",
    summary: "s",
    payload: {},
    audience: "all",
    created_at: null,
    read: false,
    subject_type: "card",
    ...partial,
  }
}

describe("bannersFromNotifications", () => {
  it("uses the newest unread unseen event per card", () => {
    const banners = bannersFromNotifications(
      [
        item({
          id: 20,
          kind: "card.updated",
          subject_id: 5,
        }),
        item({
          id: 10,
          kind: "card.created",
          subject_id: 5,
        }),
      ],
      new Set()
    )
    expect(banners.get(5)?.kind).toBe("updated")
    expect(banners.get(5)?.eventId).toBe(20)
  })

  it("hides read or already-seen events", () => {
    const banners = bannersFromNotifications(
      [
        item({
          id: 3,
          kind: "card.created",
          subject_id: 1,
          read: true,
        }),
        item({
          id: 2,
          kind: "card.updated",
          subject_id: 2,
        }),
      ],
      new Set([2])
    )
    expect(banners.size).toBe(0)
  })
})

describe("eventIdsForCards", () => {
  it("collects every card event for the given cards", () => {
    const ids = eventIdsForCards(
      [
        item({ id: 20, kind: "card.updated", subject_id: 5 }),
        item({ id: 10, kind: "card.created", subject_id: 5 }),
        item({ id: 9, kind: "card.created", subject_id: 8 }),
      ],
      [5]
    )
    expect(ids).toEqual([20, 10])
  })
})

describe("mergeSeenEventIds", () => {
  it("keeps newest added ids first and caps length", () => {
    const merged = mergeSeenEventIds([2, 3], [9, 2], 3)
    expect(merged).toEqual([9, 2, 3])
  })
})

describe("latestChangeForCard", () => {
  it("keeps overlay diffs after the banner is seen", () => {
    const change = latestChangeForCard(
      [
        item({
          id: 20,
          kind: "card.updated",
          subject_id: 5,
          payload: {
            before: { description: "old" },
            after: { description: "new" },
          },
        }),
      ],
      5
    )
    expect(change?.kind).toBe("updated")
    expect(
      change?.rows.find((row) => row.key === "description")?.after
    ).toBe("new")
  })

  it("prefers the unread event so New is not replaced by a read update", () => {
    const change = latestChangeForCard(
      [
        item({
          id: 20,
          kind: "card.updated",
          subject_id: 5,
          read: true,
        }),
        item({
          id: 10,
          kind: "card.created",
          subject_id: 5,
          payload: { after: { card_name: "Bolt" } },
        }),
      ],
      5
    )
    expect(change?.kind).toBe("new")
  })
})

describe("libraryItemFromSnapshot", () => {
  it("fills catalogue fields from a notify snapshot", () => {
    const card = libraryItemFromSnapshot(7, {
      card_name: "Bolt",
      description: "Deal 1",
      invoke_cost: 2,
      cost: ["RAM"],
      has_tlv: true,
      threat_level: "3",
    })
    expect(card?.id).toBe(7)
    expect(card?.card_name).toBe("Bolt")
    expect(card?.has_invoke_cost).toBe(true)
    expect(card?.threat_level).toBe("3")
  })
})

describe("changeViewFromPayload", () => {
  it("marks a first publish as new", () => {
    const change = changeViewFromPayload("card.created", {
      after: { card_name: "Bolt", description: "Deal 1" },
    })
    expect(change?.kind).toBe("new")
    expect(
      change?.rows.some((row) => row.key === "card_name")
    ).toBe(true)
  })

  it("keeps before and after cost tokens for icon diffs", () => {
    const change = changeViewFromPayload("card.updated", {
      before: { cost: ["LIF"], invoke_cost: 1 },
      after: { cost: ["LIF", "RAM"], invoke_cost: 2 },
    })
    expect(change?.beforeCost).toEqual(["LIF"])
    expect(change?.afterCost).toEqual(["LIF", "RAM"])
  })
})
