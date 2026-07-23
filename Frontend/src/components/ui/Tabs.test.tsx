import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { Tabs } from "@/components/ui/Tabs"

describe("Tabs", () => {
  it("switches selection on click", async () => {
    const user = userEvent.setup()
    const onValueChange = vi.fn()

    const { rerender } = render(
      <Tabs
        label="Deck views"
        items={[
          { id: "mine", label: "MY DECKS" },
          { id: "community", label: "COMMUNITY" },
        ]}
        value="mine"
        onValueChange={onValueChange}
      />
    )

    expect(screen.getByRole("tab", { name: "MY DECKS" })).toHaveAttribute(
      "aria-selected",
      "true"
    )

    await user.click(screen.getByRole("tab", { name: "COMMUNITY" }))
    expect(onValueChange).toHaveBeenCalledWith("community")

    rerender(
      <Tabs
        label="Deck views"
        items={[
          { id: "mine", label: "MY DECKS" },
          { id: "community", label: "COMMUNITY" },
        ]}
        value="community"
        onValueChange={onValueChange}
      />
    )

    expect(screen.getByRole("tab", { name: "COMMUNITY" })).toHaveAttribute(
      "aria-selected",
      "true"
    )
  })
})
