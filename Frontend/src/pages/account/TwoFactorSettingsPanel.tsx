/**
 * Settings: email 2FA on/off switch. Confirm still needs a code or password.
 */

import { useState } from "react"

import { useAuth } from "@/app/providers/AuthProvider"
import { GlitchFx } from "@/components/effects/GlitchFx"
import { ApiError } from "@/lib/api/client"
import {
  confirmTwoFactor,
  disableTwoFactor,
  fetchCurrentUser,
  startTwoFactor,
  type TwoFactorStatus,
} from "@/lib/api/auth"
import { cn } from "@/lib/utils"
import {
  twoFactorMethodLabel,
  twoFactorToggleChecked,
  twoFactorTogglePhaseAfterClick,
  type TwoFactorTogglePhase,
} from "@/pages/account/twoFactor.logic"

const fieldClassName =
  "font-buahs93 h-8 rounded-none border border-cyan-500/30 bg-black/80 px-2 text-xs tracking-wide text-cyan-100 outline-none hover:border-cyan-400/50 focus-visible:border-cyan-400"

function statusHelp(detail: string): string {
  switch (detail) {
    case "email_not_configured":
      return "Email sending is not configured on the server yet."
    case "2fa_rate_limited":
      return "Wait a minute before requesting another code."
    case "invalid_2fa_code":
      return "That code is wrong or expired."
    case "invalid_credentials":
      return "Password did not match."
    case "email_not_verified":
      return "Verify your email before turning on 2FA."
    default:
      return "Could not update two-factor settings."
  }
}

