/**
 * Route guard — admin or developer (console + cards).
 * Guests → login. Other roles → operator home.
 */

import { Navigate, useLocation } from "react-router-dom"

import { useAuth } from "@/app/providers/AuthProvider"
import { isStaffRole, ROUTES } from "@/lib/route"

type RequireStaffProps = {
  children: React.ReactNode
}

export function RequireStaff({ children }: RequireStaffProps) {
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

  if (!isStaffRole(user?.role)) {
    return <Navigate to={ROUTES.MAIN} replace />
  }

  return children
}
