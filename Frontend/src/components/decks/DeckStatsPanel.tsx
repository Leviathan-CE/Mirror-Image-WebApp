/**
 * Deck builder stats. Sits in the library aside when STATS is on.
 */

import { useEffect, useMemo, useState } from "react"

import { COLOR_ICONS } from "@/components/cards/constants"
import { CardCostIcons } from "@/components/cards/CardCostIcons"
import { GameIcon } from "@/components/common/GameIcon"

import {
  buildDeckStats,
  deckOutTurn,
  defaultFocus,
  drawReport,
  percentLabel,
  playTurnForRate,
  rampBandLabel,
  rampBandOf,
  resourceNeed,
  startingStockpileForSeat,
  targetCard,
  type Seat,
  type StatFocus,
} from "@/components/decks/deckStats.logic"
import {
  fetchSimilarDeckTags,
  type DeckDetail,
  type SimilarDeckTag,
} from "@/lib/api/decks"

type DeckStatsPanelProps = {
  deck: DeckDetail
  token: string | null
  disabled: boolean
  onAddTag: (tag: string) => void
}

type SimilarState = {
  deckId: number
  status: "loading" | "ready" | "error"
  tags: SimilarDeckTag[]
  compared: number
}

const PIP_FILL: Record<string, string> = {
  LIF: "#ef4444",
  MET: "#a855f7",
  POW: "#eab308",
  RAM: "#3b82f6",
  TIM: "#22c55e",
  STL: "#94a3b8",
  Hybrid: "#fb923c",
  GREY: "#94a3b8",
  MULTI: "#64748b",
  NONE: "#64748b",
}

const PIE_LEGEND_ICON =
  "mx-1 h-12 w-12 lg:h-12 2xl:h-12"

function Heading({
  title,
  aside,
}: {
  title: string
  aside?: string
}) {
  return (
    <div className="mt-6">
      <h3
        className={
          "font-mono text-base tracking-wide text-cyan-200"
        }
      >
        {title}
      </h3>
      {aside ? (
        <p className="mt-1 font-mono text-sm text-white/70">
          {aside}
        </p>
      ) : null}
    </div>
  )
}

function BarButton({
  label,
  count,
  max,
  active,
  onClick,
}: {
  label: string
  count: number
  max: number
  active: boolean
  onClick: () => void
}) {
  const width = max <= 0 ? 0 : Math.round((count / max) * 100)
  const bar = active ? "bg-cyan-200" : "bg-cyan-300/70"
  return (
    <button
      type="button"
      aria-label={`${label}, ${count}`}
      onClick={onClick}
      className="block w-full py-1 text-left"
    >
      <span className="flex items-center gap-3">
        <span
          className={
            "w-32 shrink-0 truncate text-left " +
            "font-mono text-base text-cyan-100"
          }
        >
          {label}
        </span>
        <span className="h-4 flex-1 bg-white/10">
          <span
            className={`block h-4 ${bar}`}
            style={{ width: `${width}%` }}
          />
        </span>
        <span
          className={
            "w-10 shrink-0 text-right font-mono " +
            "text-base tabular-nums text-white/80"
          }
        >
          {count}
        </span>
      </span>
    </button>
  )
}

function PieChart({
  slices,
}: {
  slices: { id: string; value: number }[]
}) {
  const total = slices.reduce((sum, slice) => sum + slice.value, 0)
  if (total <= 0) {
    return (
      <p className="w-full text-center font-mono text-sm text-white/45">
        No colored pips.
      </p>
    )
  }
  if (slices.length === 1) {
    const only = slices[0]
    return (
      <svg
        viewBox="0 0 96 96"
        className="mx-auto block aspect-square w-full max-w-72"
        aria-hidden
      >
        <circle
          cx="48"
          cy="48"
          r="42"
          fill={PIP_FILL[only.id] ?? "#7df9ff"}
        />
      </svg>
    )
  }
  let angle = -Math.PI / 2
  const radius = 42
  const paths: { id: string; d: string }[] = []
  for (const slice of slices) {
    const sweep = (slice.value / total) * Math.PI * 2
    const end = angle + sweep
    const large = sweep > Math.PI ? 1 : 0
    const startX = 48 + radius * Math.cos(angle)
    const startY = 48 + radius * Math.sin(angle)
    const endX = 48 + radius * Math.cos(end)
    const endY = 48 + radius * Math.sin(end)
    const d = [
      "M 48 48",
      `L ${startX} ${startY}`,
      `A ${radius} ${radius} 0 ${large} 1 ${endX} ${endY}`,
      "Z",
    ].join(" ")
    paths.push({ id: slice.id, d })
    angle = end
  }
  return (
    <svg
      viewBox="0 0 96 96"
      className="mx-auto block aspect-square w-full max-w-72"
      aria-hidden
    >
      {paths.map((path) => (
        <path
          key={path.id}
          d={path.d}
          fill={PIP_FILL[path.id] ?? "#7df9ff"}
        >
          <title>{path.id}</title>
        </path>
      ))}
    </svg>
  )
}

