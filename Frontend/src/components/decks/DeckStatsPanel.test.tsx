import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { deckEntry } from "@/test/deckEntry.fixture"
import type { DeckCategoryOut, DeckDetail } from "@/lib/api/decks"
import { DeckStatsPanel } from "./DeckStatsPanel"

const fetchSimilar = vi.hoisted(() =>
  vi.fn(async () => ({
    tags: [{ tag: "Aggro", decks: 4 }],
    compared: 4,
  }))
)

vi.mock("@/lib/api/decks", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api/decks")>(
    "@/lib/api/decks"
  )
  return {
    ...actual,
    fetchSimilarDeckTags: fetchSimilar,
  }
})

function cat(
  id: number,
  name: string,
  in_deck = true
): DeckCategoryOut {
  return { id, name, sort_order: id, in_deck }
}

function sampleDeck(): DeckDetail {
  const categories = [
    cat(1, "Pilot", false),
    cat(2, "Entity"),
  ]
  return {
    id: 7,
    name: "Sample",
    description: null,
    is_public: false,
    author_name: "tester",
    cover_image_path: null,
    card_count: 2,
    tags: [],
    categories,
    cards: [
      deckEntry({
        card_id: 1,
        category_id: 1,
        card_name: "Pilot",
        is_pilot: true,
        hand_size: 5,
        spirit_capacity: 2,
        has_invoke_cost: true,
        invoke_cost: 0,
      }),
      deckEntry({
        card_id: 2,
        category_id: 2,
        quantity: 4,
        card_name: "Bolt",
        has_invoke_cost: true,
        invoke_cost: 1,
        cost: ["LIF"],
      }),
      deckEntry({
        card_id: 3,
        category_id: 2,
        quantity: 2,
        card_name: "Heavy",
        has_invoke_cost: true,
        invoke_cost: 4,
        cost: ["LIF", "LIF", "GEN2"],
      }),
    ],
  }
}

describe("DeckStatsPanel", () => {
  it("follows the cost bar, the seat, and a suggested tag", async () => {
    const user = userEvent.setup()
    const onAddTag = vi.fn()
    render(
      <DeckStatsPanel
        deck={sampleDeck()}
        token={null}
        disabled={false}
        onAddTag={onAddTag}
      />
    )

    expect(screen.getByText("DRAW THIS")).toBeTruthy()
    await user.click(screen.getByRole("button", { name: "4, 2" }))
    expect(screen.getByText("cost 4")).toBeTruthy()
    await user.click(screen.getByRole("button", { name: "2ND" }))
    expect(
      screen.getAllByText(/going second/).length
    ).toBeGreaterThan(0)
    const tag = await screen.findByRole("button", { name: "Aggro" })
    await user.click(tag)
    expect(onAddTag).toHaveBeenCalledWith("Aggro")
    await waitFor(() => {
      expect(fetchSimilar).toHaveBeenCalled()
    })
  })
})
