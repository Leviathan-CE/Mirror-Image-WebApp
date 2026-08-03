/**
 * Builds playtester context-menu items from the open menu target.
 * Mutations stay in the page via `actions` — this hook only assembles the menu.
 */

import { GameIcon } from "@/components/common/GameIcon"
import type { GameIconName } from "@/components/common/GameIcon"
import {
  extractGainablePips,
  RESOURCE_COLORS,
  type ResourceColor,
} from "@/components/Playtester/accumulateResources.logic"
import {
  CTX_MENU_ACTION,
  PILOT_GEN_MAX,
  PLAY_ZONE,
  SELECTABLE_ACTION_ZONES,
} from "@/components/Playtester/playtesterConstants"
import {
  selectableActionTargets,
  cardsInZone,
  type PlayingCardInstance,
} from "@/components/Playtester/types"
import type { DropdownMenuItem } from "@/components/ui/DropdownMenu"
import type { CardLibraryItem } from "@/lib/api/cards"

/** Cost colour → GameIcon asset name. */
export const RESOURCE_COLOR_ICON: Record<ResourceColor, GameIconName> = {
  LIF: "life",
  MET: "metal",
  POW: "power",
  RAM: "ram",
  TIM: "time",
  STL: "steel",
}

/** Map a pilot +GEN bonus (1–10) to a cost icon. */
export function genIconForCount(n: number): GameIconName {
  if (n <= 0) return "gen0"
  if (n >= 10) return "gen10"
  return `gen${n}` as GameIconName
}

export type CtxMenuState =
  | { kind: "card"; instanceId: string; x: number; y: number }
  | {
      kind: "zone"
      zone: (typeof SELECTABLE_ACTION_ZONES)[number]
      x: number
      y: number
    }
  | { kind: "deck"; x: number; y: number }

export type PlayContextMenuActions = {
  spawnResourceColor: (color: ResourceColor) => void
  putOnLibraryBottom: (instanceIds: string[]) => void
  setFaceDown: (instanceIds: string[], faceDown: boolean) => void
  deleteSessionCards: (instanceIds: string[]) => void
  startAccumulate: (instanceId: string) => void
  adjustCounter: (
    instanceId: string,
    kind: "time" | "damage" | "tlv",
    delta: number
  ) => void
  duplicateCard: (instanceId: string) => void
  inspectCard: (card: PlayingCardInstance) => void
  adjustPilotGenBonus: (delta: number) => void
  /** Deck pile actions */
  degradeDeck: (count: number) => void
  lookAtDeckTop: (count: number) => void
  putDeckTopOnBottom: (count: number) => void
  shuffleDeck: () => void
  /** Play with the deck's top card face up on the pile (flip in place). */
  toggleDeckTopRevealed: () => void
  openDeckSearch: () => void
}

/** Deck rows that carry their own count field. */
export type DeckCountKey = "degrade" | "lookTop" | "putBottom"

export type DeckActionCounts = Record<DeckCountKey, string>

export type UsePlayContextMenuArgs = {
  ctxMenu: CtxMenuState | null
  sessionCards: PlayingCardInstance[]
  resourceByColor: Map<ResourceColor, CardLibraryItem>
  availableResourceColors: ReadonlySet<ResourceColor>
  /** True while flip-fly or bottom-slide animations block zone moves. */
  animBusy: boolean
  pilotGenBonus: number
  /** One count per deck row, so each field edits independently. */
  deckActionCounts: DeckActionCounts
  setDeckActionCount: (key: DeckCountKey, value: string) => void
  /** True while the deck's top card is shown face up. */
  topRevealed: boolean
  actions: PlayContextMenuActions
}

