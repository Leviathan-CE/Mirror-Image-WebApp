/**
 * Search library: free-floating panel with a filter + scrolling card grid.
 * Drag the header to move, the corner grip to resize; both persist.
 * Copies of the same printing share one tile (×N badge); dragging a tile pulls
 * its topmost copy. Backdrop is pointer-events-none so cards can be dragged
 * onto play zones.
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

import { PlayingCard } from "@/components/Playtester/PlayingCard"
import {
  filterLibraryByName,
  groupCardsByPrinting,
} from "@/components/Playtester/deckActions.logic"
import {
  clampDeckSearchBox,
  currentViewport,
  defaultDeckSearchBox,
  readStoredDeckSearchBox,
  writeStoredDeckSearchBox,
  type DeckSearchBox,
} from "@/components/Playtester/deckSearchPanel.logic"
import type { PlayingCardInstance } from "@/components/Playtester/types"
import { MiddleMouseScroll } from "@/components/ui/MiddleMouseScroll"
import { cn } from "@/lib/utils"

const CARD_W = 72
const CARD_H = 96
const DRAG_THRESHOLD_PX = 5

export type DeckSearchModalProps = {
  open: boolean
  sessionCards: PlayingCardInstance[]
  onCancel: () => void
  /** Drop a library card onto a zone under the floating panel. */
  onCardRelease: (
    instanceId: string,
    clientX: number,
    clientY: number
  ) => void
  /** Right-click a tile (view details). */
  onCardContextMenu?: (
    instanceId: string,
    clientX: number,
    clientY: number
  ) => void
}

/** Header drag (move) and corner drag (resize) share this gesture shape. */
type BoxDragState = {
  pointerId: number
  startX: number
  startY: number
  startBox: DeckSearchBox
}

type DragState = {
  pointerId: number
  instanceId: string
  startX: number
  startY: number
  moved: boolean
  ghostX: number
  ghostY: number
  card: PlayingCardInstance
}

