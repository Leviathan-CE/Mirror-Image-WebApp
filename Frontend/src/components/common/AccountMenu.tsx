/**
 * Username account dropdown: Settings, then Sign out last.
 */

import { useNavigate } from "react-router-dom"

import { useAuth } from "@/app/providers/AuthProvider"
import {
  headerUserNameClassName,
  navButtonClassName,
} from "@/components/common/headerStyles"
import { DropdownMenu } from "@/components/ui/DropdownMenu"
import { ROUTES } from "@/lib/route"
import { cn } from "@/lib/utils"

type AccountMenuProps = {
  /** Extra label in the trigger (e.g. " · admin"). */
  suffix?: string
}

export function AccountMenu({ suffix }: AccountMenuProps) {
  const navigate = useNavigate()
  const { user, clearSession } = useAuth()
  const name = user?.user_name ?? "Account"

  function onSignOut() {
    clearSession()
    navigate(ROUTES.HOME, { replace: true })
  }

  return (
    <DropdownMenu
      label="Account menu"
      align="right"
      trigger={
        <span className={cn(headerUserNameClassName, "inline max-w-[10rem]")}>
          {name}
          {suffix ?? ""}
        </span>
      }
      triggerClassName={cn(
        navButtonClassName,
        "h-8 w-auto max-w-[14rem] px-2 normal-case"
      )}
      menuClassName="min-w-[11rem]"
      items={[
        {
          id: "settings",
          label: "Account / Settings",
          onSelect: () => navigate(ROUTES.ACCOUNT),
        },
        { id: "sep-sign-out", separator: true },
        {
          id: "sign-out",
          label: "Sign out",
          tone: "danger",
          onSelect: onSignOut,
        },
      ]}
    />
  )
}
