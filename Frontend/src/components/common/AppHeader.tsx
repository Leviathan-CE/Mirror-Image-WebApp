/**
 * Top-level header switch.
 *
 * - Guest (`PublicHeader`): marketing nav + LOGIN
 * - Admin on `/admin/*` (`AdminHeader`): analytics / cards db / users
 * - Authenticated (`Userheader`): decks / cards / account menu
 */

import { useLocation } from "react-router-dom"

import { useAuth } from "@/app/providers/AuthProvider"
import { useComingSoon } from "@/app/providers/ComingSoonProvider"
import { AdminHeader } from "@/components/common/AdminHeader"
import { ComingSoonHeader } from "@/components/common/ComingSoonHeader"
import { PublicHeader } from "@/components/common/PublicHeader"
import { Userheader } from "@/components/common/UserHeader"
import { ADMIN_ROLE, ROUTES } from "@/lib/route"

export function AppHeader() {
  const { isAuthenticated, user } = useAuth()
  const { comingSoon } = useComingSoon()
  const { pathname } = useLocation()

  const isAdmin = user?.role === ADMIN_ROLE
  const playTesterPath =
    pathname === ROUTES.PLAY_TESTER ||
    pathname.startsWith(`${ROUTES.PLAY_TESTER}/`)

  // Full-screen table — no site chrome (admins still play while the splash is on).
  if (playTesterPath && !(comingSoon && !isAdmin)) {
    return null
  }

  if (comingSoon && !isAdmin) {
    return <ComingSoonHeader />
  }

  const onAdminRoute = pathname.startsWith(ROUTES.ADMIN)

  if (onAdminRoute && isAuthenticated && isAdmin) {
    return <AdminHeader />
  }

  return isAuthenticated ? <Userheader /> : <PublicHeader />
}
