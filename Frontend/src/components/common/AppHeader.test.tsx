import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router-dom"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type { AuthUser } from "@/lib/api/auth"

import { AppHeader } from "./AppHeader"

const sampleUser: AuthUser = {
  id: 1,
  user_name: "operator_one",
  email: "user@localhost",
  role: "user",
}

const clearSession = vi.fn()

const useAuthMock = vi.fn()
const useComingSoonMock = vi.fn()

vi.mock("@/app/providers/AuthProvider", () => ({
  useAuth: () => useAuthMock(),
}))

vi.mock("@/app/providers/ComingSoonProvider", () => ({
  useComingSoon: () => useComingSoonMock(),
}))

function renderAppHeader(initialPath = "/") {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <AppHeader />
    </MemoryRouter>
  )
}

describe("AppHeader", () => {
  beforeEach(() => {
    clearSession.mockReset()
    useAuthMock.mockReset()
    useComingSoonMock.mockReset()
    useComingSoonMock.mockReturnValue({
      comingSoon: false,
      ready: true,
      setComingSoonEnabled: vi.fn(),
    })
  })

  afterEach(() => {
    cleanup()
  })

  it("shows login when logged out", () => {
    useAuthMock.mockReturnValue({
      user: null,
      token: null,
      isAuthenticated: false,
      setSession: vi.fn(),
      clearSession,
    })
    renderAppHeader()
    expect(screen.getByRole("button", { name: "LOGIN" })).toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Account menu" })
    ).not.toBeInTheDocument()
  })

  it("shows account menu when logged in", () => {
    useAuthMock.mockReturnValue({
      user: sampleUser,
      token: "test-token",
      isAuthenticated: true,
      setSession: vi.fn(),
      clearSession,
    })
    renderAppHeader()
    expect(
      screen.getByRole("button", { name: "Account menu" })
    ).toBeInTheDocument()
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

  it("exposes Subscribe from the account menu", async () => {
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
    expect(
      screen.getByRole("menuitem", { name: "Subscribe" })
    ).toBeInTheDocument()
  })

  it("hides all chrome on the play-tester table for a playtester while coming-soon is on", () => {
    useComingSoonMock.mockReturnValue({
      comingSoon: true,
      ready: true,
      setComingSoonEnabled: vi.fn(),
    })
    useAuthMock.mockReturnValue({
      user: { ...sampleUser, role: "play_tester" },
      token: "test-token",
      isAuthenticated: true,
      setSession: vi.fn(),
      clearSession,
    })

    const { container } = renderAppHeader("/play_tester/42")
    expect(container).toBeEmptyDOMElement()
  })

  it("hides all chrome on the play-tester table for an admin while coming-soon is on", () => {
    useComingSoonMock.mockReturnValue({
      comingSoon: true,
      ready: true,
      setComingSoonEnabled: vi.fn(),
    })
    useAuthMock.mockReturnValue({
      user: { ...sampleUser, role: "admin" },
      token: "test-token",
      isAuthenticated: true,
      setSession: vi.fn(),
      clearSession,
    })

    const { container } = renderAppHeader("/play_tester/42")
    expect(container).toBeEmptyDOMElement()
  })

  it("still shows the coming-soon splash header for a plain user off the play-tester table", () => {
    useComingSoonMock.mockReturnValue({
      comingSoon: true,
      ready: true,
      setComingSoonEnabled: vi.fn(),
    })
    useAuthMock.mockReturnValue({
      user: sampleUser,
      token: "test-token",
      isAuthenticated: true,
      setSession: vi.fn(),
      clearSession,
    })

    renderAppHeader("/")
    expect(screen.getByRole("button", { name: "SIGN OUT" })).toBeInTheDocument()
  })
})
