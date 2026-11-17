import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router-dom"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { InboxProvider } from "@/app/providers/InboxProvider"
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

vi.mock("@/app/providers/AuthProvider", () => ({
  useAuth: () => useAuthMock(),
}))

vi.mock("@/app/providers/ComingSoonProvider", () => ({
  useComingSoon: () => ({
    comingSoon: false,
    ready: true,
    setComingSoonEnabled: vi.fn(),
  }),
}))

vi.mock("@/lib/api/notifications", () => ({
  fetchNotifications: vi.fn(async () => ({
    items: [],
    total: 0,
    unread: 0,
    limit: 8,
    offset: 0,
  })),
  fetchUnreadCount: vi.fn(async () => ({ unread: 0 })),
  markNotificationRead: vi.fn(async () => ({ read: 0 })),
  markAllNotificationsRead: vi.fn(async () => ({ read: 0 })),
}))

function renderAppHeader() {
  return render(
    <MemoryRouter>
      <InboxProvider>
        <AppHeader />
      </InboxProvider>
    </MemoryRouter>
  )
}

describe("AppHeader", () => {
  beforeEach(() => {
    clearSession.mockReset()
    useAuthMock.mockReset()
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
    expect(screen.getByRole("button", { name: "Site menu" })).toBeInTheDocument()
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
    expect(screen.getByRole("button", { name: "Inbox" })).toBeInTheDocument()
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
})
