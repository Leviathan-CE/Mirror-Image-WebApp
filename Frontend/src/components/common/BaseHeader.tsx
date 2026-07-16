/**
 * Guest / marketing header (no session).
 * Styles: `headerStyles.ts`. Frame: `HeaderShell`.
 */

import { useNavigate } from "react-router-dom"

import { HeaderShell } from "@/components/common/HeaderShell"
import { navButtonClassName } from "@/components/common/headerStyles"
import { Button } from "@/components/ui/button"

export function BaseHeader() {
  const navigate = useNavigate()

  return (
    <HeaderShell
      brandTo="/"
      nav={
        <>
          <Button className={navButtonClassName} onClick={() => navigate("/")}>
            HOME
          </Button>
          <Button className={navButtonClassName}>CARDS</Button>
          <Button
            className={navButtonClassName}
            onClick={() => navigate("/how-to-play")}
          >
            <span className="sm:hidden">PLAY</span>
            <span className="hidden sm:inline">HOW TO PLAY</span>
          </Button>
          <Button
            className={navButtonClassName}
            onClick={() => navigate("/lore")}
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
            onClick={() => navigate("/login")}
          >
            LOGIN
          </Button>
        </div>
      }
    />
  )
}
