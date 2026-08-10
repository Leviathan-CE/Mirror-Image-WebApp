/**
 * Create-account route (`/register`).
 * Creates the account and requires email verification before login.
 */

import { useState, type SubmitEvent } from "react"
import { Link } from "react-router-dom"

import { sharedImages } from "@/assets"
import {
  HELP_TONE_CLASS,
  type HelpTone,
} from "@/components/auth/authFormStyles"
import { GlitchFx } from "@/components/effects/GlitchFx"
import { EditBox } from "@/components/ui/EditBox"
import { createAccount } from "@/lib/api/auth"
import { ApiError } from "@/lib/api/client"
import { ROUTES } from "@/lib/route"
import { cn } from "@/lib/utils"

function helpMessageForError(detail: string): string {
  switch (detail) {
    case "username_or_email_taken":
      return "That username or email is already registered."
    case "email_not_configured":
      return "Email is not configured on the server. Contact an admin."
    case "email_send_failed":
      return "Could not send the verification email. Try again later."
    case "database_unavailable":
      return "Server database is unavailable. Try again in a moment."
    default:
      return "Could not create account. Check your details and try again."
  }
}

export function CreateAccountPage() {
  const [userName, setUserName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [helpTone, setHelpTone] = useState<HelpTone>("idle")
  const [helpText, setHelpText] = useState(
    "Choose a username, email, and password (8+ characters)."
  )
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  async function onSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()

    const trimmedName = userName.trim()
    const trimmedEmail = email.trim()

    if (!trimmedName || !trimmedEmail || !password) {
      setHelpTone("error")
      setHelpText("Username, email, and password are all required.")
      return
    }

    if (password.length < 8) {
      setHelpTone("error")
      setHelpText("Password must be at least 8 characters.")
      return
    }

    setSubmitting(true)
    setHelpTone("pending")
    setHelpText("Creating your account…")

    try {
      const result = await createAccount(trimmedName, trimmedEmail, password)
      setHelpTone("success")
      setHelpText(
        `Account created for ${result.user_name}. Check ${result.email} for a verification link before logging in.`
      )
      setDone(true)
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

  return (
    <section
      className="relative min-h-screen bg-cover bg-center bg-no-repeat px-6 py-12"
      style={{ backgroundImage: `url(${sharedImages.ZONE_BACKGROUND})` }}
    >
      <div className="absolute inset-0 bg-black/60" aria-hidden />

      <div className="relative z-10 mx-auto flex w-full max-w-md flex-col gap-6 pt-16">
        <h1 className="font-glitch text-center text-3xl text-cyan-300 lg:text-4xl">
          CREATE ACCOUNT
        </h1>

        {done ? (
          <div className="border border-cyan-500/20 bg-black/50 p-6 text-center">
            <p className={cn("text-sm", HELP_TONE_CLASS.success)}>{helpText}</p>
            <Link
              to={ROUTES.LOGIN}
              className="mt-4 inline-block text-cyan-300 underline hover:text-cyan-200"
            >
              GO TO LOGIN
            </Link>
          </div>
        ) : (
          <form
            onSubmit={onSubmit}
            className="flex flex-col gap-4 border border-cyan-500/20 bg-black/50 p-6"
          >
            <label className="flex flex-col gap-2">
              <span className="font-buahs93 text-sm text-cyan-200/80">
                USERNAME
              </span>
              <EditBox
                name="username"
                autoComplete="username"
                placeholder="username"
                value={userName}
                onChange={(event) => setUserName(event.target.value)}
                disabled={submitting}
              />
            </label>

            <label className="flex flex-col gap-2">
              <span className="font-buahs93 text-sm text-cyan-200/80">
                EMAIL
              </span>
              <EditBox
                name="email"
                autoComplete="email"
                placeholder="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                disabled={submitting}
              />
            </label>

            <label className="flex flex-col gap-2">
              <span className="font-buahs93 text-sm text-cyan-200/80">
                PASSWORD
              </span>
              <EditBox
                password
                name="password"
                autoComplete="new-password"
                placeholder="password (8+ characters)"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                disabled={submitting}
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
              label={submitting ? "CREATING ACCOUNT…" : "CREATE ACCOUNT"}
              disabled={submitting}
              size="lg"
              className="font-buahs93 h-10 w-full rounded-none bg-cyan-700 px-8 hover:bg-cyan-900 active:bg-cyan-400 disabled:opacity-60"
            />

            <p className="text-center text-sm text-white/50">
              Already have an account?{" "}
              <Link
                to={ROUTES.LOGIN}
                className="text-cyan-300 underline hover:text-cyan-200"
              >
                LOGIN
              </Link>
            </p>
          </form>
        )}
      </div>
    </section>
  )
}
