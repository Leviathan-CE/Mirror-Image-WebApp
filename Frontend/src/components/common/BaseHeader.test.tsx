import { render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { describe, expect, it } from "vitest"

import { BaseHeader } from "./BaseHeader"

function renderHeader() {
  return render(
    <MemoryRouter>
      <BaseHeader />
    </MemoryRouter>
  )
}

describe("BaseHeader", () => {
  it("renders the site title and home navigation", () => {
    renderHeader()

    expect(screen.getByRole("link", { name: "MIRRORIMAGE" })).toHaveAttribute(
      "href",
      "/"
    )
    expect(screen.getByRole("button", { name: "HOME" })).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "CREATE ACCOUNT" })
    ).toBeInTheDocument()
  })
})
