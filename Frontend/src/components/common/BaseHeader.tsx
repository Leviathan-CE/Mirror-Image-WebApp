/**
 * Guest / marketing header (no session).
 * Shared `navButtonClassName` is also used by `OperatorHeader`.
 */

import { Link, useNavigate } from "react-router-dom"

import { Button } from "@/components/ui/button"

export const navButtonClassName =
  "font-buahs93 h-6 shrink rounded-[4px] bg-card px-1.5 text-[10px] leading-none text-white transition-colors hover:text-cyan-200 sm:h-7 sm:px-2 sm:text-xs md:h-8 md:px-2.5 md:text-sm"

export function BaseHeader() {
  const navigate = useNavigate()

  return (
    <header className="dark w-full bg-card px-2 py-2 sm:px-4 lg:px-6">
      <div className="mx-auto flex max-w-6xl min-w-0 flex-wrap items-center gap-x-2 gap-y-1 sm:gap-x-3 lg:gap-4">
        <Link
          to="/"
          className="font-glitch shrink-0 text-xs text-cyan-300 sm:text-sm md:text-base lg:text-xl"
        >
          MIRRORIMAGE
        </Link>
        <nav className="flex min-w-0 flex-1 flex-wrap items-center justify-center gap-0.5 sm:gap-1">
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
        </nav>

        <div className="flex shrink-0 justify-end">
          <Button
            className={navButtonClassName}
            onClick={() => navigate("/login")}
          >
            LOGIN
          </Button>
        </div>
      </div>
    </header>
  )
}
