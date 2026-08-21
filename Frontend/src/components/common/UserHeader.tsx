import { useNavigate } from "react-router-dom"

import { useAuth } from "@/app/providers/AuthProvider"
import { HeaderShell } from "@/components/common/HeaderShell"
import {
  headerUserNameClassName,
  navButtonClassName,
} from "@/components/common/headerStyles"
import { Button } from "@/components/ui/button"
import { ADMIN_ROLE, ROUTES } from "@/lib/route"

export function Userheader() {
  const navigate = useNavigate()
  const { user, clearSession } = useAuth()
  const isAdmin = user?.role === ADMIN_ROLE

  function onLogout() {
    clearSession()
    navigate(ROUTES.HOME, { replace: true })
  }

  return (
    <HeaderShell
      brandTo={ROUTES.MAIN}
      nav={
        <>
          <Button
            className={navButtonClassName}
            onClick={() => navigate(ROUTES.MAIN)}
          >
            DECKS
          </Button>
          <Button
            className={navButtonClassName}
            onClick={() => navigate(ROUTES.CARDS)}
          >
            CARDS
          </Button>
          <Button
            className={navButtonClassName}
            onClick={() => navigate(ROUTES.HOW_TO_PLAY)}
          >
            RULES
          </Button>
          <Button
            className={navButtonClassName}
            onClick={() => navigate(ROUTES.LORE)}
          >
            LORE
          </Button>
          <Button
            className={navButtonClassName}
            onClick={() => navigate(ROUTES.SUBSCRIBE)}
          >
            SUBSCRIBE
          </Button>
          {isAdmin ? (
            <Button
              className={navButtonClassName}
              onClick={() => navigate(ROUTES.ADMIN)}
            >
              ADMIN
            </Button>
          ) : null}
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