export function TwoFactorSettingsPanel() {
  const { token, user, setSession } = useAuth()
  const [status, setStatus] = useState<TwoFactorStatus | null>(null)
  const [phase, setPhase] = useState<TwoFactorTogglePhase>("idle")
  const [code, setCode] = useState("")
  const [password, setPassword] = useState("")
  const [challengeId, setChallengeId] = useState<string | null>(null)
  const [destHint, setDestHint] = useState("")
  const [help, setHelp] = useState("")
  const [busy, setBusy] = useState(false)

  if (!token) return null
  const accessToken = token

  const enabled = status?.enabled ?? Boolean(user?.two_factor_enabled)
  const shownMethod = status?.method ?? user?.two_factor_method ?? null
  const shownHint = status?.dest_hint ?? user?.two_factor_dest_hint ?? ""
  const checked = twoFactorToggleChecked(enabled, phase)
  const showCode = phase === "enabling" || (phase === "disabling" && Boolean(challengeId))
  const showPassword = phase === "disabling" && !challengeId

  async function syncUser(next: TwoFactorStatus) {
    setStatus(next)
    try {
      const fresh = await fetchCurrentUser(accessToken)
      setSession(accessToken, fresh)
    } catch {
      /* local status already updated */
    }
  }

  function resetDraft() {
    setPhase("idle")
    setChallengeId(null)
    setCode("")
    setPassword("")
  }

  async function beginEnable() {
    setBusy(true)
    setHelp("")
    setPhase("enabling")
    try {
      const challenge = await startTwoFactor(accessToken, "email")
      setChallengeId(challenge.challenge_id)
      setDestHint(challenge.dest_hint)
      setCode("")
      setHelp(`Code sent to ${challenge.dest_hint}.`)
    } catch (error) {
      resetDraft()
      setHelp(
        error instanceof ApiError
          ? statusHelp(error.detail)
          : "Could not reach the server."
      )
    } finally {
      setBusy(false)
    }
  }

  async function confirmEnable() {
    if (!challengeId || !code.trim()) {
      setHelp("Enter the code from your email.")
      return
    }
    setBusy(true)
    try {
      const next = await confirmTwoFactor(accessToken, challengeId, code.trim())
      await syncUser(next)
      resetDraft()
      setHelp(`Two-factor is on (${twoFactorMethodLabel(next.method)}).`)
    } catch (error) {
      setHelp(
        error instanceof ApiError
          ? statusHelp(error.detail)
          : "Could not reach the server."
      )
    } finally {
      setBusy(false)
    }
  }

  async function confirmDisable() {
    setBusy(true)
    setHelp("")
    try {
      const next = await disableTwoFactor(accessToken, {
        password: password || undefined,
        challenge_id: challengeId || undefined,
        code: code.trim() || undefined,
      })
      if (next.requires_code && next.challenge_id) {
        setChallengeId(next.challenge_id)
        setDestHint(next.dest_hint ?? "")
        setHelp(`Enter the code sent to ${next.dest_hint ?? "you"} to turn 2FA off.`)
        return
      }
      await syncUser(next)
      resetDraft()
      setHelp("Two-factor is off.")
    } catch (error) {
      setHelp(
        error instanceof ApiError
          ? statusHelp(error.detail)
          : "Could not reach the server."
      )
    } finally {
      setBusy(false)
    }
  }

  async function onToggle() {
    if (busy) return
    const nextPhase = twoFactorTogglePhaseAfterClick(enabled, phase)
    if (nextPhase === "idle") {
      resetDraft()
      setHelp("")
      return
    }
    if (nextPhase === "enabling") {
      await beginEnable()
      return
    }
    setPhase("disabling")
    setChallengeId(null)
    setCode("")
    setPassword("")
    setHelp("Enter your password to turn 2FA off. Google-only accounts can confirm with an email code.")
  }

  return (
    <section className="mb-6 border border-cyan-500/25 bg-black/50 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="font-buahs93 text-sm tracking-wide text-cyan-100">
            TWO-FACTOR SIGN-IN
          </h2>
          <p className="mt-1 font-mono text-[11px] text-cyan-100/45">
            After your password (or Google), we email a one-time code to this
            account. That uses your own SMTP settings — no SMS vendor.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="font-buahs93 text-xs tracking-wide text-cyan-200/80">
            {checked ? "ON" : "OFF"}
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={checked}
            aria-label="Email two-factor sign-in"
            disabled={busy}
            className={cn(
              "relative h-7 w-12 border border-cyan-500/40 bg-black/70 transition-colors",
              "hover:border-cyan-400/70 focus-visible:border-cyan-400 focus-visible:outline-none",
              "disabled:opacity-60",
              checked && "border-cyan-400/80 bg-cyan-700/40"
            )}
            onClick={() => void onToggle()}
          >
            <span
              aria-hidden
              className={cn(
                "absolute top-0.5 h-5 w-5 bg-cyan-300 transition-transform",
                checked ? "translate-x-6" : "translate-x-0.5"
              )}
            />
          </button>
        </div>
      </div>

      {enabled && phase === "idle" ? (
        <p className="mt-3 font-mono text-xs text-cyan-200/80">
          {twoFactorMethodLabel(shownMethod)} · {shownHint}
        </p>
      ) : null}

      {phase !== "idle" ? (
        <div className="mt-4 flex flex-col gap-3">
          {showPassword ? (
            <label className="flex flex-col gap-1">
              <span className="font-mono text-[10px] tracking-wide text-cyan-500/70">
                PASSWORD
              </span>
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                className={fieldClassName}
                disabled={busy}
                onChange={(event) => setPassword(event.target.value)}
              />
            </label>
          ) : null}
          {showCode ? (
            <label className="flex flex-col gap-1">
              <span className="font-mono text-[10px] tracking-wide text-cyan-500/70">
                CODE {destHint ? `· sent to ${destHint}` : ""}
              </span>
              <input
                inputMode="numeric"
                autoComplete="one-time-code"
                value={code}
                className={fieldClassName}
                disabled={busy}
                onChange={(event) => setCode(event.target.value)}
              />
            </label>
          ) : null}
          <div className="flex flex-wrap gap-2">
            {phase === "enabling" ? (
              <>
                <GlitchFx
                  type="button"
                  label="RESEND CODE"
                  disabled={busy}
                  className="font-buahs93 h-9 rounded-none border border-cyan-500/40 bg-black/70 px-5 text-cyan-100 hover:border-cyan-400/70 hover:bg-cyan-500/10 disabled:opacity-60"
                  onClick={() => void beginEnable()}
                />
                <GlitchFx
                  type="button"
                  label="CONFIRM"
                  disabled={busy}
                  className="font-buahs93 h-9 rounded-none bg-cyan-700 px-5 hover:bg-cyan-900 disabled:opacity-60"
                  onClick={() => void confirmEnable()}
                />
              </>
            ) : (
              <GlitchFx
                type="button"
                label="CONFIRM"
                disabled={busy}
                className="font-buahs93 h-9 rounded-none bg-cyan-700 px-5 hover:bg-cyan-900 disabled:opacity-60"
                onClick={() => void confirmDisable()}
              />
            )}
          </div>
        </div>
      ) : null}

      {help ? (
        <p role="status" className="mt-3 font-mono text-[11px] text-cyan-100/70">
          {help}
        </p>
      ) : null}
    </section>
  )
}
