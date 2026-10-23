import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { DeckPrintoutDialog } from "@/components/decks/DeckPrintoutDialog"
import type { DeckPrintoutSlot } from "@/components/decks/deckPrintout.logic"

const slots: DeckPrintoutSlot[] = [
  {
    card_id: 1,
    card_name: "Pilot",
    card_art_path: null,
    section: "pilot",
  },
]

describe("DeckPrintoutDialog", () => {
  it("offers preview, backs, margin, and file name then submits them", async () => {
    const user = userEvent.setup()
    const onGenerate = vi.fn()

    render(
      <DeckPrintoutDialog
        open
        slots={slots}
        deckName="Core Set"
        cardBackSrc="/back.png"
        busy={false}
        onCancel={vi.fn()}
        onGenerate={onGenerate}
      />
    )

    expect(screen.getByRole("dialog", { name: "Print deck" })).toBeInTheDocument()
    expect(
      screen.getByRole("checkbox", { name: /print card backs/i })
    ).toBeChecked()
    expect(screen.getByDisplayValue("Core_Set_printout.pdf")).toBeInTheDocument()
    expect(screen.getByText("Pilot")).toBeInTheDocument()

    await user.click(screen.getByRole("checkbox", { name: /print card backs/i }))
    await user.click(screen.getByRole("button", { name: "Create PDF" }))

    expect(onGenerate).toHaveBeenCalledWith({
      includeBacks: false,
      marginMm: 10,
      fileName: "Core_Set_printout.pdf",
    })
  })
})
