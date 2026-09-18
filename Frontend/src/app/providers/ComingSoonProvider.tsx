/**
 * Public coming-soon flag. Cached in sessionStorage so a refresh while the
 * splash is on does not flash the real home page.
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

import { fetchComingSoon } from "@/lib/api/site"

const CACHE_KEY = "mi_coming_soon"

type ComingSoonContextValue = {
  comingSoon: boolean
  ready: boolean
  setComingSoonEnabled: (enabled: boolean) => void
}

const ComingSoonContext = createContext<ComingSoonContextValue | null>(null)

function readCachedComingSoon(): boolean | null {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY)
    if (raw === "1") return true
    if (raw === "0") return false
  } catch {
    /* private mode */
  }
  return null
}

function writeCachedComingSoon(enabled: boolean) {
  try {
    sessionStorage.setItem(CACHE_KEY, enabled ? "1" : "0")
  } catch {
    /* private mode */
  }
}

export function ComingSoonProvider({ children }: PropsWithChildren) {
  const cached = readCachedComingSoon()
  const [comingSoon, setComingSoon] = useState(cached === true)
  const [ready, setReady] = useState(cached !== null)

  const setComingSoonEnabled = useCallback((enabled: boolean) => {
    writeCachedComingSoon(enabled)
    setComingSoon(enabled)
    setReady(true)
  }, [])

  useEffect(() => {
    let cancelled = false
    void fetchComingSoon()
      .then((status) => {
        if (cancelled) return
        setComingSoonEnabled(status.coming_soon)
      })
      .catch(() => {
        if (cancelled) return
        setReady(true)
      })
    return () => {
      cancelled = true
    }
  }, [setComingSoonEnabled])

  const value = useMemo<ComingSoonContextValue>(
    () => ({ comingSoon, ready, setComingSoonEnabled }),
    [comingSoon, ready, setComingSoonEnabled]
  )

  return (
    <ComingSoonContext.Provider value={value}>
      {children}
    </ComingSoonContext.Provider>
  )
}

export function useComingSoon(): ComingSoonContextValue {
  const ctx = useContext(ComingSoonContext)
  if (!ctx) {
    throw new Error("useComingSoon must be used under ComingSoonProvider")
  }
  return ctx
}
