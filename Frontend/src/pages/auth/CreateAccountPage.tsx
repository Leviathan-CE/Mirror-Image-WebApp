/**
 * Create-account route (`/register`).
 * Password path requires email verification before login.
 * Google path creates/links via `/auth/google` and signs in immediately.
 */

import { useCallback, useState, type SubmitEvent } from "react"
import { Link, useNavigate } from "react-router-dom"

import { useAuth } from "@/app/providers/AuthProvider"
import { sharedImages } from "@/assets"
import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton"
import { LoginBootScreen } from "@/components/auth/loginBoot"
import {
  HELP_TONE_CLASS,
  type HelpTone,
} from "@/components/auth/authFormStyles"
import { GlitchFx } from "@/components/effects/GlitchFx"
import { Button } from "@/components/ui/button"
import { EditBox } from "@/components/ui/EditBox"
import {
  createAccount,
  googleLinkWithPasswordRequest,
  googleLoginRequest,
  type AuthUser,
} from "@/lib/api/auth"
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
    case "google_not_configured":
      return "Google sign-in is not configured on the server yet."
    case "invalid_google_token":
    case "google_email_unverified":
      return "Google sign-in failed. Try again or use email/password."
    case "password_account_exists":
      return "An account with this Google email already exists. Enter that account’s password to link Google and continue."
    case "invalid_credentials":
      return "Wrong password for that account."
    default:
      return "Could not create account. Check your details and try again."
  }
}

export function CreateAccountPage() {
  const navigate = useNavigate()
  const { setSession } = useAuth()

  const [userName, setUserName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [helpTone, setHelpTone] = useState<HelpTone>("idle")
  const [helpText, setHelpText] = useState(
    "Choose a username, email, and password (8+ characters)."
  )
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [booting, setBooting] = useState(false)
  const [bootName, setBootName] = useState("")
  const [pendingGoogleToken, setPendingGoogleToken] = useState<string | null>(
    null
  )

  const finishBoot = useCallback(() => {
    navigate(ROUTES.MAIN, { replace: true })
  }, [navigate])

  const beginSession = useCallback(
    (accessToken: string, user: AuthUser) => {
      setSession(accessToken, user)
      setBootName(user.user_name)
      setBooting(true)
      setPendingGoogleToken(null)
    },
    [setSession]
  )

  const onGoogleCredential = useCallback(
    async (idToken: string) => {
      setSubmitting(true)
      setHelpTone("pending")
      setHelpText("Continuing with Google…")
      try {
        const result = await googleLoginRequest(idToken)
        beginSession(result.access_token, result.user)
      } catch (error) {
        setHelpTone("error")
        if (error instanceof ApiError) {
          setHelpText(helpMessageForError(error.detail))
          if (error.detail === "password_account_exists") {
            setPendingGoogleToken(idToken)
            setPassword("")
          }
        } else {
          setHelpText("Could not reach the server. Is the API running?")
        }
      } finally {
        setSubmitting(false)
      }
    },
    [beginSession]
  )

  async function onSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()

    if (pendingGoogleToken) {
      if (!password) {
        setHelpTone("error")
        setHelpText("Enter your account password to link Google.")
        return
      }
      setSubmitting(true)
      setHelpTone("pending")
      setHelpText("Linking Google to your account…")
      try {
        const result = await googleLinkWithPasswordRequest(
          pendingGoogleToken,
          password
        )
        beginSession(result.access_token, result.user)
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
      return
    }

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

  const formLocked = submitting || booting
  const linkingGoogle = Boolean(pendingGoogleToken)

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
              {linkingGoogle ? (
                <p className="border border-amber-500/30 bg-black/40 p-3 text-sm text-amber-100/90">
                  Security check: this Google email already belongs to a verified
                  password account. Enter that password to link Google.
                </p>
              ) : (
                <>
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
                      disabled={formLocked}
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
                      disabled={formLocked}
                    />
                  </label>
                </>
              )}

              <label className="flex flex-col gap-2">
                <span className="font-buahs93 text-sm text-cyan-200/80">
                  PASSWORD
                </span>
                <EditBox
                  password
                  name="password"
                  autoComplete={linkingGoogle ? "current-password" : "new-password"}
                  placeholder={
                    linkingGoogle
                      ? "password"
                      : "password (8+ characters)"
                  }
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
                label={
                  submitting
                    ? linkingGoogle
                      ? "LINKING…"
                      : "CREATING ACCOUNT…"
                    : linkingGoogle
                      ? "LINK GOOGLE & CONTINUE"
                      : "CREATE ACCOUNT"
                }
                disabled={formLocked}
                size="lg"
                className="font-buahs93 h-10 w-full rounded-none bg-cyan-700 px-8 hover:bg-cyan-900 active:bg-cyan-400 disabled:opacity-60"
              />

              {linkingGoogle ? (
                <Button
                  type="button"
                  disabled={formLocked}
                  className="font-buahs93 h-9 w-full rounded-none border border-white/20 bg-transparent text-sm text-white/70 hover:bg-white/5"
                  onClick={() => {
                    setPendingGoogleToken(null)
                    setHelpTone("idle")
                    setHelpText(
                      "Choose a username, email, and password (8+ characters)."
                    )
                  }}
                >
                  CANCEL GOOGLE LINK
                </Button>
              ) : null}

              <GoogleSignInButton
                disabled={formLocked || linkingGoogle}
                onCredential={(token) => void onGoogleCredential(token)}
                onLoadError={() => {
                  setHelpTone("error")
                  setHelpText("Could not load Google sign-in.")
                }}
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
    </>
  )
}
