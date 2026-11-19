/**
 * Minimal chrome while coming-soon is on for anyone who is not an admin.
 */

import { UserRound } from "lucide-react"
import { useNavigate } from "react-router-dom"

import { useAuth } from "@/app/providers/AuthProvider"
import { HeaderShell } from "@/components/common/HeaderShell"
import { navButtonClassName } from "@/components/common/headerStyles"
import { GlitchFx } from "@/components/effects/GlitchFx"
import { Button } from "@/components/ui/button"
import { ROUTES } from "@/lib/route"

export function ComingSoonHeader() {
  const navigate = useNavigate()
  const { isAuthenticated, clearSession } = useAuth()

  return (
    <HeaderShell
      brandTo={ROUTES.HOME}
      nav={null}
      actions={
        isAuthenticated ? (
          <Button className={navButtonClassName} onClick={clearSession}>
            SIGN OUT
          </Button>
        ) : (
          <GlitchFx
            type="button"
            label="ACCOUNT"
            angle="8px"
            leading={
              <UserRound
                aria-hidden="true"
                className="size-3.5"
                strokeWidth={1.75}
              />
            }
            fxClassName={
              "[--glitch-a:#fb923c] [--glitch-bg:#c2410c]"
            }
            className={
              "h-8 rounded-none bg-orange-500 px-3 "
              + "font-buahs93 text-[10px] text-black "
              + "hover:bg-orange-400 sm:text-xs"
            }
            onClick={() => navigate(ROUTES.LOGIN)}
          />
        )
      }
    />
  )
}
