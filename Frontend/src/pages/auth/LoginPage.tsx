/**
 * Login route (`/login`).
 *
 * 1. User submits identifier + password → `loginRequest`.
 * 2. On success: `setSession`, then show `LoginBootScreen`.
 * 3. Boot `onComplete` navigates to the intended page (or `/main`).
 */

import { useCallback, useState, type SubmitEvent } from "react"
import { useLocation, useNavigate } from "react-router-dom"

import { useAuth } from "@/app/providers/AuthProvider"
import { sharedImages } from "@/assets"
import { LoginBootScreen } from "@/components/auth/loginBoot"
import { GlitchFx } from "@/components/effects/GlitchFx"
import { EditBox } from "@/components/ui/EditBox"
import { loginRequest } from "@/lib/api/auth"
import { ApiError } from "@/lib/api/client"
import { ROUTES } from "@/lib/route"
import { cn } from "@/lib/utils"

type HelpTone = "idle" | "error" | "success" | "pending"

const HELP_TONE_CLASS: Record<HelpTone, string> = {
  idle: "text-white/50",
  pending: "text-cyan-300/80",
  success: "text-emerald-400",
  error: "text-red-400",
}

function helpMessageForError(detail: string): string {
  switch (detail) {
    case "invalid_credentials":
      return "Login failed — wrong username/email or password."
    case "database_unavailable":
      return "Server database is unavailable. Try again in a moment."
    default:
      return "Login failed. Check your details and try again."
  }
}

export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { setSession } = useAuth()
  const redirectTo =
    (location.state as { from?: string } | null)?.from || ROUTES.MAIN

  const [identifier, setIdentifier] = useState("")
  const [password, setPassword] = useState("")
  const [helpTone, setHelpTone] = useState<HelpTone>("idle")
  const [helpText, setHelpText] = useState(
    "Enter your username or email, then your password."
  )
  const [submitting, setSubmitting] = useState(false)
  /** When true, the boot overlay covers the form until navigation. */
  const [booting, setBooting] = useState(false)
  const [bootName, setBootName] = useState("")

  const finishBoot = useCallback(() => {
    navigate(redirectTo, { replace: true })
  }, [navigate, redirectTo])

  async function onSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!identifier.trim() || !password) {
      setHelpTone("error")
      setHelpText("Both fields are required.")
      return
    }

    setSubmitting(true)
    setHelpTone("pending")
    setHelpText("Checking credentials…")

    try {
      const result = await loginRequest(identifier.trim(), password)
      setSession(result.access_token, result.user)
      setHelpTone("success")
      setHelpText(`Welcome back, ${result.user.user_name}. Login successful.`)
      setBootName(result.user.user_name)
      setBooting(true)
    } catch (error) {
      setHelpTone("error")
      if (error instanceof ApiError) {
        setHelpText(helpMessageForError(error.detail))
      } else {
        setHelpText("Could not reach the server. Is the API running?")
      }
    } finally {
      setSubmitting(false)
    }
  }

  const formLocked = submitting || booting

  return (
    <>
      {booting ? (
        <LoginBootScreen userName={bootName} onComplete={finishBoot} />
      ) : null}

      <section
        className="relative min-h-screen bg-cover bg-center bg-no-repeat px-6 py-12"
        style={{ backgroundImage: `url(${sharedImages.ZONE_BACKGROUND})` }}
      >
        <div className="absolute inset-0 bg-black/60" aria-hidden />

        <div className="relative z-10 mx-auto flex w-full max-w-md flex-col gap-6 pt-16">
          <h1 className="font-glitch text-center text-3xl text-cyan-300 lg:text-4xl">
            LOGIN
          </h1>

          <form
            onSubmit={onSubmit}
            className="flex flex-col gap-4 border border-cyan-500/20 bg-black/50 p-6"
          >
            <label className="flex flex-col gap-2">
              <span className="font-buahs93 text-sm text-cyan-200/80">
                USERNAME OR EMAIL
              </span>
              <EditBox
                name="identifier"
                autoComplete="username"
                placeholder="user name or email"
                value={identifier}
                onChange={(event) => setIdentifier(event.target.value)}
                disabled={formLocked}
              />
            </label>

            <label className="flex flex-col gap-2">
              <span className="font-buahs93 text-sm text-cyan-200/80">
                PASSWORD
              </span>
              <EditBox
                password
                name="password"
                autoComplete="current-password"
                placeholder="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                disabled={formLocked}
              />
            </label>

            <p
              role="status"
              aria-live="polite"
              className={cn(
                "min-h-10 text-sm leading-snug",
                HELP_TONE_CLASS[helpTone]
              )}
            >
              {helpText}
            </p>

            <GlitchFx
              type="submit"
              label={submitting ? "LOGGING IN…" : "LOGIN"}
              disabled={formLocked}
              size="lg"
              className="font-buahs93 h-10 w-full rounded-none bg-cyan-700 px-8 hover:bg-cyan-900 active:bg-cyan-400 disabled:opacity-60"
            />
          </form>
        </div>
      </section>
    </>
  )
}
