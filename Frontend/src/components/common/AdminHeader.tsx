/**
 * Header for the admin console (`/admin/*`).
 */

import { useLocation, useNavigate } from "react-router-dom"

import { useAuth } from "@/app/providers/AuthProvider"
import { useComingSoon } from "@/app/providers/ComingSoonProvider"
import { AccountMenu } from "@/components/common/AccountMenu"
import { HeaderShell } from "@/components/common/HeaderShell"
import { navButtonClassName } from "@/components/common/headerStyles"
import { Button } from "@/components/ui/button"
import { isAdminRole, ROUTES } from "@/lib/route"
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
  const { comingSoon } = useComingSoon()
  const { user } = useAuth()
  const canManageUsers = isAdminRole(user?.role)
  const staffLabel = canManageUsers ? "admin" : "developer"

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
          {canManageUsers ? (
            <Button
              className={adminNavClass(pathname.startsWith(ROUTES.ADMIN_USERS))}
              onClick={() => navigate(ROUTES.ADMIN_USERS)}
            >
              USERS
            </Button>
          ) : null}
          <Button
            className={adminNavClass(pathname.startsWith(ROUTES.ADMIN_UPDATES))}
            onClick={() => navigate(ROUTES.ADMIN_UPDATES)}
          >
            UPDATES
          </Button>
          <Button
            className={navButtonClassName}
            onClick={() => navigate(ROUTES.MAIN)}
          >
            APP
          </Button>
          {comingSoon ? (
            <span className="font-buahs93 px-1.5 text-[10px] text-amber-300 sm:text-xs">
              COMING SOON ON
            </span>
          ) : null}
        </>
      }
      actions={<AccountMenu suffix={` · ${staffLabel}`} />}
    />
  )
}
