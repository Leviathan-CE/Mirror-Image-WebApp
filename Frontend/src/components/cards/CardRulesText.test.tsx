import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import {
  CardRulesText,
  decodeRulesTextEscapes,
} from "@/components/cards/CardRulesText"

describe("decodeRulesTextEscapes", () => {
  it("turns literal \\u2022 into a bullet", () => {
    expect(decodeRulesTextEscapes("Choose one:\\n\\u2022 Draw")).toBe(
      "Choose one:\\n• Draw"
    )
  })
})

describe("CardRulesText", () => {
  it("renders bullets from Unity unicode escapes", () => {
    render(
      <CardRulesText text={"Choose one:\n\\u2022 Draw a card.\n\\u2022 Peer 1."} />
    )
    expect(screen.getByText(/• Draw a card/)).toBeInTheDocument()
    expect(screen.getByText(/• Peer 1/)).toBeInTheDocument()
  })
})
