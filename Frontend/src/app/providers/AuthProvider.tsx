/**
 * Client auth session for the SPA.
 *
 * - Hydrates token + user from localStorage on first paint.
 * - `setSession` / `clearSession` keep React state and localStorage in sync.
 * - `isAuthenticated` is true only when both token and user are present.
 *
 * Consumers: AppHeader (guest vs operator chrome), LoginPage, MainPage, etc.
 */

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react"

import type { AuthUser } from "@/lib/api/auth"

const TOKEN_KEY = "mi_access_token"
const USER_KEY = "mi_user"

type AuthContextValue = {
  user: AuthUser | null
  token: string | null
  isAuthenticated: boolean
  /** Persist JWT + user after a successful login/register. */
  setSession: (token: string, user: AuthUser) => void
  /** Clear JWT + user (logout). */
  clearSession: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

/** Best-effort parse of the stored user JSON; returns null on missing/invalid data. */
function readStoredUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY)
    if (!raw) return null
    return JSON.parse(raw) as AuthUser
  } catch {
    return null
  }
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [token, setToken] = useState<string | null>(() =>
    localStorage.getItem(TOKEN_KEY)
  )
  const [user, setUser] = useState<AuthUser | null>(() => readStoredUser())

  const setSession = useCallback((nextToken: string, nextUser: AuthUser) => {
    localStorage.setItem(TOKEN_KEY, nextToken)
    localStorage.setItem(USER_KEY, JSON.stringify(nextUser))
    setToken(nextToken)
    setUser(nextUser)
  }, [])

  const clearSession = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
    setToken(null)
    setUser(null)
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token,
      isAuthenticated: Boolean(token && user),
      setSession,
      clearSession,
    }),
    [user, token, setSession, clearSession]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

/** Access the auth session. Must be used under `AuthProvider`. */
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider")
  }
  return ctx
}
