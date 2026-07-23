/**
 * Top-level header switch.
 *
 * - Guest (`PublicHeader`): marketing nav + LOGIN
 * - Admin on `/admin/*` (`AdminHeader`): analytics / cards db / users
 * - Authenticated (`Userheader`): decks / cards / logout
 */

import { useLocation } from "react-router-dom"

import { useAuth } from "@/app/providers/AuthProvider"
import { AdminHeader } from "@/components/common/AdminHeader"
import { PublicHeader } from "@/components/common/PublicHeader"
import { Userheader } from "@/components/common/UserHeader"
import { ADMIN_ROLE, ROUTES } from "@/lib/route"

export function AppHeader() {
  const { isAuthenticated, user } = useAuth()
  const { pathname } = useLocation()

  const onAdminRoute = pathname.startsWith(ROUTES.ADMIN)
  const isAdmin = user?.role === ADMIN_ROLE

  if (onAdminRoute && isAuthenticated && isAdmin) {
    return <AdminHeader />
  }

  return isAuthenticated ? <Userheader /> : <PublicHeader />
}
