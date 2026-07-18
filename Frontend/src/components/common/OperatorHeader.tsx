/**
 * Header shown while an operator session is active.
 * Styles: `headerStyles.ts`. Frame: `HeaderShell`.
 */

import { useNavigate } from "react-router-dom"

import { useAuth } from "@/app/providers/AuthProvider"
import { HeaderShell } from "@/components/common/HeaderShell"
import {
  headerUserNameClassName,
  navButtonClassName,
} from "@/components/common/headerStyles"
import { Button } from "@/components/ui/button"

export function OperatorHeader() {
  const navigate = useNavigate()
  const { user, clearSession } = useAuth()

  function onLogout() {
    clearSession()
    navigate("/", { replace: true })
  }

  return (
    <HeaderShell
      brandTo="/main"
      nav={
        <>
          <Button
            className={navButtonClassName}
            onClick={() => navigate("/main")}
          >
            DECKS
          </Button>
          <Button
            className={navButtonClassName}
            onClick={() => navigate("/cards")}
          >
            CARDS
          </Button>
        </>
      }
      actions={
        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          {user ? (
            <span className={headerUserNameClassName}>{user.user_name}</span>
          ) : null}
          <Button className={navButtonClassName} onClick={onLogout}>
            LOGOUT
          </Button>
        </div>
      }
    />
  )
}
