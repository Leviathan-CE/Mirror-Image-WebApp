import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { DeckCategorySection } from "./DeckCategorySection"

describe("DeckCategorySection", () => {
  it("renames via the options menu", async () => {
    const user = userEvent.setup()
    const onRename = vi.fn().mockResolvedValue(undefined)
    const onDelete = vi.fn().mockResolvedValue(undefined)

    render(
      <DeckCategorySection
        category={{ id: 3, name: "Main", sort_order: 0 }}
        cards={[]}
        canEdit
        onRename={onRename}
        onDelete={onDelete}
      />
    )

    await user.click(screen.getByRole("button", { name: "Main options" }))
    await user.click(screen.getByRole("menuitem", { name: "Rename" }))

    const input = screen.getByDisplayValue("Main")
    await user.clear(input)
    await user.type(input, "Core")
    await user.click(screen.getByRole("button", { name: "SAVE" }))

    expect(onRename).toHaveBeenCalledWith("Core")
  })

  it("deletes via the options menu", async () => {
    const user = userEvent.setup()
    const onDelete = vi.fn().mockResolvedValue(undefined)

    render(
      <DeckCategorySection
        category={{ id: 4, name: "Side", sort_order: 1 }}
        cards={[]}
        canEdit
        onRename={vi.fn()}
        onDelete={onDelete}
      />
    )

    await user.click(screen.getByRole("button", { name: "Side options" }))
    await user.click(screen.getByRole("menuitem", { name: "Delete" }))
    expect(onDelete).toHaveBeenCalledOnce()
  })

  it("hides the menu when reserved", () => {
    render(
      <DeckCategorySection
        category={{ id: 2, name: "Augments", sort_order: -1 }}
        cards={[]}
        canEdit
        reserved
        onRename={vi.fn()}
        onDelete={vi.fn()}
      />
    )
    expect(
      screen.queryByRole("button", { name: /options/i })
    ).not.toBeInTheDocument()
  })
})
