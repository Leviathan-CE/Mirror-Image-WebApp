import { render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { describe, expect, it } from "vitest"

import { PublicHeader } from "./PublicHeader"

function renderHeader() {
  return render(
    <MemoryRouter>
      <PublicHeader />
    </MemoryRouter>
  )
}

describe("PublicHeader", () => {
  it("renders home and login navigation", () => {
    renderHeader()

    expect(screen.getByRole("button", { name: "HOME" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "LOGIN" })).toBeInTheDocument()
  })
})
