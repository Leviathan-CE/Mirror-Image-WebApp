/**
 * Full-screen card detail dialog (library / admin catalogue).
 */

import { useEffect } from "react"
import { createPortal } from "react-dom"

import { CardCostIcons } from "@/components/cards/CardCostIcons"
import { CardRulesText } from "@/components/cards/CardRulesText"
import { parseKeyword } from "@/components/cards/keywordHelp.logic"
import { GameIcon } from "@/components/common/GameIcon"
import { GlitchFx } from "@/components/effects/GlitchFx"
import { cardArtUrl } from "@/lib/api/decks"

const closeButtonClassName =
  "font-buahs93 h-9 rounded-none border border-cyan-500/35 bg-black/70 px-3 text-sm text-cyan-100 hover:border-cyan-400/60 hover:bg-cyan-500/10 hover:text-white"

/** Fields needed to render the shared detail panel. */
export type CardDetailOverlayData = {
  card_name: string
  card_set_name: string
  rarity: string
  cost: string[]
  threat_level?: string
  super_types?: string[]
  sub_types?: string[]
  types_line?: string
  keywords?: string[]
  description?: string
  card_art_path: string | null
  card_art_version?: number | null
  /** Optional admin metadata line. */
  metaLine?: string | null
}

type CardDetailOverlayProps = {
  card: CardDetailOverlayData | null
  onClose: () => void
}

export function CardDetailOverlay({ card, onClose }: CardDetailOverlayProps) {
  useEffect(() => {
    if (!card) return
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [card, onClose])

  if (!card || typeof document === "undefined") return null

  const art = cardArtUrl(card.card_art_path, card.card_art_version)
  const threat = (card.threat_level ?? "0").trim()
  const showThreat = threat !== "" && threat !== "0"
  const keywords = card.keywords ?? []

  return createPortal(
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/85 p-2 sm:p-4 md:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={card.card_name}
      onClick={onClose}
    >
      <div
        className="grid max-h-[min(96vh,100%)] w-full max-w-[min(96vw,90rem)] gap-4 overflow-y-auto border border-cyan-500/30 bg-black/95 p-3 sm:gap-6 sm:p-5 md:grid-cols-[minmax(14rem,42%)_minmax(0,1fr)] md:gap-8 md:p-6 lg:grid-cols-[minmax(18rem,46%)_minmax(0,1fr)]"
        onClick={(event) => event.stopPropagation()}
      >
        {art ? (
          <img
            src={art}
            alt=""
            className="mx-auto h-auto max-h-[min(70vh,52rem)] w-full max-w-md object-contain md:max-h-[min(88vh,64rem)] md:max-w-none"
          />
        ) : (
          <div className="flex aspect-[2/3] max-h-[70vh] items-center justify-center border border-dashed border-cyan-500/25 font-mono text-xs text-cyan-500/40 md:max-h-[88vh]">
            NO ART
          </div>
        )}
        <div className="flex min-h-0 flex-col">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <h2 className="font-glitch text-3xl text-cyan-300 sm:text-4xl lg:text-5xl">
              {card.card_name}
            </h2>
            <GlitchFx
              type="button"
              label="CLOSE"
              className={closeButtonClassName}
              onClick={onClose}
            />
          </div>
          <p className="mt-2 font-mono text-sm text-cyan-400/70 sm:text-base">
            {card.card_set_name} · {card.rarity}
          </p>
          {card.metaLine ? (
            <p className="mt-1 font-mono text-xs text-cyan-300/55">
              {card.metaLine}
            </p>
          ) : null}
          <div className="mt-4 flex flex-wrap items-start gap-8 sm:mt-5">
            <div className="space-y-2">
              <p className="font-buahs93 text-sm text-cyan-200/80 sm:text-base">
                INVOKE COST
              </p>
              <CardCostIcons
                cost={card.cost}
                iconClassName="h-6 w-auto lg:h-7 2xl:h-7"
              />
            </div>
            {showThreat ? (
              <div className="space-y-2">
                <p className="font-buahs93 text-sm text-cyan-200/80 sm:text-base">
                  THREAT LEVEL
                </p>
                <div className="flex items-center gap-1.5">
                  <GameIcon
                    name="threat_lvl"
                    className="h-7 w-auto lg:h-8 2xl:h-8"
                  />
                  <span className="font-buahs93 text-base text-cyan-100 sm:text-lg">
                    {threat}
                  </span>
                </div>
              </div>
            ) : null}
          </div>
          <p className="mt-4 font-mono text-sm text-white/55 sm:text-base">
            {[...(card.super_types ?? []), ...(card.sub_types ?? [])]
              .filter(Boolean)
              .join(" · ") || "—"}
            {card.types_line ? ` · ${card.types_line}` : ""}
          </p>

          {keywords.length > 0 ? (
            <div className="mt-5 border border-cyan-500/20 bg-black/40 p-3 sm:p-4">
              <p className="font-buahs93 text-xs tracking-wide text-cyan-300/80">
                KEYWORDS
              </p>
              <ul className="mt-2 space-y-2">
                {keywords.map((raw) => {
                  const kw = parseKeyword(raw)
                  return (
                    <li key={raw} className="text-sm sm:text-base">
                      <span className="font-buahs93 text-cyan-100">
                        {kw.label}
                      </span>
                      {kw.help ? (
                        <span className="mt-0.5 block italic text-white/60">
                          {kw.help}
                        </span>
                      ) : null}
                    </li>
                  )
                })}
              </ul>
            </div>
          ) : null}

          <div className="mt-5 sm:mt-6">
            <p className="mb-2 font-buahs93 text-xs tracking-wide text-cyan-300/80">
              RULES TEXT
            </p>
            <CardRulesText text={card.description ?? ""} />
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
