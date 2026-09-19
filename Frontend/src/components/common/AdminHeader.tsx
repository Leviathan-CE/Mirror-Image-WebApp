/**
 * Header for the admin console (`/admin/*`).
 */

import { useLocation, useNavigate } from "react-router-dom"

import { useAuth } from "@/app/providers/AuthProvider"
import { AccountMenu } from "@/components/common/AccountMenu"
import { HeaderShell } from "@/components/common/HeaderShell"
import { navButtonClassName } from "@/components/common/headerStyles"
import { Button } from "@/components/ui/button"
import { ROUTES, isAdminRole } from "@/lib/route"
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
  const { user } = useAuth()
  const fullAdmin = isAdminRole(user?.role)

  return (
    <HeaderShell
      brandTo={fullAdmin ? ROUTES.ADMIN : ROUTES.ADMIN_CARDS}
      brandLabel={fullAdmin ? "MIRRORIMAGE ADMIN" : "MIRRORIMAGE CARDS"}
      nav={
        <>
          {fullAdmin ? (
            <Button
              className={adminNavClass(pathname === ROUTES.ADMIN)}
              onClick={() => navigate(ROUTES.ADMIN)}
            >
              ANALYTICS
            </Button>
          ) : null}
          <Button
            className={adminNavClass(pathname.startsWith(ROUTES.ADMIN_CARDS))}
            onClick={() => navigate(ROUTES.ADMIN_CARDS)}
          >
            CARDS DB
          </Button>
          {fullAdmin ? (
            <Button
              className={adminNavClass(pathname.startsWith(ROUTES.ADMIN_USERS))}
              onClick={() => navigate(ROUTES.ADMIN_USERS)}
            >
              USERS
            </Button>
          ) : null}
          <Button
            className={navButtonClassName}
            onClick={() => navigate(ROUTES.MAIN)}
          >
            APP
          </Button>
        </>
      }
      actions={
        <AccountMenu suffix={fullAdmin ? " · admin" : " · developer"} />
      }
    />
  )
}