export function DeckStatsPanel({
  deck,
  token,
  disabled,
  onAddTag,
}: DeckStatsPanelProps) {
  const model = useMemo(() => buildDeckStats(deck), [deck])
  const [seat, setSeat] = useState<Seat>("first")
  const [turn, setTurn] = useState(3)
  const [pipMode, setPipMode] = useState(true)
  const [focus, setFocus] = useState<StatFocus>(() =>
    defaultFocus(model)
  )
  const [similar, setSimilar] = useState<SimilarState>({
    deckId: -1,
    status: "loading",
    tags: [],
    compared: 0,
  })

  useEffect(() => {
    let cancelled = false
    void fetchSimilarDeckTags(deck.id, token)
      .then((body) => {
        if (cancelled) return
        setSimilar({
          deckId: deck.id,
          status: "ready",
          tags: body.tags,
          compared: body.compared,
        })
      })
      .catch(() => {
        if (cancelled) return
        setSimilar({
          deckId: deck.id,
          status: "error",
          tags: [],
          compared: 0,
        })
      })
    return () => {
      cancelled = true
    }
  }, [deck.id, token])

  const odds = drawReport(deck, model, focus, seat, turn)
  const spell = targetCard(model)
  let stockpileTotal = 0
  for (const amount of Object.values(model.stockpile)) {
    stockpileTotal += amount
  }
  const startPool = startingStockpileForSeat(
    stockpileTotal,
    seat
  )
  const needed = spell ? resourceNeed(spell.cost) : 0
  const turnAtOne = playTurnForRate(startPool, needed, 1)
  const turnAtTwo = playTurnForRate(startPool, needed, 2)
  const remaining = Math.max(0, model.deckSize - model.handSize)
  const curveMax = model.curve.reduce(
    (max, bin) => Math.max(max, bin.count),
    0
  )
  const typeMax = Math.max(
    1,
    ...model.superTypes.map((row) => row.count),
    ...model.speeds.map((row) => row.count)
  )
  const colorRows = pipMode
    ? [
      ...model.pipColors,
      ...(model.hybridPips > 0
        ? [
          {
            id: "Hybrid" as const,
            count: model.hybridPips,
            share: 0,
          },
        ]
        : []),
    ]
    : model.cardColors
  const owned = new Set(
    (deck.tags ?? []).map((tag) => tag.toLowerCase())
  )
  const suggestions =
    similar.deckId === deck.id
      ? similar.tags.filter((row) => !owned.has(row.tag.toLowerCase()))
      : []
  const similarPending = similar.deckId !== deck.id
  const listed = model.cards
    .filter((card) => {
      if (focus.kind === "cost") return card.invokeCost === focus.cost
      if (focus.kind === "type") {
        const needle = focus.typeName.toLowerCase()
        return card.types.some(
          (name) => name.toLowerCase() === needle
        )
      }
      if (focus.kind === "card") return card.id === focus.cardId
      if (focus.kind === "ramp") {
        return rampBandOf(card.cost) === focus.pips
      }
      return card.categoryId === focus.categoryId
    })
    .slice(0, 8)
  const nameRows = listed.length > 0 ? listed : model.cards.slice(0, 8)
  let rampMax = 1
  for (const group of model.rampQuality) {
    if (group.total > rampMax) rampMax = group.total
    for (const color of group.colors) {
      if (color.count > rampMax) rampMax = color.count
    }
  }
  const mean =
    model.meanInvoke == null ? "—" : model.meanInvoke.toFixed(1)
  const seatLabel = seat === "first" ? "going first" : "going second"
  const conversionOdds = [0, 1, 2].map((pips) => {
    const group = model.rampQuality.find((row) => row.pips === pips)
    const count = group?.total ?? 0
    const chance =
      model.deckSize <= 0 ? 0 : count / model.deckSize
    return {
      pips,
      label: rampBandLabel(pips),
      chance,
    }
  })

  return (
    <div
      className={
        "mi-scrollbar max-h-[calc(100vh-8rem)] " +
        "overflow-y-auto pr-1"
      }
    >
      <h2 className="font-mono text-lg tracking-wide text-cyan-100">
        STATS
      </h2>
      <div className="mt-3">
        <LegalRow
          ok={model.legal.sizeOk}
          label={deckSizeLabel(
            model.legal.size,
            model.legal.sizeOk
          )}
        />
        <LegalRow
          ok={model.legal.pilotOk}
          label={`pilot ${model.legal.pilotCount}`}
        />
        <LegalRow
          ok={model.legal.sideOk}
          label={
            "objectives " +
            model.legal.objectiveCount +
            ", augments " +
            model.legal.augmentCount
          }
        />
        <LegalRow ok={model.legal.copiesOk} label="copies" />
        <LegalRow
          ok={model.legal.prototypeOk}
          label="prototype"
        />
      </div>
      <Heading title="DECK COLORS" />
      <div className="mt-3 flex flex-col items-center gap-3">
        <PieChart
          slices={model.deckColors.map((row) => ({
            id: row.id,
            value: row.count,
          }))}
        />
        <div className="flex flex-col items-center gap-2">
          {model.deckColors.map((row) => (
            <p
              key={row.id}
              className={
                "flex items-center justify-center gap-2 " +
                "font-mono text-2xl text-white/80"
              }
              title={`${row.count} ${row.id}`}
            >
              <ColorLabel
                id={row.id}
                iconClassName={PIE_LEGEND_ICON}
                swatchClassName="inline-block h-6 w-6"
              />
              {row.count}
              {` · ${percentLabel(row.share)}`}
            </p>
          ))}
        </div>
      </div>
      <p className="mt-2 text-center font-mono text-sm text-white/45">
        Each color on a card adds to that color. A card
        with only grey pips is grey.
      </p>

      <Heading title="INVOKE CURVE" aside={`avg ${mean}`} />
      <div className="mt-3 flex items-stretch gap-2">
        <div
          className={
            "flex w-8 shrink-0 items-center justify-center"
          }
        >
          <span
            className={
              "origin-center -rotate-90 whitespace-nowrap " +
              "font-mono text-sm text-cyan-100/80"
            }
          >
            total number of cards
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <div
            className={
              "flex flex-wrap items-end justify-center gap-3"
            }
          >
            {model.curve.map((bin) => (
              <RampColumn
                key={`cost-${bin.cost}`}
                label={String(bin.cost)}
                count={bin.count}
                max={curveMax}
                active={
                  focus.kind === "cost" && focus.cost === bin.cost
                }
                onClick={() =>
                  setFocus({ kind: "cost", cost: bin.cost })
                }
              />
            ))}
          </div>
          <p
            className={
              "mt-2 text-center font-mono text-sm " +
              "text-cyan-100/80"
            }
          >
            invoke cost
          </p>
        </div>
      </div>
      {model.noCost > 0 ? (
        <p className="font-mono text-sm text-white/45">
          {model.noCost} with no invoke cost
        </p>
      ) : null}

      <Heading title="DRAW THIS" aside={odds.label} />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button
          type="button"
          className={seatButton(seat === "first")}
          onClick={() => setSeat("first")}
        >
          1ST
        </button>
        <button
          type="button"
          className={seatButton(seat === "second")}
          onClick={() => setSeat("second")}
        >
          2ND
        </button>
        <label className="ml-auto flex items-center gap-2">
          <span className="font-mono text-sm text-cyan-100/70">
            TURN {turn}
          </span>
          <input
            type="range"
            min={1}
            max={10}
            value={turn}
            onChange={(event) => setTurn(Number(event.target.value))}
          />
        </label>
      </div>
      <p className="mt-1 font-mono text-sm text-white/60">
        {odds.matched} cards · by turn {turn}, {seatLabel}
      </p>
      <div className="mt-2 h-3 bg-white/10">
        <div
          className="h-3 bg-cyan-300/80"
          style={{
            width: `${Math.round(odds.atLeastOne * 100)}%`,
          }}
        />
      </div>
      <p className="mt-1 font-mono text-sm text-cyan-100/80">
        {percentLabel(odds.atLeastOne)} at least one
      </p>
      <p className="font-mono text-sm text-white/50">
        {percentLabel(odds.exactlyOne)} exactly one
        {" · "}
        {percentLabel(odds.twoOrMore)} two or more
      </p>
      <p className="font-mono text-sm text-white/50">
        {odds.sectionName}{" "}
        {percentLabel(odds.sectionShare)} of the deck
      </p>
      <div className="mt-1 flex flex-col">
        {nameRows.map((card) => (
          <button
            key={card.id}
            type="button"
            className={
              "truncate text-left font-mono text-sm " +
              "text-cyan-100/70 hover:text-cyan-100"
            }
            onClick={() =>
              setFocus({ kind: "card", cardId: card.id })
            }
          >
            {card.quantity}× {card.name}
          </button>
        ))}
      </div>

      <Heading title="PAYING THE HIGHEST INVOKE COST ASSET" />
      {spell ? (
        <div className="mt-1">
          <p
            className={
              "flex flex-wrap items-center gap-1 " +
              "font-mono text-lg text-cyan-100/80"
            }
          >
            <span>{spell.name}</span>
            <span>·</span>
            <CardCostIcons
              cost={spell.cost}
              className="inline-flex flex-wrap items-center"
              iconClassName="h-7 w-7"
            />
          </p>
          <p className="mt-1 font-mono text-lg text-white/70">
            1 resource a turn: turn {turnAtOne}
          </p>
          <p className="font-mono text-lg text-white/70">
            2 resources a turn: turn {turnAtTwo}
          </p>
        </div>
      ) : (
        <p className="mt-1 font-mono text-sm text-white/45">
          No costed card in the deck yet.
        </p>
      )}

      <Heading title="COLORS" />
      <div className="mt-2 flex justify-center gap-2">
        <button
          type="button"
          className={seatButton(pipMode)}
          onClick={() => setPipMode(true)}
        >
          PIPS
        </button>
        <button
          type="button"
          className={seatButton(!pipMode)}
          onClick={() => setPipMode(false)}
        >
          CARDS
        </button>
      </div>
      <div className="mt-3 flex flex-col items-center gap-3">
        <PieChart
          slices={colorRows.map((row) => ({
            id: row.id,
            value: row.count,
          }))}
        />
        <div className="flex flex-col items-center gap-2">
          {colorRows.map((row) => (
            <p
              key={row.id}
              className={
                "flex items-center justify-center gap-2 " +
                "font-mono text-2xl text-white/80"
              }
              title={`${row.count} ${row.id}`}
            >
              <ColorLabel
                id={row.id}
                iconClassName={PIE_LEGEND_ICON}
                swatchClassName="inline-block h-6 w-6"
              />
              {row.count}
              {pipMode && row.id !== "Hybrid"
                ? ` · ${percentLabel(row.share)}`
                : ""}
            </p>
          ))}
        </div>
      </div>
      <Heading title="CARD CONVERSION QUALITY" />
      <div className="mt-3 flex flex-wrap items-end justify-center gap-6">
        {model.rampQuality.map((group) => (
          <div
            key={group.pips}
            className="flex items-end gap-2"
          >
            <RampColumn
              label={rampBandLabel(group.pips)}
              count={group.total}
              max={rampMax}
              active={
                focus.kind === "ramp" && focus.pips === group.pips
              }
              onClick={() =>
                setFocus({ kind: "ramp", pips: group.pips })
              }
            />
            {group.colors.map((color) => (
              <ColorColumn
                key={color.id}
                label={color.id}
                count={color.count}
                max={rampMax}
                fill={PIP_FILL[color.id] ?? "#7df9ff"}
              />
            ))}
          </div>
        ))}
      </div>
      <p className="mt-3 font-mono text-sm text-white/60">
        Drawing 1 card
      </p>
      {conversionOdds.map((row) => (
        <p
          key={row.pips}
          className="font-mono text-base text-white/80"
        >
          {row.label}
          {" · "}
          {percentLabel(row.chance)}
        </p>
      ))}

      <Heading title="TYPES" />
      {model.superTypes.map((row) => (
        <BarButton
          key={row.name}
          label={row.name}
          count={row.count}
          max={typeMax}
          active={
            focus.kind === "type" && focus.typeName === row.name
          }
          onClick={() =>
            setFocus({ kind: "type", typeName: row.name })
          }
        />
      ))}
      {model.speeds.map((row) => (
        <BarButton
          key={row.name}
          label={row.name}
          count={row.count}
          max={typeMax}
          active={
            focus.kind === "type" && focus.typeName === row.name
          }
          onClick={() =>
            setFocus({ kind: "type", typeName: row.name })
          }
        />
      ))}

      <Heading title="UNITS" />
      {model.units.averageDamage != null ? (
        <AverageStatLine
          label="dmg"
          value={model.units.averageDamage}
          max={Math.max(
            1,
            ...model.units.damage.map((bin) => Number(bin.name)),
            model.units.averageDamage
          )}
        />
      ) : null}
      {model.units.averageHealth != null ? (
        <AverageStatLine
          label="hp"
          value={model.units.averageHealth}
          max={Math.max(
            1,
            ...model.units.health.map((bin) => Number(bin.name)),
            model.units.averageHealth
          )}
        />
      ) : (
        <p className="mt-2 font-mono text-l text-white/45">
          no units
        </p>
      )}
      <div className="ml-4">
        <p
          className={
            "mt-4 font-mono text-base tracking-wide text-cyan-200"
          }
        >
          HEALTH
        </p>
        {model.units.health.map((row) => (
          <BarButton
            key={`hp-${row.name}`}
            label={row.name}
            count={row.count}
            max={Math.max(
              1,
              ...model.units.health.map((bin) => bin.count)
            )}
            active={false}
            onClick={() => undefined}
          />
        ))}
        <p
          className={
            "mt-4 font-mono text-base tracking-wide text-cyan-200"
          }
        >
          DAMAGE
        </p>
        {model.units.damage.map((row) => (
          <BarButton
            key={`dmg-${row.name}`}
            label={row.name}
            count={row.count}
            max={Math.max(
              1,
              ...model.units.damage.map((bin) => bin.count)
            )}
            active={false}
            onClick={() => undefined}
          />
        ))}
      </div>
      <UnitCountLine
        className="mt-1 font-mono text-sm text-white/55"
        rows={model.units.keywords.map((row) => ({
          label: row.name,
          count: row.count,
        }))}
      />
      <UnitCountLine
        className="font-mono text-sm text-white/45"
        rows={[
          { label: "Programs", count: model.units.programs },
          {
            label: "Technologies",
            count: model.units.technologies,
          },
          {
            label: "Quick Hack",
            count: model.units.quickHacks,
          },
        ]}
      />

      <Heading title="DECK CLOCK" />
      <p className="mt-1 font-mono text-sm text-white/60">
        Hand {model.handSize}. Empty draw fails on your turn{" "}
        {deckOutTurn(remaining, 1, seat)}.
      </p>
      <p className="font-mono text-sm text-white/60">
        One extra draw each turn: turn{" "}
        {deckOutTurn(remaining, 2, seat)}.
      </p>

      <Heading
        title="SIMILAR DECKS"
        aside={
          similarPending || similar.status !== "ready"
            ? undefined
            : `${similar.compared} close`
        }
      />
      <SimilarTags
        pending={similarPending}
        status={similar.deckId === deck.id ? similar.status : "loading"}
        compared={similar.compared}
        tags={suggestions}
        disabled={disabled}
        onAddTag={onAddTag}
      />
    </div>
  )
}

