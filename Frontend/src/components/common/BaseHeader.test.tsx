import { render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { describe, expect, it } from "vitest"

import { ROUTES } from "@/lib/route"

import { PublicHeader } from "./PublicHeader"

function renderHeader() {
  return render(
    <MemoryRouter>
      <PublicHeader />
    </MemoryRouter>
  )
}

describe("PublicHeader", () => {
  it("renders the site title and home navigation", () => {
    renderHeader()

    expect(screen.getByRole("link", { name: "MIRRORIMAGE" })).toHaveAttribute(
      "href",
      ROUTES.HOME
    )
    expect(screen.getByRole("button", { name: "HOME" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "LOGIN" })).toBeInTheDocument()
  })
})
