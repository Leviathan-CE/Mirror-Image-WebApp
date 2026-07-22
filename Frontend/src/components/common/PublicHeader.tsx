/**
 * Guest / marketing header (no session).
 * Styles: `headerStyles.ts`. Frame: `HeaderShell`.
 */

import { useNavigate } from "react-router-dom"

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
        <>
          <Button
            className={navButtonClassName}
            onClick={() => navigate(ROUTES.HOME)}
          >
            HOME
          </Button>
          <Button
            className={navButtonClassName}
            onClick={() => navigate(ROUTES.CARDS)}
          >
            CARDS
          </Button>
          <Button
            className={navButtonClassName}
            onClick={() => navigate(ROUTES.DECK_COMUNITY)}
            >
              DECKS
            </Button>
          <Button
            className={navButtonClassName}
            onClick={() => navigate(ROUTES.HOW_TO_PLAY)}
          >
            <span className="sm:hidden">PLAY</span>
            <span className="hidden sm:inline">HOW TO PLAY</span>
          </Button>
          <Button
            className={navButtonClassName}
            onClick={() => navigate(ROUTES.LORE)}
          >
            LORE
          </Button>
          <Button className={navButtonClassName}>UPDATES</Button>
        </>
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
