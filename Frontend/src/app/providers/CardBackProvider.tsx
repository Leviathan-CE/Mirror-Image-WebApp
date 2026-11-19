/**
 * Resolves card-back image(s) for playtester + print duplex.
 *
 * - Logged-out → no backs.
 * - Logged-in → always the public free back.
 * - Staff → also mint the premium signed system back and offer both.
 */

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react"

import { useAuth } from "@/app/providers/AuthProvider"
import {
  FREE_CARD_BACK_OPTION,
  STANDARD_CARD_BACK_ID,
  fetchCardBackUrl,
  type CardBackOption,
} from "@/lib/api/assets"
import { isStaffRole } from "@/lib/route"

type CardBackContextValue = {
  /** Default back for playtester board art. */
  src: string | null
  /** Duplex print choices (free for all; premium added for staff). */
  options: CardBackOption[]
}

const CardBackContext = createContext<CardBackContextValue>({
  src: null,
  options: [],
})

export function CardBackProvider({ children }: PropsWithChildren) {
  const { token, user, isAuthenticated } = useAuth()
  const isStaff = isStaffRole(user?.role)
  const [premiumSrc, setPremiumSrc] = useState<string | null>(null)

  useEffect(() => {
    if (!isAuthenticated || !token || !isStaff) {
      setPremiumSrc(null)
      return
    }

    let cancelled = false
    void fetchCardBackUrl(token)
      .then((url) => {
        if (!cancelled) setPremiumSrc(url)
      })
      .catch(() => {
        if (!cancelled) setPremiumSrc(null)
      })

    return () => {
      cancelled = true
    }
  }, [isAuthenticated, token, isStaff])

  const value = useMemo<CardBackContextValue>(() => {
    if (!isAuthenticated) {
      return { src: null, options: [] }
    }

    const options: CardBackOption[] = [FREE_CARD_BACK_OPTION]
    if (isStaff && premiumSrc) {
      options.push({
        id: STANDARD_CARD_BACK_ID,
        label: "Original card back",
        src: premiumSrc,
      })
    }

    const src =
      isStaff && premiumSrc
        ? premiumSrc
        : FREE_CARD_BACK_OPTION.src

    return { src, options }
  }, [isAuthenticated, isStaff, premiumSrc])

  return (
    <CardBackContext.Provider value={value}>
      {children}
    </CardBackContext.Provider>
  )
}

/** Default card-back URL for playtester, or null if logged out. */
export function useCardBackSrc(): string | null {
  return useContext(CardBackContext).src
}

/** Duplex print back choices for the current user. */
export function useCardBackOptions(): CardBackOption[] {
  return useContext(CardBackContext).options
}
