/**
 * Face-up peek of library cards (Look at top X / Reveal top).
 * When `allowReorder` is set, drag cards to change top-of-deck order; Done commits.
 * Cards can also be dragged into a discard pile — on Done those mill to trash
 * (deck → trash flip-fly) after the keepers become the new top.
 *
 * Pointer events (not HTML5 drag): the overlay is portaled but still bubbles
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

export type DeckPeekCloseResult = {
  remaining: PlayingCardInstance[]
  discarded: PlayingCardInstance[]
}

export type DeckPeekOverlayProps = {
  open: boolean
  title: string
  cards: PlayingCardInstance[]
  /** When true, player may drag to rearrange / discard; Done commits. */
  allowReorder?: boolean
  onClose: (result: DeckPeekCloseResult) => void
}

type DragSource = "ordered" | "discard"

type DragState = {
  pointerId: number
  source: DragSource
  fromIndex: number
  card: PlayingCardInstance
  startX: number
  startY: number
  moved: boolean
  ghostX: number
  ghostY: number
  /** Slot under cursor when source is ordered, or insert index when restoring. */
  overIndex: number
  overDiscard: boolean
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

function pointInRect(
  clientX: number,
  clientY: number,
  el: HTMLElement | null
): boolean {
  if (!el) return false
  const r = el.getBoundingClientRect()
  return (
    clientX >= r.left &&
    clientX <= r.right &&
    clientY >= r.top &&
    clientY <= r.bottom
  )
}

export function DeckPeekOverlay({
  open,
  title,
  cards,
  allowReorder = false,
  onClose,
}: DeckPeekOverlayProps) {
  const [ordered, setOrdered] = useState<PlayingCardInstance[]>(cards)
  const [discarded, setDiscarded] = useState<PlayingCardInstance[]>([])
  const [drag, setDrag] = useState<DragState | null>(null)
  const dragRef = useRef<DragState | null>(null)
  /** Slot elements, keyed by instance id, for pointer hit-testing. */
  const slotRefs = useRef<Map<string, HTMLLIElement>>(new Map())
  const discardZoneRef = useRef<HTMLDivElement | null>(null)
  const orderedRef = useLatestRef(ordered)
  const discardedRef = useLatestRef(discarded)

  useEffect(() => {
    if (!open) return
    setOrdered(cards)
    setDiscarded([])
    setDrag(null)
    dragRef.current = null
  }, [open, cards])

  useEffect(() => {
    if (!drag) return

    /** Index of the keepers slot under the cursor (falls back to the dragged slot). */
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
      const overDiscard = pointInRect(
        event.clientX,
        event.clientY,
        discardZoneRef.current
      )
      const next: DragState = {
        ...current,
        moved: true,
        ghostX: event.clientX,
        ghostY: event.clientY,
        overDiscard,
        overIndex: overDiscard
          ? current.fromIndex
          : slotIndexAt(event.clientX, event.clientY, current.fromIndex),
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

      const overDiscard = pointInRect(
        event.clientX,
        event.clientY,
        discardZoneRef.current
      )

      if (current.source === "ordered") {
        if (overDiscard) {
          setOrdered((prev) => prev.filter((_, i) => i !== current.fromIndex))
          setDiscarded((prev) => [...prev, current.card])
          return
        }
        const to = slotIndexAt(event.clientX, event.clientY, current.overIndex)
        setOrdered((prev) => moveIndex(prev, current.fromIndex, to))
        return
      }

      // Dragging from the discard pile — drop back into keepers, or stay.
      if (overDiscard) return
      const insertAt = Math.min(
        Math.max(
          0,
          slotIndexAt(event.clientX, event.clientY, orderedRef.current.length)
        ),
        orderedRef.current.length
      )
      // If we didn't hit a slot, append.
      let at = insertAt
      if (
        orderedRef.current.length > 0 &&
        !orderedRef.current.some((card) => {
          const el = slotRefs.current.get(card.instanceId)
          if (!el) return false
          const r = el.getBoundingClientRect()
          return (
            event.clientX >= r.left &&
            event.clientX <= r.right &&
            event.clientY >= r.top &&
            event.clientY <= r.bottom
          )
        })
      ) {
        at = orderedRef.current.length
      }
      setDiscarded((prev) => prev.filter((_, i) => i !== current.fromIndex))
      setOrdered((prev) => {
        const next = [...prev]
        next.splice(at, 0, current.card)
        return next
      })
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

  function beginDrag(
    event: ReactPointerEvent,
    source: DragSource,
    card: PlayingCardInstance,
    index: number
  ) {
    if (!allowReorder || event.button !== 0) return
    event.preventDefault()
    event.stopPropagation()
    const next: DragState = {
      pointerId: event.pointerId,
      source,
      fromIndex: index,
      card,
      startX: event.clientX,
      startY: event.clientY,
      moved: false,
      ghostX: event.clientX,
      ghostY: event.clientY,
      overIndex: index,
      overDiscard: false,
    }
    dragRef.current = next
    setDrag(next)
  }

  function finish() {
    onClose({
      remaining: orderedRef.current,
      discarded: discardedRef.current,
    })
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
                  ? "Drag to rearrange (#1 = top). Drop cards on Discard to mill them when you press Done."
                  : "These cards stay in the deck in the same order."}
              </p>
            </div>
            <button
              type="button"
              className="font-buahs93 border border-cyan-500/40 px-3 py-1.5 text-xs text-cyan-100 hover:bg-cyan-500/10"
              onClick={finish}
            >
              Done
            </button>
          </div>

          {ordered.length === 0 && discarded.length === 0 ? (
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
                    beginDrag(event, "ordered", card, index)
                  }
                  className={cn(
                    "flex flex-col items-center gap-1",
                    allowReorder && "cursor-grab touch-none select-none",
                    drag?.moved &&
                      drag.source === "ordered" &&
                      drag.fromIndex === index &&
                      "cursor-grabbing opacity-30",
                    drag?.moved &&
                      !drag.overDiscard &&
                      drag.source === "ordered" &&
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

          {allowReorder ? (
            <div
              ref={discardZoneRef}
              className={cn(
                "mt-5 min-h-[10.5rem] border border-dashed border-red-400/40 bg-red-950/20 p-3 transition-colors",
                drag?.moved &&
                  drag.overDiscard &&
                  "border-red-300/80 bg-red-500/15 ring-2 ring-red-400/50"
              )}
              aria-label="Discard pile drop zone"
            >
              <div className="flex items-baseline justify-between gap-2">
                <p className="font-buahs93 text-xs tracking-wide text-red-200/90">
                  DISCARD
                </p>
                <p className="font-mono text-[10px] text-red-100/50">
                  {discarded.length === 0
                    ? "Drop cards here · milled on Done"
                    : `${discarded.length} to mill`}
                </p>
              </div>
              {discarded.length === 0 ? (
                <p className="mt-6 text-center font-mono text-[11px] text-red-100/35">
                  Drag a peeked card onto this pile
                </p>
              ) : (
                <ul className="mt-3 flex flex-wrap gap-2">
                  {discarded.map((card, index) => (
                    <li
                      key={card.instanceId}
                      onPointerDown={(event) =>
                        beginDrag(event, "discard", card, index)
                      }
                      className={cn(
                        "cursor-grab touch-none select-none",
                        drag?.moved &&
                          drag.source === "discard" &&
                          drag.fromIndex === index &&
                          "cursor-grabbing opacity-30"
                      )}
                      title="Drag back to the look order to keep it"
                    >
                      <PlayingCard
                        card={{ ...card, faceDown: false }}
                        className="pointer-events-none h-28 w-[5.5rem]"
                      />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}
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
