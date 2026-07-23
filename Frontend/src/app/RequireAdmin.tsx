/**
 * Route guard — requires an authenticated admin.
 * Guests → login (with return URL). Non-admins → operator home.
 */

import { Navigate, useLocation } from "react-router-dom"

import { useAuth } from "@/app/providers/AuthProvider"
import { ADMIN_ROLE, ROUTES } from "@/lib/route"

type RequireAdminProps = {
  children: React.ReactNode
}

export function RequireAdmin({ children }: RequireAdminProps) {
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

  if (user?.role !== ADMIN_ROLE) {
    return <Navigate to={ROUTES.MAIN} replace />
  }

  return children
}
