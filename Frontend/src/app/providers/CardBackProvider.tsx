/**
 * Resolves the auth-gated card-back image once per session for <img src>.
 *
 * Browser images cannot send Authorization headers, so the API mints a signed
 * media URL (same pattern as card art). Logged-out → null (no public fallback).
 */

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type PropsWithChildren,
} from "react"

import { useAuth } from "@/app/providers/AuthProvider"
import { fetchCardBackUrl } from "@/lib/api/assets"

const CardBackContext = createContext<string | null>(null)

export function CardBackProvider({ children }: PropsWithChildren) {
  const { token, isAuthenticated } = useAuth()
  const [src, setSrc] = useState<string | null>(null)

  useEffect(() => {
    if (!isAuthenticated || !token) {
      setSrc(null)
      return
    }

    let cancelled = false
    void fetchCardBackUrl(token)
      .then((url) => {
        if (!cancelled) setSrc(url)
      })
      .catch(() => {
        if (!cancelled) setSrc(null)
      })

    return () => {
      cancelled = true
    }
  }, [isAuthenticated, token])

  return (
    <CardBackContext.Provider value={src}>{children}</CardBackContext.Provider>
  )
}

/** Signed card-back URL, or null until loaded / if logged out. */
export function useCardBackSrc(): string | null {
  return useContext(CardBackContext)
}
