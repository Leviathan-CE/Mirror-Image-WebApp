/**
 * Boot sequence timing + continue input.
 *
 * Does not depend on `onComplete` identity — parent auth re-renders must not
 * restart the effect (that snapped progress back to 0%).
 */

import { useEffect, useRef, useState } from "react"

import {
  BOOT_LINES,
  INPUT_ARM_MS,
} from "@/components/auth/loginBoot/loginBoot.constants"

export type BootSequenceState = {
  visibleCount: number
  progress: number
  inputArmed: boolean
  /** Finish once and call `onComplete`. */
  continueToMain: () => void
}

export function useBootSequence(
  durationMs: number,
  onComplete: () => void
): BootSequenceState {
  const [visibleCount, setVisibleCount] = useState(1)
  const [progress, setProgress] = useState(0)
  const [inputArmed, setInputArmed] = useState(false)

  const onCompleteRef = useRef(onComplete)
  const finishedRef = useRef(false)

  onCompleteRef.current = onComplete

  function continueToMain() {
    if (finishedRef.current) return
    finishedRef.current = true
    onCompleteRef.current()
  }

  useEffect(() => {
    finishedRef.current = false

    const armTimer = window.setTimeout(() => setInputArmed(true), INPUT_ARM_MS)

    const lineStep = Math.floor(durationMs / (BOOT_LINES.length + 1))
    const lineTimers = BOOT_LINES.map((_, index) =>
      window.setTimeout(() => {
        if (finishedRef.current) return
        setVisibleCount(index + 1)
      }, lineStep * (index + 1))
    )

    const start = performance.now()
    let frame = 0
    const tick = (now: number) => {
      if (finishedRef.current) return
      const t = Math.min(1, (now - start) / durationMs)
      setProgress(Math.round(t * 100))
      if (t < 1) {
        frame = requestAnimationFrame(tick)
      }
    }
    frame = requestAnimationFrame(tick)

    const doneTimer = window.setTimeout(() => continueToMain(), durationMs)

    return () => {
      clearTimeout(armTimer)
      lineTimers.forEach(clearTimeout)
      clearTimeout(doneTimer)
      cancelAnimationFrame(frame)
    }
    // Intentionally omit onComplete — see file header.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [durationMs])

  useEffect(() => {
    if (!inputArmed) return

    function onKeyDown(event: KeyboardEvent) {
      if (isModifierOnlyKey(event.key)) return
      event.preventDefault()
      continueToMain()
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [inputArmed])

  return { visibleCount, progress, inputArmed, continueToMain }
}

function isModifierOnlyKey(key: string): boolean {
  return key === "Shift" || key === "Control" || key === "Alt" || key === "Meta"
}