function seatButton(active: boolean): string {
  const tone = active
    ? "border-cyan-300 bg-cyan-400/20 text-cyan-50"
    : "border-cyan-500/30 text-cyan-100/70"
  return (
    "h-9 border px-3 font-mono text-sm tracking-wide " + tone
  )
}

function ColorLabel({
  id,
  iconClassName = "mx-1 h-7 w-7",
  swatchClassName = "mr-2 inline-block h-3 w-3",
}: {
  id: string
  iconClassName?: string
  swatchClassName?: string
}) {
  const icon = id === "GREY" ? "genX" : COLOR_ICONS[id]
  if (icon) {
    return <GameIcon name={icon} className={iconClassName} />
  }
  return (
    <>
      <span
        className={swatchClassName}
        style={{
          backgroundColor: PIP_FILL[id] ?? "#7df9ff",
        }}
      />
      {id}
    </>
  )
}

function deckSizeLabel(size: number, ok: boolean): string {
  if (ok) return `${size} cards`
  return `${size} cards, need 40 to 100`
}

function LegalRow({
  ok,
  label,
}: {
  ok: boolean
  label: string
}) {
  const tone = ok ? "text-emerald-300" : "text-red-400"
  const status = ok ? "legal" : "not legal"
  return (
    <p className="mt-1 font-mono text-sm text-white/70">
      {label}
      {" · "}
      <span className={tone}>{status}</span>
    </p>
  )
}

