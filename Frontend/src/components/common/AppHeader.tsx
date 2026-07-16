/**
 * Top-level header switch.
 *
 * - Guest (`BaseHeader`): marketing nav + LOGIN
 * - Operator (`OperatorHeader`): decks / logout after auth
 */

import { useAuth } from "@/app/providers/AuthProvider"
import { BaseHeader } from "@/components/common/BaseHeader"
import { OperatorHeader } from "@/components/common/OperatorHeader"

export function AppHeader() {
  const { isAuthenticated } = useAuth()
  return isAuthenticated ? <OperatorHeader /> : <BaseHeader />
}
