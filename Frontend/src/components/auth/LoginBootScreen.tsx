import { useEffect, useState } from "react"

const BOOT_LINES = [
  "> ESTABLISHING UPLINK…",
  "> AUTH TOKEN VERIFIED",
  "> LOADING OPERATOR PROFILE…",
  "> SYNCING DECK ARCHIVE…",
  "> HANDSHAKE COMPLETE",
]

type LoginBootScreenProps = {
  userName: string
  onComplete: () => void
  /** Total time before navigation (ms). */
  durationMs?: number
}

/**
 * Full-screen terminal boot sequence shown after a successful login.
 */
export function LoginBootScreen({
  userName,
  onComplete,
  durationMs = 3200,
}: LoginBootScreenProps) {
  const [visibleCount, setVisibleCount] = useState(1)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    const lineStep = Math.floor(durationMs / (BOOT_LINES.length + 1))
    const timers = BOOT_LINES.map((_, index) =>
      window.setTimeout(() => setVisibleCount(index + 1), lineStep * (index + 1))
    )

    const start = performance.now()
    let frame = 0
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs)
      setProgress(Math.round(t * 100))
      if (t < 1) {
        frame = requestAnimationFrame(tick)
      }
    }
    frame = requestAnimationFrame(tick)

    const done = window.setTimeout(onComplete, durationMs)

    return () => {
      timers.forEach(clearTimeout)
      clearTimeout(done)
      cancelAnimationFrame(frame)
    }
  }, [durationMs, onComplete])

  return (
    <div
      className="login-boot fixed inset-0 z-[100] flex items-center justify-center bg-black"
      role="status"
      aria-live="polite"
      aria-label="Loading operator profile"
    >
      <div className="login-boot-scan absolute inset-0" aria-hidden />
      <div className="relative z-10 mx-auto w-full max-w-lg px-6">
        <p className="font-glitch login-boot-title text-center text-2xl text-cyan-300 sm:text-3xl">
          MIRROR IMAGE
        </p>
        <p className="mt-2 text-center font-buahs93 text-sm tracking-wide text-cyan-200/70">
          WELCOME, {userName.toUpperCase()}
        </p>

        <div className="mt-8 border border-cyan-500/30 bg-black/80 p-4 font-mono text-sm text-cyan-100/90">
          {BOOT_LINES.slice(0, visibleCount).map((line) => (
            <p key={line} className="login-boot-line leading-relaxed">
              {line}
            </p>
          ))}
          <p className="mt-3 text-cyan-300/80">
            [{String(progress).padStart(3, " ")}%]{" "}
            <span className="inline-block h-3 w-2 animate-pulse bg-cyan-300 align-middle" />
          </p>
        </div>

        <div className="mt-4 h-1 overflow-hidden bg-cyan-950">
          <div
            className="h-full bg-cyan-400 transition-[width] duration-100 ease-linear"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  )
}
