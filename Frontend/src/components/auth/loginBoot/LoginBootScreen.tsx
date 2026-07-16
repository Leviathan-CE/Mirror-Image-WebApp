/**
 * Full-screen post-login boot overlay.
 *
 * Pieces (change in one place each):
 * - Copy / timing → `loginBoot.constants.ts`
 * - Sequence logic → `useBootSequence.ts`
 * - Terminal markup → `BootTerminal.tsx`
 * - Motion / FX → `loginBoot.css`
 */

import "@/components/auth/loginBoot/loginBoot.css"

import { BootTerminal } from "@/components/auth/loginBoot/BootTerminal"
import { DEFAULT_BOOT_DURATION_MS } from "@/components/auth/loginBoot/loginBoot.constants"
import { useBootSequence } from "@/components/auth/loginBoot/useBootSequence"

type LoginBootScreenProps = {
  userName: string
  onComplete: () => void
  durationMs?: number
}

export function LoginBootScreen({
  userName,
  onComplete,
  durationMs = DEFAULT_BOOT_DURATION_MS,
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
