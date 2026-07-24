/**
 * Free-float play surface — drag cards by {x,y} only.
 */

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react"

import { PlayingCard } from "@/components/Playtester/PlayingCard"
import { toggleExpended, type PlayingCardInstance } from "@/components/Playtester/types"
import { cn } from "@/lib/utils"
import { CardEnlargeOverlay } from "./CardenlargeOverlay"
import { cardArtUrl } from "@/lib/api/decks"

const DRAG_THRESHOLD_PX = 5

export type FreeFloatSurfaceProps = {
  cards: PlayingCardInstance[]
  className?: string
  onMoveCard: (instanceId: string, x: number, y: number) => void
  onBringToFront: (instanceId: string) => void
  onSendToBack: (instanceId: string) => void
  onToggleExpended: (instanceId:string) => void
}

type DragState = {
  instanceId: string
  pointerId: number
  offsetX: number
  offsetY: number
  startX: number
  startY: number
  moved: boolean
}

export function FreeFloatSurface({
  cards,
  className,
  onMoveCard,
  onBringToFront,
  onToggleExpended,
  //onSendToBack
}: FreeFloatSurfaceProps) {
  const surfaceRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<DragState | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)

  const [enlarged, setEnlarged] = useState<PlayingCardInstance | null>(null)
  useEffect(() => {
    if (!enlarged) return

    function release() {
      setEnlarged(null)
    }

    // Surface uses pointer events; listen for pointerup (mouseup alone can miss).
    window.addEventListener("pointerup", release)
    window.addEventListener("blur", release)
    return () => {
      window.removeEventListener("pointerup", release)
      window.removeEventListener("blur", release)
    }
  }, [enlarged])


  function clientToLocal(clientX: number, clientY: number) {
    const surface = surfaceRef.current
    if (!surface) return { x: 0, y: 0 }
    const rect = surface.getBoundingClientRect()
    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    }
  }

  function onCardPointerDown(
    event: ReactPointerEvent<HTMLDivElement>,
    card: PlayingCardInstance
  ) {

    if (event.button === 1) {
      event.preventDefault()
      setEnlarged(card)
      return
    }
    if (event.button !== 0) return
    onBringToFront(card.instanceId)
    event.preventDefault()


    const local = clientToLocal(event.clientX, event.clientY)
    const x = card.x ?? 0
    const y = card.y ?? 0

    dragRef.current = {
      instanceId: card.instanceId,
      pointerId: event.pointerId,
      offsetX: local.x - x,
      offsetY: local.y - y,
      startX: event.clientX,
      startY: event.clientY,
      moved: false,
    }
    setDraggingId(card.instanceId)
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function onCardPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return

    const dist = Math.hypot(
      event.clientX - drag.startX,
      event.clientY - drag.startY
    )
    if (dist <= DRAG_THRESHOLD_PX) return

    drag.moved = true
    const local = clientToLocal(event.clientX, event.clientY)
    onMoveCard(
      drag.instanceId,
      Math.max(0, local.x - drag.offsetX),
      Math.max(0, local.y - drag.offsetY)
    )
  }

  function endDrag(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return

    dragRef.current = null
    setDraggingId(null)
    try {

      event.currentTarget.releasePointerCapture(event.pointerId)

    } catch {
      /* already released */
    }

  } 

  return (
    <div
      ref={surfaceRef}
      className={cn(
        "relative min-h-[420px] w-full overflow-hidden border border-cyan-500/25 bg-black/40",
        className
      )}
    >
      {cards.map((card) => {
        const isDragging = draggingId === card.instanceId

        return (
          <div
            key={card.instanceId}
            className={cn(
              "absolute touch-none transition-transform duration-200 ease-out",
              isDragging ? "z-20 cursor-grabbing" : "z-10 cursor-grab",
              card.expended && "rotate-90"
            )}
            style={{
              left: card.x ?? 0,
              top: card.y ?? 0,
            }}
            onPointerDown={(event) => onCardPointerDown(event, card)}
            onPointerMove={onCardPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            onDoubleClick={() => onToggleExpended(card.instanceId)}
          >
            <PlayingCard card={card} />
          </div>
        )
      })}

      <CardEnlargeOverlay
        open={enlarged != null}
        name={enlarged?.name ?? ""}
        artSrc={enlarged ? cardArtUrl(enlarged.artPath, enlarged.artVersion) : null}
      />
    </div>
  )
}
