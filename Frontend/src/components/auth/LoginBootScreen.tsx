/**
 * Post-login boot overlay.
 *
 * Flow:
 * 1. LoginPage authenticates → mounts this screen.
 * 2. Terminal lines + progress bar play for `durationMs`.
 * 3. After a short arm delay, click / any key calls `onComplete` (usually navigate to /main).
 * 4. If the user does nothing, `onComplete` still fires when the timer ends.
 *
 * Important: the sequence effect must NOT depend on `onComplete`. Parent re-renders
 * (auth context) would otherwise restart the effect and snap progress back to 0%.
 */

import { useEffect, useRef, useState } from "react"

const BOOT_LINES = [
  "> ESTABLISHING UPLINK…",
  "> AUTH TOKEN VERIFIED",
  "> LOADING OPERATOR PROFILE…",
  "> SYNCING DECK ARCHIVE…",
  "> HANDSHAKE COMPLETE",
] as const

/** Delay before click/key can continue — avoids the LOGIN click closing this overlay. */
const INPUT_ARM_MS = 500

const CONTINUE_HINT = "> PRESS ANY KEY OR CLICK TO CONTINUE"

type LoginBootScreenProps = {
  /** Display name shown in the welcome line. */
  userName: string
  /** Called once when the boot finishes or the user continues early. */
  onComplete: () => void
  /** Total length of the boot sequence in milliseconds. */
  durationMs?: number
}

type BootSequenceState = {
  /** How many `BOOT_LINES` are currently visible. */
  visibleCount: number
  /** 0–100 progress for the bar and percent readout. */
  progress: number
  /** True once click/key are allowed to continue. */
  inputArmed: boolean
  /** Finish the boot and invoke `onComplete` (idempotent). */
  continueToMain: () => void
}

/**
 * Owns timers, rAF progress, and input-arming for the boot overlay.
 * Keeps `onComplete` in a ref so parent identity changes do not restart the sequence.
 */
function useBootSequence(
  durationMs: number,
  onComplete: () => void
): BootSequenceState {
  const [visibleCount, setVisibleCount] = useState(1)
  const [progress, setProgress] = useState(0)
  const [inputArmed, setInputArmed] = useState(false)

  const onCompleteRef = useRef(onComplete)
  const finishedRef = useRef(false)

  // Always point at the latest callback without re-running the sequence effect.
  onCompleteRef.current = onComplete

  function continueToMain() {
    if (finishedRef.current) return
    finishedRef.current = true
    onCompleteRef.current()
  }

  // Start the sequence once per `durationMs`. Cleanup cancels timers on unmount.
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

  // Keyboard continue — only after input is armed.
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

/**
 * Full-screen terminal boot UI shown after a successful login.
 */
export function LoginBootScreen({
  userName,
  onComplete,
  durationMs = 3200,
}: LoginBootScreenProps) {
  const { visibleCount, progress, inputArmed, continueToMain } = useBootSequence(
    durationMs,
    onComplete
  )

  return (
    <div
      className={`login-boot fixed inset-0 z-[100] flex items-center justify-center bg-black ${
        inputArmed ? "cursor-pointer" : "cursor-default"
      }`}
      role="status"
      aria-live="polite"
      aria-label="Logging in"
      onClick={() => {
        if (!inputArmed) return
        continueToMain()
      }}
    >
      <div className="login-boot-scan absolute inset-0" aria-hidden />
      <div className="login-boot-noise absolute inset-0" aria-hidden />
      <div className="login-boot-vignette absolute inset-0" aria-hidden />

      <div className="relative z-10 mx-auto w-full max-w-lg px-6">
        <p className="mt-2 text-center font-buahs93 text-sm tracking-wide text-cyan-200/70">
          WELCOME BACK, {userName.toUpperCase()}
        </p>

        <BootTerminal
          visibleCount={visibleCount}
          progress={progress}
          showContinueHint={inputArmed}
        />

        <div className="mt-4 h-1 overflow-hidden bg-cyan-950">
          <div
            className="login-boot-bar h-full bg-cyan-400"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  )
}

type BootTerminalProps = {
  visibleCount: number
  progress: number
  showContinueHint: boolean
}

/** Terminal panel: boot lines, optional continue hint, percent + caret. */
function BootTerminal({
  visibleCount,
  progress,
  showContinueHint,
}: BootTerminalProps) {
  return (
    <div className="login-boot-panel mt-8 border border-cyan-500/30 bg-black/80 p-4 font-mono text-sm text-cyan-100/90">
      {BOOT_LINES.slice(0, visibleCount).map((line) => (
        <p key={line} className="login-boot-line leading-relaxed">
          {line}
        </p>
      ))}
      {showContinueHint ? (
        <p className="login-boot-line mt-2 text-cyan-400/70">{CONTINUE_HINT}</p>
      ) : null}
      <p className="mt-3 text-cyan-300/80">
        [{String(progress).padStart(3, " ")}%]{" "}
        <span className="login-boot-caret inline-block h-3 w-2 align-middle bg-cyan-300" />
      </p>
    </div>
  )
}
