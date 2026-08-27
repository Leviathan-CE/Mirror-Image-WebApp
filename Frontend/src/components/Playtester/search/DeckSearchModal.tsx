/**
 * Searchable floating card browser (library or face-up piles).
 * Drag the header to move, the corner grip to resize; both persist.
 * Copies of the same printing share one tile (×N badge). Backdrop is
 * pointer-events-none so cards can be dragged onto play zones.
 *
 * Library mode: drag pulls the topmost copy of a printing.
 * Pile mode: Ctrl/Cmd+click cycles ×N selection; drag moves the selection.
 */

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from "react"
import { createPortal } from "react-dom"

import { CardEnlargeOverlay } from "@/components/Playtester/board/CardLargeOverlay"
import { PlayingCard } from "@/components/Playtester/board/PlayingCard"
import {
  filterLibraryByName,
  groupCardsByPrinting,
  type CardPrintingGroup,
} from "@/components/Playtester/search/deckActions.logic"
import {
  clampDeckSearchBox,
  currentViewport,
  defaultDeckSearchBox,
  readStoredDeckSearchBox,
  readStoredFaceUpPileBrowserBox,
  writeStoredDeckSearchBox,
  writeStoredFaceUpPileBrowserBox,
  type DeckSearchBox,
} from "@/components/Playtester/search/deckSearchPanel.logic"
import { selectionOverlayClass } from "@/components/Playtester/board/selectionChrome"
import {
  cycleGroupSelection,
  selectSingleFromGroup,
  selectedCountInGroup,
  trashDragGroupIds,
} from "@/components/Playtester/drag/trashyardSelect.logic"
import type { PlayingCardInstance } from "@/components/Playtester/types"
import { LOCAL_SEAT, type PlayerSlot } from "@/components/Playtester/constants"
import { MiddleMouseScroll } from "@/components/ui/MiddleMouseScroll"
import { useLatestRef } from "@/hooks/useLatestRef"
import { cardArtUrl } from "@/lib/api/decks"
import { cn } from "@/lib/utils"

const CARD_W = 72
const CARD_H = 96
const DRAG_THRESHOLD_PX = 5

export type DeckSearchModalProps = {
  open: boolean
  /**
   * `library` — filter owner's library (shuffle-on-close stays in the page).
   * `pile` — browse an explicit face-up list (trash / dismantled / opp).
   */
  mode?: "library" | "pile"
  title?: string
  /** Library mode: full session; pile mode unused. */
  sessionCards?: PlayingCardInstance[]
  owner?: PlayerSlot
  /** Pile mode: cards to browse (newest-on-top order preferred). */
  cards?: PlayingCardInstance[]
  /** Pile mode: Ctrl-cycle multi-select. Library always single-top. */
  multiSelect?: boolean
  /** When false, tiles cannot be dragged out (e.g. opponent piles). */
  canDragOut?: boolean
  dismissLabel?: string
  /** Exposes the panel root for drop hit-testing while search is open. */
  panelRef?: RefObject<HTMLDivElement | null>
  onCancel: () => void
  /** Drop one or more cards onto a zone under the floating panel. */
  onCardRelease: (
    instanceIds: string[],
    clientX: number,
    clientY: number
  ) => void
  onCardContextMenu?: (
    instanceId: string,
    clientX: number,
    clientY: number
  ) => void
}

type BoxDragState = {
  pointerId: number
  startX: number
  startY: number
  startBox: DeckSearchBox
}

type DragState = {
  pointerId: number
  instanceId: string
  groupIds: string[]
  startX: number
  startY: number
  moved: boolean
  ghostX: number
  ghostY: number
  card: PlayingCardInstance
}

function filterCardsByName(
  cards: PlayingCardInstance[],
  query: string
): PlayingCardInstance[] {
  const q = query.trim().toLowerCase()
  if (!q) return cards
  return cards.filter((c) => c.name.toLowerCase().includes(q))
}

