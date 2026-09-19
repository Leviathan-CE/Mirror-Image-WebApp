/**
 * Route guard — admin or developer (catalogue upload / Cards DB).
 * Guests → login. Other roles → operator home.
 */

import { Navigate, useLocation } from "react-router-dom"

import { useAuth } from "@/app/providers/AuthProvider"
import { ROUTES, canManageCards } from "@/lib/route"

type RequireCardManagerProps = {
  children: React.ReactNode
}

export function RequireCardManager({ children }: RequireCardManagerProps) {
  const { isAuthenticated, user } = useAuth()
  const location = useLocation()

  if (!isAuthenticated) {
    return (
      <Navigate
        to={ROUTES.LOGIN}
        replace
        state={{ from: `${location.pathname}${location.search}` }}
      />
    )
  }

  if (!canManageCards(user?.role)) {
    return <Navigate to={ROUTES.MAIN} replace />
  }

  return children
}
