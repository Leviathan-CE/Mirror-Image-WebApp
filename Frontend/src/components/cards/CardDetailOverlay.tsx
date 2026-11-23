/**
 * Full-screen card detail dialog (library / admin catalogue).
 *
 * Takes the shared library receive model — do not invent a parallel card shape.
 */

import { useEffect } from "react"
import { createPortal } from "react-dom"

import { CardChangeBanner } from "@/components/cards/CardChangeBanner"
import { CardCostIcons } from "@/components/cards/CardCostIcons"
import { CardRulesText } from "@/components/cards/CardRulesText"
import {
  parseKeyword,
  splitHelpAtX,
  type ParsedKeyword,
} from "@/components/cards/keywordHelp.logic"
import { GameIcon } from "@/components/common/GameIcon"
import { GlitchFx } from "@/components/effects/GlitchFx"
import type { CardLibraryItem } from "@/lib/api/cards"
import { cardFaceUrl } from "@/lib/api/decks"
import {
  changedRow,
  type CardDetailChange,
} from "@/lib/cardBanner.logic"
import type { CardDiffRow } from "@/lib/inboxCardDiff.logic"

const helpClassName = "mt-0.5 block italic text-white/60"

function KeywordHelp({ keyword }: { keyword: ParsedKeyword }) {
  const help = keyword.help
  if (help == null) return null
  const split =
    keyword.helpKey === "STEALTH X" ? splitHelpAtX(help) : null
  if (split == null || keyword.paramTokens.length === 0) {
    return <span className={helpClassName}>{help}</span>
  }
  return (
    <span className={helpClassName}>
      {split.before}
      <CardCostIcons
        cost={keyword.paramTokens}
        className="inline-flex items-center align-middle"
        iconClassName="h-5 w-auto lg:h-6"
      />
      {split.after}
    </span>
  )
}

const closeButtonClassName =
  "font-buahs93 h-9 rounded-none border border-cyan-500/35 bg-black/70 px-3 text-sm text-cyan-100 hover:border-cyan-400/60 hover:bg-cyan-500/10 hover:text-white"

/** Library/admin card + optional admin chrome line. */
export type CardDetailOverlayCard = CardLibraryItem & {
  metaLine?: string | null
}

type CardDetailOverlayProps = {
  card: CardDetailOverlayCard | null
  onClose: () => void
  /** Inbox/catalogue change callout. Omit when browsing a plain card. */
  change?: CardDetailChange | null
  /** Render in the parent instead of a full-screen dialog. */
  embedded?: boolean
}

function WasLine({ row }: { row: CardDiffRow | null }) {
  if (row == null) return null
  if (row.before === "—") return null
  return (
    <p className="font-mono text-[11px] text-white/40 line-through">
      {row.before}
    </p>
  )
}

