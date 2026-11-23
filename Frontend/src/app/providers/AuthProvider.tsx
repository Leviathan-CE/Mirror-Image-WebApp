/**
 * Client auth session for the SPA.
 *
 * The access token lives in an httpOnly cookie. This provider only
 * keeps a non-secret signed-in flag plus the public user snapshot.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react"

import {
  fetchCurrentUser,
  isAuthUser,
  logoutRequest,
  type AuthUser,
} from "@/lib/api/auth"
import { safeJsonParse } from "@/lib/utils"

const LEGACY_TOKEN_KEY = "mi_access_token"
const SIGNED_IN_KEY = "mi_signed_in"
const USER_KEY = "mi_user"
const SIGNED_IN_FLAG = "1"

type AuthContextValue = {
  user: AuthUser | null
  token: string | null
  isAuthenticated: boolean
  /** Persist the public user after login. The session stays in the cookie. */
  setSession: (user: AuthUser) => void
  /** Ask the API to clear the cookie, then drop local state. */
  clearSession: () => void
  /** Keep cached /me preferences in sync after a Settings flush. */
  updateUserPreferences: (preferences: AuthUser["preferences"]) => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

function readStoredUser(): AuthUser | null {
  const raw = localStorage.getItem(USER_KEY)
  if (!raw) return null
  const parsed = safeJsonParse(raw)
  return isAuthUser(parsed) ? parsed : null
}

function readSignedInFlag(): string | null {
  localStorage.removeItem(LEGACY_TOKEN_KEY)
  if (localStorage.getItem(SIGNED_IN_KEY) !== SIGNED_IN_FLAG) {
    return null
  }
  return SIGNED_IN_FLAG
}

function statusOf(error: unknown): number {
  if (error == null || typeof error !== "object") return 0
  if (!("status" in error)) return 0
  return Number((error as { status?: number }).status)
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [token, setToken] = useState<string | null>(() => readSignedInFlag())
  const [user, setUser] = useState<AuthUser | null>(() => readStoredUser())

  const setSession = useCallback((nextUser: AuthUser) => {
    localStorage.removeItem(LEGACY_TOKEN_KEY)
    localStorage.setItem(SIGNED_IN_KEY, SIGNED_IN_FLAG)
    localStorage.setItem(USER_KEY, JSON.stringify(nextUser))
    setToken(SIGNED_IN_FLAG)
    setUser(nextUser)
  }, [])

  const clearSession = useCallback(() => {
    void logoutRequest().catch(() => {
      /* local state still drops if the network call fails */
    })
    localStorage.removeItem(LEGACY_TOKEN_KEY)
    localStorage.removeItem(SIGNED_IN_KEY)
    localStorage.removeItem(USER_KEY)
    setToken(null)
    setUser(null)
  }, [])

  const updateUserPreferences = useCallback(
    (preferences: AuthUser["preferences"]) => {
      setUser((prev) => {
        if (!prev) return prev
        const next = { ...prev, preferences }
        localStorage.setItem(USER_KEY, JSON.stringify(next))
        return next
      })
    },
    []
  )

  useEffect(() => {
    let cancelled = false
    void fetchCurrentUser()
      .then((fresh) => {
        if (cancelled) return
        localStorage.setItem(SIGNED_IN_KEY, SIGNED_IN_FLAG)
        localStorage.setItem(USER_KEY, JSON.stringify(fresh))
        setToken(SIGNED_IN_FLAG)
        setUser(fresh)
      })
      .catch((error: unknown) => {
        if (cancelled) return
        if (statusOf(error) !== 401) return
        localStorage.removeItem(LEGACY_TOKEN_KEY)
        localStorage.removeItem(SIGNED_IN_KEY)
        localStorage.removeItem(USER_KEY)
        setToken(null)
        setUser(null)
      })

    return () => {
      cancelled = true
    }
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token,
      isAuthenticated: Boolean(token && user),
      setSession,
      clearSession,
      updateUserPreferences,
    }),
    [user, token, setSession, clearSession, updateUserPreferences]
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
