import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { HeaderNav } from "./HeaderNav"

describe("HeaderNav", () => {
  it("opens the sandwich menu and runs the chosen link", async () => {
    const user = userEvent.setup()
    const onDecks = vi.fn()

    render(
      <HeaderNav
        items={[
          { id: "decks", label: "DECKS", onSelect: onDecks },
          { id: "cards", label: "CARDS", onSelect: vi.fn() },
        ]}
      />
    )

    await user.click(screen.getByRole("button", { name: "Site menu" }))
    await user.click(screen.getByRole("menuitem", { name: "DECKS" }))
    expect(onDecks).toHaveBeenCalledOnce()
  })
})
