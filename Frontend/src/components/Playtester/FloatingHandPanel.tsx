/**
 * Floating, resizable hand window on the play field.
 * Drag the header to move, the corner grip to resize; both persist.
 * No backdrop — cards drag out onto the table underneath.
 */

import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type Ref,
} from "react"

import {
  clampHandFloatBox,
  defaultHandFloatBox,
  readStoredHandFloatBox,
  writeStoredHandFloatBox,
  type HandFloatAnchor,
  type HandFloatBox,
  type ParentSize,
} from "@/components/Playtester/handFloatPanel.logic"

type BoxDragState = {
  pointerId: number
  startX: number
  startY: number
  startBox: HandFloatBox
}

export type FloatingHandPanelProps = {
  parentSize: ParentSize
  anchor?: HandFloatAnchor
  panelRef?: Ref<HTMLDivElement | null>
  /** Centered in the title bar (life total). */
  center?: ReactNode
  children: ReactNode
  label: string
}

export function FloatingHandPanel({
  parentSize,
  anchor = "bottom",
  panelRef,
  center,
  children,
  label,
}: FloatingHandPanelProps) {
  const [box, setBox] = useState<HandFloatBox | null>(null)
  const moveRef = useRef<BoxDragState | null>(null)
  const resizeRef = useRef<BoxDragState | null>(null)

  useEffect(() => {
    if (parentSize.width < 32 || parentSize.height < 32) return
    setBox((prev) =>
      prev
        ? clampHandFloatBox(prev, parentSize)
        : readStoredHandFloatBox(parentSize, anchor)
    )
  }, [parentSize, anchor])

  useEffect(() => {
    if (!box) return
    writeStoredHandFloatBox(box, anchor)
  }, [box, anchor])

  function beginBoxDrag(
    event: ReactPointerEvent<HTMLDivElement>,
    into: typeof moveRef
  ) {
    if (event.button !== 0 || box == null) return
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
    from: typeof moveRef
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

  function onHeaderPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (
      event.target instanceof Element &&
      event.target.closest("button")
    ) {
      return
    }
    beginBoxDrag(event, moveRef)
  }

  function onHeaderPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const move = moveRef.current
    if (!move || move.pointerId !== event.pointerId) return
    setBox(
      clampHandFloatBox(
        {
          ...move.startBox,
          x: move.startBox.x + (event.clientX - move.startX),
          y: move.startBox.y + (event.clientY - move.startY),
        },
        parentSize
      )
    )
  }

  function onResizePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const resize = resizeRef.current
    if (!resize || resize.pointerId !== event.pointerId) return
    setBox(
      clampHandFloatBox(
        {
          ...resize.startBox,
          width: resize.startBox.width + (event.clientX - resize.startX),
          height: resize.startBox.height + (event.clientY - resize.startY),
        },
        parentSize
      )
    )
  }

  if (!box || parentSize.width < 32 || parentSize.height < 32) return null

  return (
    <div
      ref={panelRef}
      className="absolute z-40 flex flex-col overflow-hidden border border-cyan-500/40 bg-black/80 shadow-lg shadow-black/50"
      style={{
        left: box.x,
        top: box.y,
        width: box.width,
        height: box.height,
      }}
    >
      <div
        className="grid shrink-0 cursor-grab grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 border-b border-cyan-500/25 px-2 py-1 touch-none"
        onPointerDown={onHeaderPointerDown}
        onPointerMove={onHeaderPointerMove}
        onPointerUp={(event) => endBoxDrag(event, moveRef)}
        onPointerCancel={(event) => endBoxDrag(event, moveRef)}
      >
        <p className="min-w-0 truncate font-mono text-[10px] tracking-wide text-cyan-100/80">
          {label}
        </p>
        <div className="justify-self-center">{center}</div>
        <div aria-hidden />
      </div>
      <div className="relative min-h-0 flex-1">{children}</div>
      <div
        role="button"
        tabIndex={-1}
        aria-label="Resize hand"
        title="Drag to resize · double-click to reset"
        className="absolute bottom-0 right-0 z-20 h-4 w-4 cursor-nwse-resize touch-none"
        onPointerDown={(event) => beginBoxDrag(event, resizeRef)}
        onPointerMove={onResizePointerMove}
        onPointerUp={(event) => endBoxDrag(event, resizeRef)}
        onPointerCancel={(event) => endBoxDrag(event, resizeRef)}
        onDoubleClick={() => setBox(defaultHandFloatBox(parentSize, anchor))}
      >
        <div
          className="absolute right-1 bottom-1 h-2 w-2 border-r-2 border-b-2 border-cyan-400/70"
          aria-hidden
        />
      </div>
    </div>
  )
}