export function DeckSearchModal({
  open,
  mode = "library",
  title = mode === "pile" ? "Pile" : "Deck",
  sessionCards = [],
  owner = LOCAL_SEAT,
  cards = [],
  multiSelect = mode === "pile",
  canDragOut = true,
  dismissLabel = mode === "pile" ? "Close" : "Cancel",
  panelRef,
  onCancel,
  onCardRelease,
  onCardContextMenu,
}: DeckSearchModalProps) {
  const isPile = mode === "pile"
  const [query, setQuery] = useState("")
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const selectedIdsRef = useLatestRef(selectedIds)
  const [drag, setDrag] = useState<DragState | null>(null)
  const dragRef = useRef<DragState | null>(null)
  const [enlarged, setEnlarged] = useState<PlayingCardInstance | null>(null)
  const [box, setBox] = useState<DeckSearchBox>(() =>
    isPile
      ? readStoredFaceUpPileBrowserBox(currentViewport())
      : readStoredDeckSearchBox(currentViewport())
  )
  const resizeRef = useRef<BoxDragState | null>(null)
  const moveRef = useRef<BoxDragState | null>(null)

  const visible = useMemo(() => {
    if (isPile) {
      // Newest on top of the pile should lead grouping (display = topmost copy).
      return filterCardsByName([...cards].reverse(), query)
    }
    return filterLibraryByName(sessionCards, query, owner)
  }, [isPile, cards, sessionCards, query, owner])

  const groups = useMemo(() => groupCardsByPrinting(visible), [visible])

  useEffect(() => {
    if (!open) {
      setQuery("")
      setDrag(null)
      dragRef.current = null
      setEnlarged(null)
      setSelectedIds([])
    }
  }, [open])

  useEffect(() => {
    if (isPile) writeStoredFaceUpPileBrowserBox(box)
    else writeStoredDeckSearchBox(box)
  }, [box, isPile])

  useEffect(() => {
    function onResize() {
      setBox((prev) => clampDeckSearchBox(prev, currentViewport()))
    }
    window.addEventListener("resize", onResize)
    return () => window.removeEventListener("resize", onResize)
  }, [])

  useEffect(() => {
    if (!enlarged) return
    function release() {
      setEnlarged(null)
    }
    window.addEventListener("pointerup", release)
    window.addEventListener("blur", release)
    return () => {
      window.removeEventListener("pointerup", release)
      window.removeEventListener("blur", release)
    }
  }, [enlarged])

  useEffect(() => {
    if (!open) return
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return
      if (document.querySelector('.deck-card-enlarge[aria-modal="true"]')) {
        return
      }
      onCancel()
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [open, onCancel])

  useEffect(() => {
    if (!drag) return

    function onMove(event: PointerEvent) {
      const current = dragRef.current
      if (!current || current.pointerId !== event.pointerId) return
      const dist = Math.hypot(
        event.clientX - current.startX,
        event.clientY - current.startY
      )
      if (dist <= DRAG_THRESHOLD_PX && !current.moved) return
      const next: DragState = {
        ...current,
        moved: true,
        ghostX: event.clientX,
        ghostY: event.clientY,
      }
      dragRef.current = next
      setDrag(next)
    }

    function onUp(event: PointerEvent) {
      const current = dragRef.current
      if (!current || current.pointerId !== event.pointerId) return
      dragRef.current = null
      setDrag(null)
      if (!current.moved) return
      onCardRelease(current.groupIds, event.clientX, event.clientY)
      setSelectedIds([])
    }

    window.addEventListener("pointermove", onMove)
    window.addEventListener("pointerup", onUp)
    window.addEventListener("pointercancel", onUp)
    return () => {
      window.removeEventListener("pointermove", onMove)
      window.removeEventListener("pointerup", onUp)
      window.removeEventListener("pointercancel", onUp)
    }
  }, [drag, onCardRelease])

  if (!open || typeof document === "undefined") return null

  function groupForSelect(group: CardPrintingGroup) {
    // Selection helpers expect oldest→newest; pile display list is newest-first.
    const instances = isPile
      ? [...group.instances].reverse()
      : group.instances
    return { cardId: group.cardId, instances }
  }

  function onCardPointerDown(
    event: ReactPointerEvent<HTMLDivElement>,
    group: CardPrintingGroup
  ) {
    if (event.button === 1) {
      event.preventDefault()
      event.stopPropagation()
      setEnlarged(group.display)
      return
    }
    if (event.button !== 0) return
    event.preventDefault()
    event.stopPropagation()

    const card = group.display

    if (multiSelect && (event.ctrlKey || event.metaKey)) {
      setSelectedIds((prev) => cycleGroupSelection(groupForSelect(group), prev))
      return
    }

    if (!canDragOut) return

    const topId = card.instanceId
    let groupIds: string[]

    if (multiSelect) {
      const currentSel = selectedIdsRef.current
      groupIds = trashDragGroupIds(topId, currentSel)
      if (!currentSel.includes(topId)) {
        setSelectedIds(selectSingleFromGroup(groupForSelect(group)))
      }
    } else {
      groupIds = [topId]
    }

    const next: DragState = {
      pointerId: event.pointerId,
      instanceId: topId,
      groupIds,
      startX: event.clientX,
      startY: event.clientY,
      moved: false,
      ghostX: event.clientX,
      ghostY: event.clientY,
      card,
    }
    dragRef.current = next
    setDrag(next)
  }

  function beginBoxDrag(
    event: ReactPointerEvent<HTMLDivElement>,
    into: RefObject<BoxDragState | null>
  ) {
    if (event.button !== 0) return
    event.preventDefault()
    event.stopPropagation()
    into.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startBox: box,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function endBoxDrag(
    event: ReactPointerEvent<HTMLDivElement>,
    from: RefObject<BoxDragState | null>
  ) {
    const gesture = from.current
    if (!gesture || gesture.pointerId !== event.pointerId) return
    from.current = null
    try {
      event.currentTarget.releasePointerCapture(event.pointerId)
    } catch {
      /* already released */
    }
  }

  return createPortal(
    <>
      <div className="pointer-events-none fixed inset-0 z-[125]">
        <div
          ref={panelRef}
          className={cn(
            "pointer-events-auto absolute",
            "border border-cyan-500/40 bg-black/95 shadow-xl"
          )}
          style={{ left: box.x, top: box.y, width: box.width }}
          role="dialog"
          aria-modal="false"
          aria-label={`Search ${title.toLowerCase()}`}
        >
          <div
            className="flex cursor-move items-center gap-2 border-b border-cyan-500/30 p-2 touch-none"
            title="Drag to move · double-click to recentre"
            onPointerDown={(event) => {
              if (
                event.target instanceof Element &&
                event.target.closest("button, input")
              ) {
                return
              }
              beginBoxDrag(event, moveRef)
            }}
            onPointerMove={(event) => {
              const move = moveRef.current
              if (!move || move.pointerId !== event.pointerId) return
              setBox(
                clampDeckSearchBox(
                  {
                    ...move.startBox,
                    x: move.startBox.x + (event.clientX - move.startX),
                    y: move.startBox.y + (event.clientY - move.startY),
                  },
                  currentViewport()
                )
              )
            }}
            onPointerUp={(event) => endBoxDrag(event, moveRef)}
            onPointerCancel={(event) => endBoxDrag(event, moveRef)}
            onDoubleClick={() =>
              setBox(defaultDeckSearchBox(currentViewport()))
            }
          >
            <button
              type="button"
              className="font-buahs93 shrink-0 border border-cyan-500/40 px-2 py-1 text-[10px] text-cyan-100 hover:bg-cyan-500/10"
              onClick={onCancel}
            >
              {dismissLabel}
            </button>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={`Search ${title.toLowerCase()}…`}
              autoFocus
              className="min-w-0 flex-1 border border-cyan-500/35 bg-black/80 px-2 py-1 font-mono text-xs text-cyan-50 outline-none placeholder:text-cyan-100/35 focus:border-cyan-300"
            />
            <span className="shrink-0 font-mono text-[10px] text-cyan-100/50">
              {visible.length}
            </span>
          </div>

          <MiddleMouseScroll
            label={`${title} results`}
            horizontal={false}
            vertical
            style={{ height: box.height }}
            viewportClassName="grid grid-cols-[repeat(auto-fill,minmax(4.5rem,1fr))] content-start gap-2 p-2 pr-3.5"
          >
            {groups.length === 0 ? (
              <p className="col-span-full py-8 text-center font-mono text-[11px] text-white/40">
                No matching cards.
              </p>
            ) : (
              groups.map((group) => {
                const card = group.display
                const copies = group.instances.length
                const picked = multiSelect
                  ? selectedCountInGroup(groupForSelect(group), selectedIds)
                  : 0
                const isSelected = multiSelect && picked > 0
                return (
                  <div
                    key={group.cardId}
                    role="button"
                    tabIndex={0}
                    aria-label={
                      copies > 1
                        ? `Drag ${card.name}, ${copies} copies`
                        : `Drag ${card.name}`
                    }
                    onPointerDown={(event) => onCardPointerDown(event, group)}
                    onContextMenu={(event) => {
                      event.preventDefault()
                      event.stopPropagation()
                      onCardContextMenu?.(
                        card.instanceId,
                        event.clientX,
                        event.clientY
                      )
                    }}
                    className={cn(
                      "relative flex flex-col items-center touch-none select-none",
                      canDragOut ? "cursor-grab" : "cursor-default",
                      drag?.instanceId === card.instanceId &&
                        drag.moved &&
                        "opacity-30"
                    )}
                  >
                    <div className="relative">
                      <PlayingCard
                        card={{ ...card, faceDown: false }}
                        className="h-24 w-[4.5rem]"
                      />
                      {isSelected ? (
                        <span
                          aria-hidden
                          className={selectionOverlayClass()}
                        />
                      ) : null}
                      {copies > 1 ? (
                        <span
                          className={cn(
                            "pointer-events-none absolute top-1 right-1 z-30",
                            "border border-cyan-400/50 bg-black/80 px-1 py-0.5",
                            "font-mono text-[10px] text-cyan-100"
                          )}
                        >
                          {picked > 0 ? `${picked}/` : ""}×{copies}
                        </span>
                      ) : null}
                    </div>
                    <span className="w-full truncate text-center font-mono text-[9px] leading-tight text-cyan-100/70">
                      {card.name}
                    </span>
                  </div>
                )
              })
            )}
          </MiddleMouseScroll>

          <div
            role="button"
            tabIndex={-1}
            aria-label={`Resize ${title}`}
            title="Drag to resize · double-click to reset"
            className="absolute bottom-0 right-0 z-20 h-4 w-4 cursor-nwse-resize touch-none"
            onPointerDown={(event) => beginBoxDrag(event, resizeRef)}
            onPointerMove={(event) => {
              const resize = resizeRef.current
              if (!resize || resize.pointerId !== event.pointerId) return
              setBox(
                clampDeckSearchBox(
                  {
                    ...resize.startBox,
                    width:
                      resize.startBox.width + (event.clientX - resize.startX),
                    height:
                      resize.startBox.height + (event.clientY - resize.startY),
                  },
                  currentViewport()
                )
              )
            }}
            onPointerUp={(event) => endBoxDrag(event, resizeRef)}
            onPointerCancel={(event) => endBoxDrag(event, resizeRef)}
            onDoubleClick={() =>
              setBox(defaultDeckSearchBox(currentViewport()))
            }
          >
            <div
              className="absolute right-1 bottom-1 h-2 w-2 border-r-2 border-b-2 border-cyan-400/70"
              aria-hidden
            />
          </div>
        </div>
      </div>

      {drag?.moved ? (
        <div
          className="pointer-events-none fixed z-[135] -translate-x-1/2 -translate-y-1/2"
          style={{
            left: drag.ghostX,
            top: drag.ghostY,
            width: CARD_W,
            height: CARD_H,
          }}
        >
          <PlayingCard
            card={{ ...drag.card, faceDown: false }}
            className="h-full w-full shadow-lg shadow-cyan-500/25"
          />
          {drag.groupIds.length > 1 ? (
            <span className="absolute -top-1 -right-1 border border-cyan-400/50 bg-black/85 px-1 font-mono text-[10px] text-cyan-100">
              ×{drag.groupIds.length}
            </span>
          ) : null}
        </div>
      ) : null}

      <CardEnlargeOverlay
        open={enlarged != null}
        name={enlarged?.name ?? ""}
        artSrc={
          enlarged?.isClassified
            ? null
            : enlarged
              ? cardArtUrl(enlarged.artPath, enlarged.artVersion)
              : null
        }
        classification={
          enlarged?.classification ??
          (enlarged?.isClassified ? "classified" : null)
        }
      />
    </>,
    document.body
  )
}