export function CardDetailOverlay({
  card,
  onClose,
  change = null,
  embedded = false,
}: CardDetailOverlayProps) {
  useEffect(() => {
    if (!card) return
    if (embedded) return
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [card, embedded, onClose])

  if (!card) return null

  const art = cardFaceUrl(card)
  const threat = (card.threat_level ?? "0").trim()
  const showThreat =
    card.has_tlv === true && threat !== "" && threat !== "0"
  const showInvokeCost = card.has_invoke_cost === true
  const keywords = card.keywords ?? []
  const rows = change?.rows ?? []
  const costRow =
    changedRow(rows, "cost") ?? changedRow(rows, "invoke_cost")
  const costChanged = costRow != null
  const beforeCost = change?.beforeCost ?? []
  const afterCost =
    change?.afterCost && change.afterCost.length > 0
      ? change.afterCost
      : card.cost
  const threatRow = changedRow(rows, "threat_level")
  const typesChanged =
    changedRow(rows, "super_types") != null ||
    changedRow(rows, "sub_types") != null ||
    changedRow(rows, "types_line") != null
  const keywordRow = changedRow(rows, "keywords")
  const rulesRow = changedRow(rows, "description")
  const setRow = changedRow(rows, "card_set_name")
  const rarityRow = changedRow(rows, "rarity")

  const frameClass = embedded
    ? "grid max-h-[min(96vh,100%)] w-full gap-4 overflow-y-auto " +
      "border border-cyan-500/30 bg-black/95 p-3 sm:gap-6 sm:p-5 " +
      "md:grid-cols-[minmax(14rem,42%)_minmax(0,1fr)] " +
      "md:gap-8 md:p-6 " +
      "lg:grid-cols-[minmax(18rem,46%)_minmax(0,1fr)]"
    : "grid max-h-[min(96vh,100%)] w-full " +
      "max-w-[min(96vw,90rem)] gap-4 overflow-y-auto " +
      "border border-cyan-500/30 bg-black/95 p-3 sm:gap-6 sm:p-5 " +
      "md:grid-cols-[minmax(14rem,42%)_minmax(0,1fr)] " +
      "md:gap-8 md:p-6 " +
      "lg:grid-cols-[minmax(18rem,46%)_minmax(0,1fr)]"

  const panel = (
      <div
        className={frameClass}
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
          {change ? (
            <div className="mt-2">
              <CardChangeBanner
                kind={change.kind}
                className="relative left-0 top-0 inline-block"
              />
            </div>
          ) : null}
          <p className="mt-2 font-mono text-sm text-cyan-400/70 sm:text-base">
            {card.card_set_name} · {card.rarity}
          </p>
          {setRow || rarityRow ? (
            <WasLine
              row={
                setRow ?? rarityRow
              }
            />
          ) : null}
          {card.metaLine ? (
            <p className="mt-1 font-mono text-xs text-cyan-300/55">
              {card.metaLine}
            </p>
          ) : null}
          <div className="mt-4 flex flex-wrap items-start gap-8 sm:mt-5">
            {showInvokeCost || costChanged ? (
              <div className="space-y-2">
                <p className="font-buahs93 text-sm text-cyan-200/80 sm:text-base">
                  INVOKE COST
                </p>
                {costChanged ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-buahs93 text-[11px] text-white/45">
                      was:
                    </span>
                    <CardCostIcons
                      cost={beforeCost}
                      iconClassName="h-6 w-auto opacity-55 lg:h-7 2xl:h-7"
                    />
                    <span className="font-mono text-sm text-cyan-300/70">
                      →
                    </span>
                    <span className="font-buahs93 text-[11px] text-cyan-200/80">
                      now:
                    </span>
                    <CardCostIcons
                      cost={afterCost}
                      iconClassName="h-6 w-auto lg:h-7 2xl:h-7"
                    />
                  </div>
                ) : (
                  <CardCostIcons
                    cost={card.cost}
                    iconClassName="h-6 w-auto lg:h-7 2xl:h-7"
                  />
                )}
              </div>
            ) : null}
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
                <WasLine row={threatRow} />
              </div>
            ) : null}
          </div>
          <p
            className={
              typesChanged
                ? "mt-4 font-mono text-sm text-cyan-200 sm:text-base"
                : "mt-4 font-mono text-sm text-white/55 sm:text-base"
            }
          >
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
                      <span
                        className={
                          "inline-flex flex-wrap items-center gap-1 " +
                          "font-buahs93 text-cyan-100"
                        }
                      >
                        {kw.name}
                        {kw.paramTokens.length === 0 ? null : (
                          <CardCostIcons
                            cost={kw.paramTokens}
                            className="inline-flex items-center"
                            iconClassName="h-5 w-auto lg:h-6"
                          />
                        )}
                      </span>
                      <KeywordHelp keyword={kw} />
                    </li>
                  )
                })}
              </ul>
            </div>
          ) : null}

          {keywordRow ? <WasLine row={keywordRow} /> : null}

          <div className="mt-5 sm:mt-6">
            <p className="mb-2 font-buahs93 text-xs tracking-wide text-cyan-300/80">
              RULES TEXT
            </p>
            {rulesRow && rulesRow.before !== "—" ? (
              <div className="mb-3 border border-cyan-500/15 bg-black/40 p-3">
                <p className="mb-1 font-buahs93 text-[10px] tracking-wide text-white/40">
                  WAS
                </p>
                <CardRulesText
                  text={rulesRow.before}
                  className="text-sm text-white/40 line-through sm:text-base"
                />
              </div>
            ) : null}
            <CardRulesText text={card.description ?? ""} />
          </div>
        </div>
      </div>
  )

  if (embedded) return panel
  if (typeof document === "undefined") return null

  return createPortal(
    <div
      className={
        "fixed inset-0 z-[10000] flex items-center justify-center " +
        "bg-black/85 p-2 sm:p-4 md:p-6"
      }
      role="dialog"
      aria-modal="true"
      aria-label={card.card_name}
      onClick={onClose}
    >
      {panel}
    </div>,
    document.body
  )
}
