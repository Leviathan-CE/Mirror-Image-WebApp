/**
 * Guest / marketing header (no session).
 * Styles: `headerStyles.ts`. Frame: `HeaderShell`.
 */

import { UserRound } from "lucide-react"
import { useNavigate } from "react-router-dom"

import { HeaderNav } from "@/components/common/HeaderNav"
import { HeaderShell } from "@/components/common/HeaderShell"
import { GlitchFx } from "@/components/effects/GlitchFx"
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
              id: "plans",
              label: "PLANS",
              onSelect: () => navigate(ROUTES.PLANS),
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
        </div>
      }
    />
  )
}
