import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useState } from "react"
import { describe, expect, it } from "vitest"

import { DeckPanelToggle } from "./DeckPanelToggle"

function Harness() {
  const [statsOn, setStatsOn] = useState(false)
  return (
    <div>
      <DeckPanelToggle statsOn={statsOn} onChange={setStatsOn} />
      <p>{statsOn ? "stats" : "library"}</p>
    </div>
  )
}

describe("DeckPanelToggle", () => {
  it("switches the aside from the toggle", async () => {
    const user = userEvent.setup()
    render(<Harness />)
    const toggle = screen.getByRole("switch", {
      name: "Library or stats",
    })
    expect(toggle).toHaveAttribute("aria-checked", "false")
    await user.click(toggle)
    expect(screen.getByText("stats")).toBeTruthy()
    await user.click(screen.getByRole("button", { name: "LIBRARY" }))
    expect(screen.getByText("library")).toBeTruthy()
  })
})
