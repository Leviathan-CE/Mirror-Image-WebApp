/**
 * Header for the admin console (`/admin/*`).
 */

import { useLocation, useNavigate } from "react-router-dom"

import { useAuth } from "@/app/providers/AuthProvider"
import { HeaderShell } from "@/components/common/HeaderShell"
import {
  headerUserNameClassName,
  navButtonClassName,
} from "@/components/common/headerStyles"
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
  const { user, clearSession } = useAuth()

  function onLogout() {
    clearSession()
    navigate(ROUTES.HOME, { replace: true })
  }

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
      actions={
        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          {user ? (
            <span className={headerUserNameClassName}>
              {user.user_name} · admin
            </span>
          ) : null}
          <Button className={navButtonClassName} onClick={onLogout}>
            LOGOUT
          </Button>
        </div>
      }
    />
  )
}
