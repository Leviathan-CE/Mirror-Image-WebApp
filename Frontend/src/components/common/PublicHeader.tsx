/**
 * Guest / marketing header (no session).
 * Styles: `headerStyles.ts`. Frame: `HeaderShell`.
 */

import { useNavigate } from "react-router-dom"

import { HeaderNav } from "@/components/common/HeaderNav"
import { HeaderShell } from "@/components/common/HeaderShell"
import { navButtonClassName } from "@/components/common/headerStyles"
import { Button } from "@/components/ui/button"
import { ROUTES } from "@/lib/route"

export function PublicHeader() {
  const navigate = useNavigate()

  return (
    <HeaderShell
      brandTo={ROUTES.HOME}
      nav={
        <HeaderNav
          items={[
            {
              id: "home",
              label: "HOME",
              onSelect: () => navigate(ROUTES.HOME),
            },
            {
              id: "cards",
              label: "CARDS",
              onSelect: () => navigate(ROUTES.CARDS),
            },
            {
              id: "decks",
              label: "DECKS",
              onSelect: () => navigate(ROUTES.DECK_COMUNITY),
            },
            {
              id: "how-to-play",
              label: "HOW TO PLAY",
              onSelect: () => navigate(ROUTES.HOW_TO_PLAY),
            },
            {
              id: "lore",
              label: "LORE",
              onSelect: () => navigate(ROUTES.LORE),
            },
            {
              id: "updates",
              label: "UPDATES",
              onSelect: () => navigate(ROUTES.UPDATES),
            },
          ]}
        />
      }
      actions={
        <div className="flex shrink-0 justify-end">
          <Button
            className={navButtonClassName}
            onClick={() => navigate(ROUTES.LOGIN)}
          >
            LOGIN
          </Button>
        </div>
      }
    />
  )
}
