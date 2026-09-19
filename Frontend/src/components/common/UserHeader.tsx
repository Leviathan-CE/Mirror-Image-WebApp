import { useNavigate } from "react-router-dom"

import { useAuth } from "@/app/providers/AuthProvider"
import { AccountMenu } from "@/components/common/AccountMenu"
import { HeaderShell } from "@/components/common/HeaderShell"
import { navButtonClassName } from "@/components/common/headerStyles"
import { Button } from "@/components/ui/button"
import { ROUTES, canManageCards, isAdminRole } from "@/lib/route"

export function Userheader() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const isAdmin = isAdminRole(user?.role)
  const showCardsDb = canManageCards(user?.role) && !isAdmin

  return (
    <HeaderShell
      brandTo={ROUTES.HOME}
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
          {isAdmin ? (
            <Button
              className={navButtonClassName}
              onClick={() => navigate(ROUTES.ADMIN)}
            >
              ADMIN
            </Button>
          ) : null}
          {showCardsDb ? (
            <Button
              className={navButtonClassName}
              onClick={() => navigate(ROUTES.ADMIN_CARDS)}
            >
              CARDS DB
            </Button>
          ) : null}
        </>
      }
      actions={<AccountMenu />}
    />
  )
}
