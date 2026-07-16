/**
 * Terminal readout for the login boot sequence.
 * Copy/timing come from `loginBoot.constants` — edit lines there.
 */

import {
  BOOT_LINES,
  CONTINUE_HINT,
} from "@/components/auth/loginBoot/loginBoot.constants"

type BootTerminalProps = {
  visibleCount: number
  progress: number
  showContinueHint: boolean
}

export function BootTerminal({
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