function RampColumn({
  label,
  count,
  max,
  active,
  onClick,
}: {
  label: string
  count: number
  max: number
  active: boolean
  onClick: () => void
}) {
  const height = max <= 0 ? 0 : Math.round((count / max) * 100)
  const fill = active ? "bg-cyan-200" : "bg-cyan-300/70"
  return (
    <button
      type="button"
      aria-label={`${label}, ${count}`}
      onClick={onClick}
      className="flex w-20 flex-col items-center gap-2"
    >
      <span
        className={
          "flex h-8 w-full items-end justify-center " +
          "font-mono text-xl tabular-nums text-white"
        }
      >
        {count}
      </span>
      <span className="flex h-40 w-12 items-end bg-white/10">
        {height > 0 ? (
          <span
            className={"block w-full " + fill}
            style={{ height: `${height}%` }}
          />
        ) : null}
      </span>
      <span
        className={
          "flex h-10 w-full items-start justify-center " +
          "text-center font-mono text-base leading-tight " +
          "text-cyan-100"
        }
      >
        {label}
      </span>
    </button>
  )
}

function ColorColumn({
  label,
  count,
  max,
  fill,
}: {
  label: string
  count: number
  max: number
  fill: string
}) {
  const height = max <= 0 ? 0 : Math.round((count / max) * 100)
  return (
    <div className="flex w-12 flex-col items-center gap-2">
      <span
        className={
          "flex h-8 w-full items-end justify-center " +
          "font-mono text-xl tabular-nums text-white"
        }
      >
        {count}
      </span>
      <span className="flex h-40 w-5 items-end bg-white/10">
        {height > 0 ? (
          <span
            className="block w-full"
            style={{
              height: `${height}%`,
              backgroundColor: fill,
            }}
          />
        ) : null}
      </span>
      <span className="flex h-10 w-full items-start justify-center">
        <ColorLabel id={label} />
      </span>
    </div>
  )
}

