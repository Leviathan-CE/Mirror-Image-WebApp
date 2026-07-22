/**
 * Top-level header switch.
 *
 * - Guest (`PublicHeader`): marketing nav + LOGIN
 * - Authenticated (`Userheader`): decks / cards / logout
 */

import { useAuth } from "@/app/providers/AuthProvider"
import { PublicHeader } from "@/components/common/PublicHeader"
import { Userheader } from "@/components/common/UserHeader"

export function AppHeader() {
  const { isAuthenticated } = useAuth()

  return isAuthenticated ? <Userheader /> : <PublicHeader />
}
