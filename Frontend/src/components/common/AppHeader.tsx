import { useAuth } from "@/app/providers/AuthProvider"
import { BaseHeader } from "@/components/common/BaseHeader"
import { OperatorHeader } from "@/components/common/OperatorHeader"

/** Picks guest vs operator header from auth state. */
export function AppHeader() {
  const { isAuthenticated } = useAuth()
  return isAuthenticated ? <OperatorHeader /> : <BaseHeader />
}
