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
}

export type UsePlayContextMenuArgs = {
  ctxMenu: CtxMenuState | null
  sessionCards: PlayingCardInstance[]
  resourceByColor: Map<ResourceColor, CardLibraryItem>
  availableResourceColors: ReadonlySet<ResourceColor>
  /** True while flip-fly or bottom-slide animations block zone moves. */
  animBusy: boolean
  pilotGenBonus: number
  actions: PlayContextMenuActions
}

export function usePlayContextMenu({
  ctxMenu,
  sessionCards,
  resourceByColor,
  availableResourceColors,
  animBusy,
  pilotGenBonus,
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

  const card = sessionCards.find((c) => c.instanceId === ctxMenu.instanceId)
  if (!card || card.zone === PLAY_ZONE.library) return []

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

  const viewCardDetails: DropdownMenuItem = {
    id: CTX_MENU_ACTION.cardDetails,
    label: "Veiw Details",
    onSelect: () => actions.inspectCard(card),
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
