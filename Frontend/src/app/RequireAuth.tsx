/**
 * Route guard — redirects guests to login, preserving the intended URL.
 *
 * Uses `?next=` (not only location.state) so a full reload / Stripe return
 * still knows where to send the user after login.
 */

import { Navigate, useLocation } from "react-router-dom"

import { useAuth } from "@/app/providers/AuthProvider"
import { ROUTES } from "@/lib/route"

type RequireAuthProps = {
  children: React.ReactNode
}

/** Only allow same-app relative paths (block open redirects). */
export function safeNextPath(raw: string | null | undefined): string | null {
  if (!raw) return null
  const path = raw.trim()
  if (!path.startsWith("/") || path.startsWith("//")) return null
  return path
}

export function RequireAuth({ children }: RequireAuthProps) {
  const { isAuthenticated } = useAuth()
  const location = useLocation()

  if (!isAuthenticated) {
    const next = safeNextPath(`${location.pathname}${location.search}`)
    const to = next
      ? `${ROUTES.LOGIN}?next=${encodeURIComponent(next)}`
      : ROUTES.LOGIN
    return <Navigate to={to} replace />
  }

  return children
}
