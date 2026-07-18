/**
 * Top-level header switch.
 *
 * - Cards (`CardsHeader`): library section at `/cards`
 * - Guest (`BaseHeader`): marketing nav + LOGIN
 * - Operator (`OperatorHeader`): decks / logout after auth
 */

import { useLocation } from "react-router-dom"

import { useAuth } from "@/app/providers/AuthProvider"
import { BaseHeader } from "@/components/common/BaseHeader"
import { CardsHeader } from "@/components/common/CardsHeader"
import { OperatorHeader } from "@/components/common/OperatorHeader"

export function AppHeader() {
  const { isAuthenticated } = useAuth()
  const { pathname } = useLocation()

  if (pathname.startsWith("/cards")) {
    return <CardsHeader />
  }

  return isAuthenticated ? <OperatorHeader /> : <BaseHeader />
}
