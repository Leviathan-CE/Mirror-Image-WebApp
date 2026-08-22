/**
 * Face-up peek of library cards (Look at top X / Reveal top).
 * When `allowReorder` is set, drag cards to change top-of-deck order; Done commits.
 *
 * Pointer events (not HTML5 drag): the overlay is portalled but still bubbles
 * React events into the playtester surface, which cancels dragstart.
 */

import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react"
import { createPortal } from "react-dom"

import { PlayingCard } from "@/components/Playtester/PlayingCard"
import type { PlayingCardInstance } from "@/components/Playtester/types"
import { useLatestRef } from "@/hooks/useLatestRef"
import { cn } from "@/lib/utils"

const DRAG_THRESHOLD_PX = 5
const GHOST_W = 112
const GHOST_H = 144

export type DeckPeekOverlayProps = {
  open: boolean
  title: string
  cards: PlayingCardInstance[]
  /** When true, player may drag to rearrange; Done returns the new order. */
  allowReorder?: boolean
  onClose: (orderedCards: PlayingCardInstance[]) => void
}

type DragState = {
  pointerId: number
  fromIndex: number
  card: PlayingCardInstance
  startX: number
  startY: number
  moved: boolean
  ghostX: number
  ghostY: number
  overIndex: number
}

function moveIndex<T>(list: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) {
    return list
  }
  const next = [...list]
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item!)
  return next
}

export function DeckPeekOverlay({
  open,
  title,
  cards,
  allowReorder = false,
  onClose,
}: DeckPeekOverlayProps) {
  const [ordered, setOrdered] = useState<PlayingCardInstance[]>(cards)
  const [drag, setDrag] = useState<DragState | null>(null)
  const dragRef = useRef<DragState | null>(null)
  /** Slot elements, keyed by instance id, for pointer hit-testing. */
  const slotRefs = useRef<Map<string, HTMLLIElement>>(new Map())
  const orderedRef = useLatestRef(ordered)

  useEffect(() => {
    if (!open) return
    setOrdered(cards)
    setDrag(null)
    dragRef.current = null
  }, [open, cards])

  useEffect(() => {
    if (!drag) return

    /** Index of the slot under the cursor (falls back to the dragged slot). */
    function slotIndexAt(clientX: number, clientY: number, fallback: number) {
      let found = fallback
      orderedRef.current.forEach((card, index) => {
        const el = slotRefs.current.get(card.instanceId)
        if (!el) return
        const r = el.getBoundingClientRect()
        if (
          clientX >= r.left &&
          clientX <= r.right &&
          clientY >= r.top &&
          clientY <= r.bottom
        ) {
          found = index
        }
      })
      return found
    }

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
        overIndex: slotIndexAt(
          event.clientX,
          event.clientY,
          current.fromIndex
        ),
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
      const to = slotIndexAt(event.clientX, event.clientY, current.overIndex)
      setOrdered((prev) => moveIndex(prev, current.fromIndex, to))
    }

    window.addEventListener("pointermove", onMove)
    window.addEventListener("pointerup", onUp)
    window.addEventListener("pointercancel", onUp)
    return () => {
      window.removeEventListener("pointermove", onMove)
      window.removeEventListener("pointerup", onUp)
      window.removeEventListener("pointercancel", onUp)
    }
  }, [drag])

  if (!open || typeof document === "undefined") return null

  function onSlotPointerDown(
    event: ReactPointerEvent<HTMLLIElement>,
    card: PlayingCardInstance,
    index: number
  ) {
    if (!allowReorder || event.button !== 0) return
    event.preventDefault()
    event.stopPropagation()
    const next: DragState = {
      pointerId: event.pointerId,
      fromIndex: index,
      card,
      startX: event.clientX,
      startY: event.clientY,
      moved: false,
      ghostX: event.clientX,
      ghostY: event.clientY,
      overIndex: index,
    }
    dragRef.current = next
    setDrag(next)
  }

  return createPortal(
    <>
      <div
        className="fixed inset-0 z-[130] flex items-center justify-center bg-black/75 p-4"
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="max-h-[85vh] w-full max-w-3xl overflow-auto border border-cyan-500/35 bg-black/95 p-4 shadow-xl">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-buahs93 text-sm tracking-wide text-cyan-100">
                {title}
              </h2>
              <p className="mt-1 font-mono text-[11px] text-cyan-100/60">
                {allowReorder
                  ? "Drag cards to rearrange. #1 is the top of the deck. Done applies the new order."
                  : "These cards stay in the deck in the same order."}
              </p>
            </div>
            <button
              type="button"
              className="font-buahs93 border border-cyan-500/40 px-3 py-1.5 text-xs text-cyan-100 hover:bg-cyan-500/10"
              onClick={() => onClose(orderedRef.current)}
            >
              Done
            </button>
          </div>
          {ordered.length === 0 ? (
            <p className="mt-6 font-mono text-xs text-white/40">No cards.</p>
          ) : (
            <ul className="mt-4 flex flex-wrap gap-3">
              {ordered.map((card, index) => (
                <li
                  key={card.instanceId}
                  ref={(el) => {
                    if (el) slotRefs.current.set(card.instanceId, el)
                    else slotRefs.current.delete(card.instanceId)
                  }}
                  onPointerDown={(event) =>
                    onSlotPointerDown(event, card, index)
                  }
                  className={cn(
                    "flex flex-col items-center gap-1",
                    allowReorder && "cursor-grab touch-none select-none",
                    drag?.moved &&
                      drag.fromIndex === index &&
                      "cursor-grabbing opacity-30",
                    drag?.moved &&
                      drag.overIndex === index &&
                      drag.fromIndex !== index &&
                      "ring-2 ring-cyan-400/70"
                  )}
                >
                  <span className="font-mono text-[10px] text-cyan-100/50">
                    #{index + 1}
                    {index === 0 ? " · top" : ""}
                  </span>
                  <PlayingCard
                    card={{ ...card, faceDown: false }}
                    className="pointer-events-none h-36 w-28"
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {drag?.moved ? (
        <div
          className="pointer-events-none fixed z-[136] -translate-x-1/2 -translate-y-1/2"
          style={{
            left: drag.ghostX,
            top: drag.ghostY,
            width: GHOST_W,
            height: GHOST_H,
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