function UnitCountLine({
  rows,
  className,
}: {
  rows: { label: string; count: number }[]
  className: string
}) {
  const shown = rows.filter((row) => row.count > 0)
  if (shown.length === 0) return null
  return (
    <p className={className}>
      {shown.map((row, index) => (
        <span key={row.label}>
          {index > 0 ? " · " : ""}
          {row.label} {row.count}
        </span>
      ))}
    </p>
  )
}

function AverageStatLine({
  label,
  value,
  max,
}: {
  label: string
  value: number
  max: number
}) {
  const width =
    max <= 0 ? 0 : Math.round((value / max) * 100)
  return (
    <div className="mt-2 flex items-center gap-3">
      <p
        className={
          "w-24 shrink-0 font-mono text-sm text-cyan-100"
        }
      >
        {label} {value.toFixed(1)}
      </p>
      <div className="h-4 min-w-0 flex-1 bg-white/10">
        <div
          className="h-4 bg-cyan-300/80"
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  )
}

function SimilarTags({
  pending,
  status,
  compared,
  tags,
  disabled,
  onAddTag,
}: {
  pending: boolean
  status: SimilarState["status"]
  compared: number
  tags: SimilarDeckTag[]
  disabled: boolean
  onAddTag: (tag: string) => void
}) {
  if (pending || status === "loading") {
    return (
      <p className="mt-1 font-mono text-sm text-white/45">
        Checking public decks…
      </p>
    )
  }
  if (status === "error") {
    return (
      <p className="mt-1 font-mono text-sm text-white/45">
        Could not load similar tags.
      </p>
    )
  }
  if (compared < 3) {
    return (
      <p className="mt-1 font-mono text-sm text-white/45">
        Not enough similar public decks yet.
      </p>
    )
  }
  if (tags.length === 0) {
    return (
      <p className="mt-1 font-mono text-sm text-white/45">
        Similar public decks do not add new tags.
      </p>
    )
  }
  return (
    <div className="mt-2 flex flex-wrap gap-1">
      {tags.map((row) => (
        <button
          key={row.tag}
          type="button"
          disabled={disabled}
          title={`Used on ${row.decks} similar decks`}
          className={
            "border border-cyan-500/40 px-3 py-1.5 font-mono " +
            "text-sm text-cyan-100 hover:border-cyan-300 " +
            "disabled:opacity-50"
          }
          onClick={() => onAddTag(row.tag)}
        >
          {row.tag}
        </button>
      ))}
    </div>
  )
}
