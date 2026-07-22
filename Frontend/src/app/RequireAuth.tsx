/**
 * Route guard — redirects guests to login, preserving the intended URL.
 */

import { Navigate, useLocation } from "react-router-dom"

import { useAuth } from "@/app/providers/AuthProvider"
import { ROUTES } from "@/lib/route"

type RequireAuthProps = {
  children: React.ReactNode
}

export function RequireAuth({ children }: RequireAuthProps) {
  const { isAuthenticated } = useAuth()
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

  return children
}
