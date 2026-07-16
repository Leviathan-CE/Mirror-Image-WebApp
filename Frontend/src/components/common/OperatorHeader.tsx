/**
 * Header shown while an operator session is active.
 * Brand + DECKS point at `/main`; LOGOUT clears the session and returns to `/`.
 */

import { Link, useNavigate } from "react-router-dom"

import { useAuth } from "@/app/providers/AuthProvider"
import { navButtonClassName } from "@/components/common/BaseHeader"
import { Button } from "@/components/ui/button"

export function OperatorHeader() {
  const navigate = useNavigate()
  const { user, clearSession } = useAuth()

  function onLogout() {
    clearSession()
    navigate("/", { replace: true })
  }

  return (
    <header className="dark w-full bg-card px-2 py-2 sm:px-4 lg:px-6">
      <div className="mx-auto flex max-w-6xl min-w-0 flex-wrap items-center gap-x-2 gap-y-1 sm:gap-x-3 lg:gap-4">
        <Link
          to="/main"
          className="font-glitch shrink-0 text-xs text-cyan-300 sm:text-sm md:text-base lg:text-xl"
        >
          MIRRORIMAGE
        </Link>

        <nav className="flex min-w-0 flex-1 flex-wrap items-center justify-center gap-0.5 sm:gap-1">
          <Button
            className={navButtonClassName}
            onClick={() => navigate("/main")}
          >
            DECKS
          </Button>
        </nav>

        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          {user ? (
            <span className="hidden max-w-[8rem] truncate font-buahs93 text-[10px] text-cyan-300/90 sm:inline sm:text-xs md:max-w-[12rem]">
              {user.user_name}
            </span>
          ) : null}
          <Button className={navButtonClassName} onClick={onLogout}>
            LOGOUT
          </Button>
        </div>
      </div>
    </header>
  )
}
