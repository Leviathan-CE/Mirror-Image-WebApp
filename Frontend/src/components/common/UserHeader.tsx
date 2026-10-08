import { useNavigate } from "react-router-dom"

import { useAuth } from "@/app/providers/AuthProvider"
import { AccountMenu } from "@/components/common/AccountMenu"
import { HeaderNav } from "@/components/common/HeaderNav"
import { HeaderShell } from "@/components/common/HeaderShell"
import { isStaffRole, ROUTES } from "@/lib/route"

export function Userheader() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const isAdmin = isStaffRole(user?.role)

  const items = [
    { id: "decks", label: "DECKS", onSelect: () => navigate(ROUTES.MAIN) },
    { id: "cards", label: "CARDS", onSelect: () => navigate(ROUTES.CARDS) },
    {
      id: "rules",
      label: "RULES",
      onSelect: () => navigate(ROUTES.HOW_TO_PLAY),
    },
    { id: "lore", label: "LORE", onSelect: () => navigate(ROUTES.LORE) },
    {
      id: "updates",
      label: "UPDATES",
      onSelect: () => navigate(ROUTES.UPDATES),
    },
  ]
  if (isAdmin) {
    items.push({
      id: "admin",
      label: "ADMIN",
      onSelect: () => navigate(ROUTES.ADMIN),
    })
  }

  return (
    <HeaderShell
      brandTo={ROUTES.HOME}
      nav={<HeaderNav items={items} />}
      actions={<AccountMenu />}
    />
  )
}
