import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"

import type { AuthUser } from "@/lib/api"

import { AppHeader } from "./AppHeader"

const sampleUser: AuthUser = {
  id: 1,
  user_name: "operator_one",
  email: "user@localhost",
}

const clearSession = vi.fn()

const useAuthMock = vi.fn()

vi.mock("@/app/providers/AuthProvider", () => ({
  useAuth: () => useAuthMock(),
}))

function renderAppHeader() {
  return render(
    <MemoryRouter>
      <AppHeader />
    </MemoryRouter>
  )
}

describe("AppHeader", () => {
  beforeEach(() => {
    clearSession.mockReset()
    useAuthMock.mockReset()
  })

  it("renders BaseHeader when the user is not authenticated", () => {
    useAuthMock.mockReturnValue({
      user: null,
      token: null,
      isAuthenticated: false,
      setSession: vi.fn(),
      clearSession,
    })

    renderAppHeader()

    expect(screen.getByRole("link", { name: "MIRRORIMAGE" })).toHaveAttribute(
      "href",
      "/"
    )
    expect(screen.getByRole("button", { name: "LOGIN" })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "LOGOUT" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "DECKS" })).not.toBeInTheDocument()
  })

  it("renders OperatorHeader when the user is authenticated", () => {
    useAuthMock.mockReturnValue({
      user: sampleUser,
      token: "test-token",
      isAuthenticated: true,
      setSession: vi.fn(),
      clearSession,
    })

    renderAppHeader()

    expect(screen.getByRole("link", { name: "MIRRORIMAGE" })).toHaveAttribute(
      "href",
      "/main"
    )
    expect(screen.getByText("operator_one")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "DECKS" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "LOGOUT" })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "LOGIN" })).not.toBeInTheDocument()
  })

  it("calls clearSession when LOGOUT is clicked", async () => {
    const user = userEvent.setup()
    useAuthMock.mockReturnValue({
      user: sampleUser,
      token: "test-token",
      isAuthenticated: true,
      setSession: vi.fn(),
      clearSession,
    })

    renderAppHeader()
    await user.click(screen.getByRole("button", { name: "LOGOUT" }))

    expect(clearSession).toHaveBeenCalledTimes(1)
  })
})
