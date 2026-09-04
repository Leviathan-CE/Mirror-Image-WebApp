/**
 * Header for the admin console (`/admin/*`).
 */

import { useLocation, useNavigate } from "react-router-dom"

import { AccountMenu } from "@/components/common/AccountMenu"
import { HeaderShell } from "@/components/common/HeaderShell"
import { navButtonClassName } from "@/components/common/headerStyles"
import { Button } from "@/components/ui/button"
import { ROUTES } from "@/lib/route"
import { cn } from "@/lib/utils"

function adminNavClass(active: boolean) {
  return cn(
    navButtonClassName,
    active &&
      "text-cyan-200 underline decoration-cyan-400/70 underline-offset-4"
  )
}

export function AdminHeader() {
  const navigate = useNavigate()
  const { pathname } = useLocation()

  return (
    <HeaderShell
      brandTo={ROUTES.ADMIN}
      brandLabel="MIRRORIMAGE ADMIN"
      nav={
        <>
          <Button
            className={adminNavClass(pathname === ROUTES.ADMIN)}
            onClick={() => navigate(ROUTES.ADMIN)}
          >
            ANALYTICS
          </Button>
          <Button
            className={adminNavClass(pathname.startsWith(ROUTES.ADMIN_CARDS))}
            onClick={() => navigate(ROUTES.ADMIN_CARDS)}
          >
            CARDS DB
          </Button>
          <Button
            className={adminNavClass(pathname.startsWith(ROUTES.ADMIN_USERS))}
            onClick={() => navigate(ROUTES.ADMIN_USERS)}
          >
            USERS
          </Button>
          <Button
            className={navButtonClassName}
            onClick={() => navigate(ROUTES.MAIN)}
          >
            APP
          </Button>
        </>
      }
      actions={<AccountMenu suffix=" · admin" />}
    />
  )
}
