import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"

import type { AuthUser } from "@/lib/api/auth"
import { ROUTES } from "@/lib/route"

import { AppHeader } from "./AppHeader"

const sampleUser: AuthUser = {
  id: 1,
  user_name: "operator_one",
  email: "user@localhost",
  role: "user",
}

const clearSession = vi.fn()

const useAuthMock = vi.fn()

vi.mock("@/app/providers/AuthProvider", () => ({
  useAuth: () => useAuthMock(),
}))

function renderAppHeader(initialEntries?: string[]) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <AppHeader />
    </MemoryRouter>
  )
}

describe("AppHeader", () => {
  beforeEach(() => {
    clearSession.mockReset()
    useAuthMock.mockReset()
  })

  it("renders PublicHeader when the user is not authenticated", () => {
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
      ROUTES.HOME
    )
    expect(screen.getByRole("button", { name: "LOGIN" })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "LOGOUT" })).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "DECKS" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "CARDS" })).toBeInTheDocument()
  })

  it("renders UserHeader when the user is authenticated", () => {
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
      ROUTES.MAIN
    )
    expect(screen.getByText("operator_one")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "DECKS" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "CARDS" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Account menu" })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "LOGOUT" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "LOGIN" })).not.toBeInTheDocument()
  })

  it("calls clearSession when Sign out is chosen from the account menu", async () => {
    const user = userEvent.setup()
    useAuthMock.mockReturnValue({
      user: sampleUser,
      token: "test-token",
      isAuthenticated: true,
      setSession: vi.fn(),
      clearSession,
    })

    renderAppHeader()
    await user.click(screen.getByRole("button", { name: "Account menu" }))
    await user.click(screen.getByRole("menuitem", { name: "Sign out" }))

    expect(clearSession).toHaveBeenCalledTimes(1)
  })

  it("keeps PublicHeader on /cards when logged out", () => {
    useAuthMock.mockReturnValue({
      user: null,
      token: null,
      isAuthenticated: false,
      setSession: vi.fn(),
      clearSession,
    })

    renderAppHeader([ROUTES.CARDS])

    expect(screen.getByRole("button", { name: "CARDS" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "LOGIN" })).toBeInTheDocument()
  })
})
