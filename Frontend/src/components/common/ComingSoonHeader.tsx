/**
 * Minimal chrome while coming-soon is on for anyone who is not an admin.
 */

import { useNavigate } from "react-router-dom"

import { useAuth } from "@/app/providers/AuthProvider"
import { HeaderShell } from "@/components/common/HeaderShell"
import { navButtonClassName } from "@/components/common/headerStyles"
import { Button } from "@/components/ui/button"
import { ROUTES } from "@/lib/route"

export function ComingSoonHeader() {
  const navigate = useNavigate()
  const { isAuthenticated, clearSession } = useAuth()

  return (
    <HeaderShell
      brandTo={ROUTES.HOME}
      nav={null}
      actions={
        isAuthenticated ? (
          <Button className={navButtonClassName} onClick={clearSession}>
            SIGN OUT
          </Button>
        ) : (
          <Button
            className={navButtonClassName}
            onClick={() => navigate(ROUTES.LOGIN)}
          >
            LOGIN
          </Button>
        )
      }
    />
  )
}
