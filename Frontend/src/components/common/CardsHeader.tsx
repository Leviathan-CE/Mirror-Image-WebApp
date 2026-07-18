/**
 * Header for the card library section (`/cards`).
 * Guest and operator actions both available; CARDS stays the active section.
 */

import { useNavigate } from "react-router-dom"

import { useAuth } from "@/app/providers/AuthProvider"
import { HeaderShell } from "@/components/common/HeaderShell"
import {
  headerUserNameClassName,
  navButtonClassName,
} from "@/components/common/headerStyles"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const activeNavClassName = cn(
  navButtonClassName,
  "text-cyan-200 underline decoration-cyan-400/70 underline-offset-4"
)

export function CardsHeader() {
  const navigate = useNavigate()
  const { user, isAuthenticated, clearSession } = useAuth()

  function onLogout() {
    clearSession()
    navigate("/", { replace: true })
  }

  return (
    <HeaderShell
      brandTo={isAuthenticated ? "/main" : "/"}
      nav={
        <>
          <Button
            className={navButtonClassName}
            onClick={() => navigate(isAuthenticated ? "/main" : "/")}
          >
            HOME
          </Button>
          <Button className={activeNavClassName} onClick={() => navigate("/cards")}>
            CARDS
          </Button>
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
          {isAuthenticated ? (
            <Button
              className={navButtonClassName}
              onClick={() => navigate("/main")}
            >
              DECKS
            </Button>
          ) : null}
        </>
      }
      actions={
        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          {isAuthenticated && user ? (
            <>
              <span className={headerUserNameClassName}>{user.user_name}</span>
              <Button className={navButtonClassName} onClick={onLogout}>
                LOGOUT
              </Button>
            </>
          ) : (
            <Button
              className={navButtonClassName}
              onClick={() => navigate("/login")}
            >
              LOGIN
            </Button>
          )}
        </div>
      }
    />
  )
}
