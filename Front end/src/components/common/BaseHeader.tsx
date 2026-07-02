import { Link, useNavigate } from "react-router-dom"

import { Button } from "@/components/ui/button"
const navButtonClassName =
  " font-buahs93 rounded-[4px] bg-card text-white transition-colors hover:text-cyan-200"

export function BaseHeader() {
  const navigate = useNavigate()

  return (
    <header className="dark w-full bg-card px-6">
      <div className="mx-auto grid max-w-6xl grid-cols-[1fr_auto_1fr] items-center gap-4">
        <Link to="/" className="font-glitch text-xl text-cyan-300">
          MIRRORIMAGE
        </Link>
        <nav className="flex justify-center text-sm text-muted-foreground">
          <Button className={navButtonClassName} onClick={() => navigate("/")}>
            HOME
          </Button>
          <Button className={navButtonClassName}>CARDS</Button>
          <Button
            className={navButtonClassName}
            onClick={() => navigate("/how-to-play")}
          >
            HOW TO PLAY
          </Button>
          <Button className={navButtonClassName}>UPDATES</Button>
        </nav>

        <div className="flex justify-end">
          <Button className={navButtonClassName}>LOGIN</Button>
        </div>
      </div>
    </header>
  )
}
