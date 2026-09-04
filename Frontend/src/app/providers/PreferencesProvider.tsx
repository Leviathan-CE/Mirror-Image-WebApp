/**
 * Shared deck/library UI preferences.
 *
 * Runtime source of truth: localStorage (+ in-memory mirror).
 * Logged-in load: merge /me into local, but any key already on this device wins.
 * Settings changes mark a server flush; push on route change / tab hide.
 * Deck builder / create read local — never depend on the flush having finished.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from "react"
import { useLocation } from "react-router-dom"

import { useAuth } from "@/app/providers/AuthProvider"
import { patchUserPreferences } from "@/lib/api/auth"
import {
  DEFAULT_USER_PREFERENCES,
  normalizeUserPreferences,
  preferencesAreUnset,
  readLocalPreferencePatch,
  readLocalPreferences,
  writeLocalPreferences,
  type UserPreferences,
  type UserPreferencesPatch,
} from "@/lib/userPreferences.logic"

type PatchPrefsOptions = {
  /**
   * When true (Account Settings), mark prefs dirty for a server push on the
   * next navigation. Deck builder / library omit this — local only.
   */
  syncToServer?: boolean
}

type PreferencesContextValue = {
  prefs: UserPreferences
  patchPrefs: (patch: UserPreferencesPatch, options?: PatchPrefsOptions) => void
  /** Push dirty Settings prefs to the server now (also runs on route change). */
  flushServerPrefs: () => Promise<void>
}

const PreferencesContext = createContext<PreferencesContextValue | null>(null)

function prefsEqual(a: UserPreferences, b: UserPreferences): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

export function PreferencesProvider({ children }: PropsWithChildren) {
  const { token, user, updateUserPreferences } = useAuth()
  const [prefs, setPrefs] = useState<UserPreferences>(() =>
    typeof window === "undefined"
      ? DEFAULT_USER_PREFERENCES
      : readLocalPreferences()
  )
  const hydratedUserId = useRef<number | null>(null)
  const hydratedFromMe = useRef(false)
  const localDirtyRef = useRef(false)
  const serverDirtyRef = useRef(false)
  const prefsRef = useRef(prefs)
  const tokenRef = useRef(token)
  const flushingRef = useRef(false)

  useEffect(() => {
    prefsRef.current = prefs
  }, [prefs])

  useEffect(() => {
    tokenRef.current = token
  }, [token])

  const applyLocal = useCallback((next: UserPreferences) => {
    writeLocalPreferences(next)
    prefsRef.current = next
    setPrefs(next)
  }, [])

  const flushServerPrefs = useCallback((): Promise<void> => {
    const activeToken = tokenRef.current
    if (!activeToken || !serverDirtyRef.current || flushingRef.current) {
      return Promise.resolve()
    }

    flushingRef.current = true
    const body = prefsRef.current

    return patchUserPreferences(activeToken, body)
      .then((saved) => {
        // Keep what we sent — never let a sparse response wipe local sections.
        const normalized = normalizeUserPreferences({ ...saved, ...body })
        serverDirtyRef.current = false
        applyLocal(normalized)
        updateUserPreferences(normalized)
        hydratedFromMe.current = true
      })
      .catch(() => {
        /* keep dirty; retry on next navigation */
      })
      .finally(() => {
        flushingRef.current = false
      })
  }, [applyLocal, updateUserPreferences])

  useEffect(() => {
    if (!token || !user) {
      hydratedUserId.current = null
      hydratedFromMe.current = false
      localDirtyRef.current = false
      serverDirtyRef.current = false
      applyLocal(readLocalPreferences())
      return
    }

    if (hydratedUserId.current !== user.id) {
      hydratedUserId.current = user.id
      hydratedFromMe.current = false
      localDirtyRef.current = false
      serverDirtyRef.current = false
    }

    if (localDirtyRef.current || serverDirtyRef.current || hydratedFromMe.current) {
      return
    }

    const serverRaw = user.preferences
    const localPatch = readLocalPreferencePatch()

    if (serverRaw === undefined) return

    if (preferencesAreUnset(serverRaw) && Object.keys(localPatch).length > 0) {
      const migrated = normalizeUserPreferences({
        ...DEFAULT_USER_PREFERENCES,
        ...localPatch,
      })
      applyLocal(migrated)
      hydratedFromMe.current = true
      localDirtyRef.current = true
      serverDirtyRef.current = true
      void flushServerPrefs()
      return
    }

    // Server fills gaps; keys already on this device win (runtime source of truth).
    applyLocal(
      normalizeUserPreferences({
        ...normalizeUserPreferences(serverRaw),
        ...localPatch,
      })
    )
    hydratedFromMe.current = true
  }, [token, user, applyLocal, flushServerPrefs])

  useEffect(() => {
    function onHide() {
      if (document.visibilityState === "hidden") void flushServerPrefs()
    }
    function onPageHide() {
      void flushServerPrefs()
    }
    document.addEventListener("visibilitychange", onHide)
    window.addEventListener("pagehide", onPageHide)
    return () => {
      document.removeEventListener("visibilitychange", onHide)
      window.removeEventListener("pagehide", onPageHide)
      void flushServerPrefs()
    }
  }, [flushServerPrefs])

  const patchPrefs = useCallback(
    (patch: UserPreferencesPatch, options?: PatchPrefsOptions) => {
      setPrefs((prev) => {
        const next = normalizeUserPreferences({ ...prev, ...patch })
        if (prefsEqual(prev, next)) return prev
        writeLocalPreferences(next)
        prefsRef.current = next
        localDirtyRef.current = true
        if (token && options?.syncToServer) {
          serverDirtyRef.current = true
        }
        return next
      })
    },
    [token]
  )

  const value = useMemo(
    () => ({ prefs, patchPrefs, flushServerPrefs }),
    [prefs, patchPrefs, flushServerPrefs]
  )

  return (
    <PreferencesContext.Provider value={value}>
      {children}
    </PreferencesContext.Provider>
  )
}

/** Must render under BrowserRouter — flushes Settings prefs on route change. */
export function PreferencesNavigationFlush() {
  const { pathname } = useLocation()
  const { flushServerPrefs } = useUserPreferences()
  const prevPath = useRef(pathname)

  useEffect(() => {
    if (prevPath.current === pathname) return
    prevPath.current = pathname
    void flushServerPrefs()
  }, [pathname, flushServerPrefs])

  return null
}

export function useUserPreferences(): PreferencesContextValue {
  const ctx = useContext(PreferencesContext)
  if (!ctx) {
    throw new Error("useUserPreferences must be used within PreferencesProvider")
  }
  return ctx
}
