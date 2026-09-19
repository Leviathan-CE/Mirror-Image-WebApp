/**
 * Top-level header switch.
 *
 * - Guest (`PublicHeader`): marketing nav + LOGIN
 * - Admin on `/admin/*` (`AdminHeader`): analytics / cards db / users
 * - Authenticated (`Userheader`): decks / cards / account menu
 */

import { useLocation } from "react-router-dom"

import { useAuth } from "@/app/providers/AuthProvider"
import { AdminHeader } from "@/components/common/AdminHeader"
import { PublicHeader } from "@/components/common/PublicHeader"
import { Userheader } from "@/components/common/UserHeader"
import { ROUTES, canManageCards, isAdminRole } from "@/lib/route"

export function AppHeader() {
  const { isAuthenticated, user } = useAuth()
  const { pathname } = useLocation()

  // Full-screen table — no site chrome.
  if (
    pathname === ROUTES.PLAY_TESTER ||
    pathname.startsWith(`${ROUTES.PLAY_TESTER}/`)
  ) {
    return null
  }

  const onAdminRoute = pathname.startsWith(ROUTES.ADMIN)
  const showAdminChrome =
    onAdminRoute &&
    isAuthenticated &&
    (isAdminRole(user?.role) || canManageCards(user?.role))

  if (showAdminChrome) {
    return <AdminHeader />
  }

  return isAuthenticated ? <Userheader /> : <PublicHeader />
}