export function DeckSearchModal({
  open,
  sessionCards,
  onCancel,
  onCardRelease,
  onCardContextMenu,
}: DeckSearchModalProps) {
  const [query, setQuery] = useState("")
  const [drag, setDrag] = useState<DragState | null>(null)
  const dragRef = useRef<DragState | null>(null)
  /** Position + size survive closing the panel and reloads. */
  const [box, setBox] = useState<DeckSearchBox>(() =>
    readStoredDeckSearchBox(currentViewport())
  )
  const resizeRef = useRef<BoxDragState | null>(null)
  const moveRef = useRef<BoxDragState | null>(null)

  const visible = useMemo(
    () => filterLibraryByName(sessionCards, query),
    [sessionCards, query]
  )
  /** One tile per printing; copies show as ×N instead of repeating tiles. */
  const groups = useMemo(() => groupCardsByPrinting(visible), [visible])

  useEffect(() => {
    if (!open) {
      setQuery("")
      setDrag(null)
      dragRef.current = null
    }
  }, [open])

  useEffect(() => {
    writeStoredDeckSearchBox(box)
  }, [box])

  useEffect(() => {
    function onResize() {
      setBox((prev) => clampDeckSearchBox(prev, currentViewport()))
    }
    window.addEventListener("resize", onResize)
    return () => window.removeEventListener("resize", onResize)
  }, [])

  useEffect(() => {
    if (!open) return
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onCancel()
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
      onCardRelease(current.instanceId, event.clientX, event.clientY)
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

  function onCardPointerDown(
    event: ReactPointerEvent<HTMLDivElement>,
    card: PlayingCardInstance
  ) {
    if (event.button !== 0) return
    event.preventDefault()
    event.stopPropagation()
    const next: DragState = {
      pointerId: event.pointerId,
      instanceId: card.instanceId,
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

  function onResizePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    beginBoxDrag(event, resizeRef)
  }

  function onResizePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const resize = resizeRef.current
    if (!resize || resize.pointerId !== event.pointerId) return
    setBox(
      clampDeckSearchBox(
        {
          ...resize.startBox,
          width: resize.startBox.width + (event.clientX - resize.startX),
          height: resize.startBox.height + (event.clientY - resize.startY),
        },
        currentViewport()
      )
    )
  }

  function onHeaderPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    // Cancel button / search field keep their own pointer behaviour.
    if (
      event.target instanceof Element &&
      event.target.closest("button, input")
    ) {
      return
    }
    beginBoxDrag(event, moveRef)
  }

  function onHeaderPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
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
  }

  return createPortal(
    <>
      {/* Non-blocking layer so zones remain drop targets. */}
      <div className="pointer-events-none fixed inset-0 z-[125]">
        <div
          className={cn(
            "pointer-events-auto absolute",
            "border border-cyan-500/40 bg-black/95 shadow-xl"
          )}
          style={{ left: box.x, top: box.y, width: box.width }}
          role="dialog"
          aria-modal="false"
          aria-label="Search deck"
        >
          <div
            className="flex cursor-move items-center gap-2 border-b border-cyan-500/30 p-2 touch-none"
            title="Drag to move · double-click to recentre"
            onPointerDown={onHeaderPointerDown}
            onPointerMove={onHeaderPointerMove}
            onPointerUp={(event) => endBoxDrag(event, moveRef)}
            onPointerCancel={(event) => endBoxDrag(event, moveRef)}
            onDoubleClick={() => setBox(defaultDeckSearchBox(currentViewport()))}
          >
            <button
              type="button"
              className="font-buahs93 shrink-0 border border-cyan-500/40 px-2 py-1 text-[10px] text-cyan-100 hover:bg-cyan-500/10"
              onClick={onCancel}
            >
              Cancel
            </button>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search deck…"
              autoFocus
              className="min-w-0 flex-1 border border-cyan-500/35 bg-black/80 px-2 py-1 font-mono text-xs text-cyan-50 outline-none placeholder:text-cyan-100/35 focus:border-cyan-300"
            />
            <span className="shrink-0 font-mono text-[10px] text-cyan-100/50">
              {visible.length}
            </span>
          </div>

          <MiddleMouseScroll
            label="Deck search results"
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
                return (
                  <div
                    key={group.cardId}
                    role="button"
                    tabIndex={0}
                    aria-label={
                      copies > 1
                        ? `Drag ${card.name}, ${copies} copies in deck`
                        : `Drag ${card.name}`
                    }
                    onPointerDown={(event) => onCardPointerDown(event, card)}
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
                      "relative flex cursor-grab flex-col items-center touch-none select-none",
                      drag?.instanceId === card.instanceId &&
                        drag.moved &&
                        "opacity-30"
                    )}
                  >
                    <PlayingCard
                      card={{ ...card, faceDown: false }}
                      className="h-24 w-[4.5rem]"
                    />
                    {copies > 1 ? (
                      <span
                        className={cn(
                          "pointer-events-none absolute top-1 right-1 z-10",
                          "border border-cyan-400/50 bg-black/80 px-1 py-0.5",
                          "font-mono text-[10px] text-cyan-100"
                        )}
                      >
                        ×{copies}
                      </span>
                    ) : null}
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
            aria-label="Resize deck search"
            title="Drag to resize · double-click to reset"
            className="absolute bottom-0 right-0 z-20 h-4 w-4 cursor-nwse-resize touch-none"
            onPointerDown={onResizePointerDown}
            onPointerMove={onResizePointerMove}
            onPointerUp={(event) => endBoxDrag(event, resizeRef)}
            onPointerCancel={(event) => endBoxDrag(event, resizeRef)}
            onDoubleClick={() => setBox(defaultDeckSearchBox(currentViewport()))}
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
        </div>
      ) : null}
    </>,
    document.body
  )
}
