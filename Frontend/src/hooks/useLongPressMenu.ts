/**
 * Arms a long-press that opens the same context menu right-click would.
 * Cancels if the pointer moves past LONG_PRESS_MOVE_CANCEL_PX or is released
 * early. When the timer fires, onAbortDrag clears any pending drag session.
 */

import { useEffect, useRef } from "react"

import {
  LONG_PRESS_MS,
  longPressShouldCancel,
} from "@/components/Playtester/board/touchPlay.logic"

type Session = {
  pointerId: number
  startX: number
  startY: number
  timer: number
}

export type ArmLongPressArgs = {
  pointerId: number
  clientX: number
  clientY: number
  /** When false, arm is a no-op (fine pointer / disabled surface). */
  enabled: boolean
  onMenu: (clientX: number, clientY: number) => void
  /** Tear down drag / marquee that started on the same pointerdown. */
  onAbortDrag?: () => void
}

export function useLongPressMenu() {
  const sessionRef = useRef<Session | null>(null)
  const openedRef = useRef(false)

  function clearTimer() {
    const session = sessionRef.current
    if (!session) return
    window.clearTimeout(session.timer)
    sessionRef.current = null
  }

  useEffect(() => {
    return () => clearTimer()
  }, [])

  function arm(args: ArmLongPressArgs) {
    clearTimer()
    openedRef.current = false
    if (!args.enabled) return

    const { pointerId, clientX, clientY, onMenu, onAbortDrag } = args
    const timer = window.setTimeout(() => {
      sessionRef.current = null
      openedRef.current = true
      onAbortDrag?.()
      onMenu(clientX, clientY)
    }, LONG_PRESS_MS)

    sessionRef.current = {
      pointerId,
      startX: clientX,
      startY: clientY,
      timer,
    }
  }

  function noteMove(pointerId: number, clientX: number, clientY: number) {
    const session = sessionRef.current
    if (!session) return
    if (session.pointerId !== pointerId) return
    if (
      longPressShouldCancel(
        session.startX,
        session.startY,
        clientX,
        clientY
      )
    ) {
      clearTimer()
    }
  }

  /**
   * Clear the armed timer. Returns true once if the menu already opened for
   * this gesture (so pointer-up should not treat the press as a tap/select).
   */
  function release(pointerId?: number): boolean {
    const session = sessionRef.current
    if (
      session &&
      pointerId != null &&
      session.pointerId !== pointerId
    ) {
      return false
    }
    clearTimer()
    const opened = openedRef.current
    openedRef.current = false
    return opened
  }

  function isArmed(): boolean {
    return sessionRef.current != null
  }

  return { arm, noteMove, release, clear: clearTimer, isArmed }
}
