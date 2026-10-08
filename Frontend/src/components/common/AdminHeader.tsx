/**
 * Header for the admin console (`/admin/*`).
 */

import { useNavigate } from "react-router-dom"

import { useAuth } from "@/app/providers/AuthProvider"
import { useComingSoon } from "@/app/providers/ComingSoonProvider"
import { AccountMenu } from "@/components/common/AccountMenu"
import { HeaderNav } from "@/components/common/HeaderNav"
import { HeaderShell } from "@/components/common/HeaderShell"
import { isAdminRole, ROUTES } from "@/lib/route"

export function AdminHeader() {
  const navigate = useNavigate()
  const { comingSoon } = useComingSoon()
  const { user } = useAuth()
  const canManageUsers = isAdminRole(user?.role)
  const staffLabel = canManageUsers ? "admin" : "developer"

  return (
    <HeaderShell
      brandTo={ROUTES.ADMIN}
      brandLabel="MIRRORIMAGE ADMIN"
      nav={
        <div className="flex min-w-0 items-center justify-start gap-1 md:flex-1 md:justify-center">
          <HeaderNav
            items={[
              {
                id: "analytics",
                label: "ANALYTICS",
                onSelect: () => navigate(ROUTES.ADMIN),
              },
              {
                id: "cards-db",
                label: "CARDS DB",
                onSelect: () => navigate(ROUTES.ADMIN_CARDS),
              },
              ...(canManageUsers
                ? [
                    {
                      id: "users",
                      label: "USERS",
                      onSelect: () => navigate(ROUTES.ADMIN_USERS),
                    },
                  ]
                : []),
              {
                id: "updates",
                label: "UPDATES",
                onSelect: () => navigate(ROUTES.ADMIN_UPDATES),
              },
              {
                id: "app",
                label: "APP",
                onSelect: () => navigate(ROUTES.MAIN),
              },
            ]}
          />
          {comingSoon ? (
            <span className="font-buahs93 hidden px-1.5 text-[10px] text-amber-300 sm:text-xs md:inline">
              COMING SOON ON
            </span>
          ) : null}
        </div>
      }
      actions={<AccountMenu suffix={` · ${staffLabel}`} />}
    />
  )
}
