import { useNavigate } from "react-router-dom"

import { useAuth } from "@/app/providers/AuthProvider"
import { AccountMenu } from "@/components/common/AccountMenu"
import { HeaderShell } from "@/components/common/HeaderShell"
import { navButtonClassName } from "@/components/common/headerStyles"
import { Button } from "@/components/ui/button"
import { isStaffRole, ROUTES } from "@/lib/route"

export function Userheader() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const isAdmin = isStaffRole(user?.role)

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
          <Button
            className={navButtonClassName}
            onClick={() => navigate(ROUTES.UPDATES)}
          >
            UPDATES
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
      actions={<AccountMenu />}
    />
  )
}