export function usePlayContextMenu({
  ctxMenu,
  sessionCards,
  resourceByColor,
  availableResourceColors,
  animBusy,
  pilotGenBonus,
  deckActionCounts,
  setDeckActionCount,
  topRevealed,
  actions,
}: UsePlayContextMenuArgs): DropdownMenuItem[] {
  if (!ctxMenu) return []

  const generateResourceItem: DropdownMenuItem = {
    id: CTX_MENU_ACTION.generateResource,
    label: "Generate resource",
    disabled: availableResourceColors.size === 0,
    submenu: RESOURCE_COLORS.map((color) => ({
      id: `gen-resource-${color}`,
      label: (
        <>
          <GameIcon
            name={RESOURCE_COLOR_ICON[color]}
            className="h-4 w-auto"
          />
          {color}
        </>
      ),
      disabled: !resourceByColor.has(color),
      onSelect: () => actions.spawnResourceColor(color),
    })),
  }

  if (ctxMenu.kind === "zone") {
    return [generateResourceItem]
  }

  if (ctxMenu.kind === "deck") {
    const librarySize = cardsInZone(sessionCards, PLAY_ZONE.library).length
    const empty = librarySize === 0

    function countFor(key: DeckCountKey) {
      const parsed = Number.parseInt(deckActionCounts[key], 10)
      return {
        parsed,
        ok: Number.isFinite(parsed) && parsed > 0 && parsed <= librarySize,
        field: {
          value: deckActionCounts[key],
          onChange: (value: string) => setDeckActionCount(key, value),
          min: 1,
          max: Math.max(1, librarySize),
        },
      }
    }

    const degrade = countFor("degrade")
    const lookTop = countFor("lookTop")
    const putBottom = countFor("putBottom")

    return [
      {
        id: CTX_MENU_ACTION.deckDegrade,
        label: "Degrade",
        disabled: empty || animBusy || !degrade.ok,
        countInput: { ...degrade.field, ariaLabel: "Degrade count" },
        onSelect: () => actions.degradeDeck(degrade.parsed),
      },
      {
        id: CTX_MENU_ACTION.deckLookTop,
        label: "Look at top",
        disabled: empty || animBusy || !lookTop.ok,
        countInput: { ...lookTop.field, ariaLabel: "Look at top count" },
        onSelect: () => actions.lookAtDeckTop(lookTop.parsed),
      },
      {
        id: CTX_MENU_ACTION.deckPutTopBottom,
        label: "Put top on bottom",
        disabled: empty || animBusy || !putBottom.ok,
        countInput: { ...putBottom.field, ariaLabel: "Put on bottom count" },
        onSelect: () => actions.putDeckTopOnBottom(putBottom.parsed),
      },
      {
        id: CTX_MENU_ACTION.deckShuffle,
        label: "Shuffle",
        disabled: empty || animBusy,
        onSelect: () => actions.shuffleDeck(),
      },
      {
        id: CTX_MENU_ACTION.deckRevealTop,
        label: topRevealed ? "Hide top card" : "Reveal top card",
        disabled: empty || animBusy,
        onSelect: () => actions.toggleDeckTopRevealed(),
      },
      {
        id: CTX_MENU_ACTION.deckSearch,
        label: "Search deck…",
        disabled: empty || animBusy,
        onSelect: () => actions.openDeckSearch(),
      },
    ]
  }

  const card = sessionCards.find((c) => c.instanceId === ctxMenu.instanceId)
  if (!card) return []

  const viewCardDetails: DropdownMenuItem = {
    id: CTX_MENU_ACTION.cardDetails,
    label: "View details",
    onSelect: () => actions.inspectCard(card),
  }

  // Cards still in the deck are only reachable from deck search / peek, where
  // zone actions do not apply — inspecting them is all that makes sense.
  if (card.zone === PLAY_ZONE.library) return [viewCardDetails]

  const putBottomTargets = selectableActionTargets(sessionCards, card)
  const putOnBottomItem: DropdownMenuItem = {
    id: CTX_MENU_ACTION.putBottom,
    label:
      putBottomTargets.length > 1
        ? `Put on bottom (${putBottomTargets.length})`
        : "Put on bottom",
    disabled: animBusy,
    onSelect: () => actions.putOnLibraryBottom(putBottomTargets),
  }

  const flipTargets = selectableActionTargets(sessionCards, card)
  const nextFaceDown = !card.faceDown
  const flipFaceItem: DropdownMenuItem = {
    id: CTX_MENU_ACTION.flipFace,
    label: (() => {
      const verb = nextFaceDown ? "Flip face down" : "Flip face up"
      return flipTargets.length > 1
        ? `${verb} (${flipTargets.length})`
        : verb
    })(),
    onSelect: () => actions.setFaceDown(flipTargets, nextFaceDown),
  }

  const deleteTargets = selectableActionTargets(sessionCards, card)
  const deleteItem: DropdownMenuItem = {
    id: CTX_MENU_ACTION.deleteCard,
    label:
      deleteTargets.length > 1
        ? `Delete (${deleteTargets.length})`
        : "Delete",
    tone: "danger",
    onSelect: () => actions.deleteSessionCards(deleteTargets),
  }

  if (card.zone === PLAY_ZONE.hand) {
    const pips = extractGainablePips(card.cost)
    const hasCatalog = pips.some((pip) => {
      if (pip.kind === "solid") return resourceByColor.has(pip.color)
      if (pip.kind === "hybrid") {
        return pip.colors.some((c) => resourceByColor.has(c))
      }
      return availableResourceColors.size > 0
    })
    let label = "Accumulate Resources"
    if (animBusy) label = "Accumulate Resources (busy)"
    else if (pips.length === 0) label = "Accumulate Resources (no colour pips)"
    else if (!hasCatalog) {
      label = "Accumulate Resources (no token cards loaded)"
    }
    return [
      {
        id: CTX_MENU_ACTION.accumulate,
        label,
        disabled: animBusy || pips.length === 0 || !hasCatalog,
        onSelect: () => actions.startAccumulate(card.instanceId),
      },
      generateResourceItem,
      putOnBottomItem,
      flipFaceItem,
      viewCardDetails,
      deleteItem,
    ]
  }

  if (
    card.zone === PLAY_ZONE.battlefield ||
    card.zone === PLAY_ZONE.stockpile
  ) {
    return [
      {
        id: CTX_MENU_ACTION.addTime,
        label: (
          <>
            Add{" "}
            <span
              aria-hidden
              className="inline-flex min-h-6 min-w-6 items-center justify-center border border-emerald-400/70 bg-emerald-950/90 px-1 font-glitch text-sm leading-none text-emerald-200"
            >
              1
            </span>{" "}
            time counter
          </>
        ),
        onSelect: () => actions.adjustCounter(card.instanceId, "time", 1),
      },
      {
        id: CTX_MENU_ACTION.addDamage,
        label: (
          <>
            Add{" "}
            <span
              aria-hidden
              className="inline-flex min-h-6 min-w-6 items-center justify-center border border-red-400/70 bg-red-950/90 px-1 font-glitch text-sm leading-none text-red-200"
            >
              1
            </span>{" "}
            damage counter
          </>
        ),
        onSelect: () => actions.adjustCounter(card.instanceId, "damage", 1),
      },
      {
        id: CTX_MENU_ACTION.addTlv,
        label: (
          <>
            Add <GameIcon name="threat_lvl" className="h-4 w-auto" /> counter
          </>
        ),
        onSelect: () => actions.adjustCounter(card.instanceId, "tlv", 1),
      },
      {
        id: CTX_MENU_ACTION.createCopy,
        label: "Create copy",
        onSelect: () => actions.duplicateCard(card.instanceId),
      },
      generateResourceItem,
      putOnBottomItem,
      flipFaceItem,
      viewCardDetails,
      deleteItem,
    ]
  }

  if (
    card.zone === PLAY_ZONE.trashyard ||
    card.zone === PLAY_ZONE.dismantled
  ) {
    return [putOnBottomItem, viewCardDetails]
  }

  if (card.zone === PLAY_ZONE.pilot) {
    return [
      {
        id: CTX_MENU_ACTION.addPilotGen,
        label: (
          <span className="inline-flex items-center gap-1.5">
            Add +
            <GameIcon
              name={genIconForCount(
                Math.min(PILOT_GEN_MAX, pilotGenBonus + 1)
              )}
              className="h-4 w-auto lg:h-4 2xl:h-4"
            />
            {pilotGenBonus > 0 ? ` (${pilotGenBonus}/${PILOT_GEN_MAX})` : ""}
          </span>
        ),
        disabled: pilotGenBonus >= PILOT_GEN_MAX,
        onSelect: () => actions.adjustPilotGenBonus(1),
      },
      {
        id: CTX_MENU_ACTION.removePilotGen,
        label: (
          <span className="inline-flex items-center gap-1.5">
            Remove +
            <GameIcon
              name={genIconForCount(Math.max(1, pilotGenBonus))}
              className="h-4 w-auto lg:h-4 2xl:h-4"
            />
          </span>
        ),
        disabled: pilotGenBonus <= 0,
        onSelect: () => actions.adjustPilotGenBonus(-1),
      },
      putOnBottomItem,
      flipFaceItem,
      viewCardDetails,
    ]
  }

  return [putOnBottomItem, flipFaceItem, viewCardDetails]
}
