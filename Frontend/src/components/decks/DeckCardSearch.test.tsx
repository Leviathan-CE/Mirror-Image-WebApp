import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { DeckCardSearch } from "./DeckCardSearch"
import type { CardSearchHit } from "@/lib/api/cards"

vi.mock("@/lib/api/cards", () => ({
  searchCards: vi.fn(),
}))

import { searchCards } from "@/lib/api/cards"

const hit: CardSearchHit = {
  id: 11,
  card_name: "Bolt Lightning",
  card_set_name: "Aeratheas",
  rarity: "common",
  card_art_path: null,
}

describe("DeckCardSearch", () => {
  beforeEach(() => {
    vi.mocked(searchCards).mockReset()
  })

  it("searches after typing and calls onPick for a hit", async () => {
    const user = userEvent.setup()
    const onPick = vi.fn().mockResolvedValue(undefined)
    vi.mocked(searchCards).mockResolvedValue([hit])

    render(<DeckCardSearch onPick={onPick} />)

    await user.type(screen.getByRole("combobox"), "bolt")

    await waitFor(() => {
      expect(searchCards).toHaveBeenCalled()
    })
    const option = await screen.findByRole("option", { name: /Bolt Lightning/i })
    await user.click(option.querySelector("button")!)
    expect(onPick).toHaveBeenCalledWith(hit)
  })

  it("shows no matches when search returns empty", async () => {
    const user = userEvent.setup()
    vi.mocked(searchCards).mockResolvedValue([])

    render(<DeckCardSearch onPick={vi.fn()} />)
    await user.type(screen.getByRole("combobox"), "zzz")

    expect(await screen.findByText("No matches")).toBeInTheDocument()
  })
})
