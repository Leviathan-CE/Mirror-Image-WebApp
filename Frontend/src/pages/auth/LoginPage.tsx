/**
 * Login route (`/login`).
 *
 * 1. User submits identifier + password → `loginRequest`.
 * 2. Or Continue with Google → `googleLoginRequest`.
 * 3. If Google email matches a *verified* password account → require password
 *    (`googleLinkWithPasswordRequest`) so squatters cannot steal the account.
 * 4. On success: `setSession`, then show `LoginBootScreen`.
 */

import { useCallback, useState, type SubmitEvent } from "react"
import { Link, useLocation, useNavigate } from "react-router-dom"

import { useAuth } from "@/app/providers/AuthProvider"
import { useComingSoon } from "@/app/providers/ComingSoonProvider"
import { safeNextPath } from "@/app/RequireAuth"
import { sharedImages } from "@/assets"
import { LoginBootScreen } from "@/components/auth/loginBoot"
import {
  HELP_TONE_CLASS,
  type HelpTone,
} from "@/components/auth/authFormStyles"
import { GlitchFx } from "@/components/effects/GlitchFx"
import { Button } from "@/components/ui/button"
import { EditBox } from "@/components/ui/EditBox"
import {
  googleLinkWithPasswordRequest,
  googleLoginRequest,
  loginRequest,
  type AuthUser,
} from "@/lib/api/auth"
import { resendVerificationRequest } from "@/lib/api/email_auth"
import { ApiError } from "@/lib/api/client"
import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton"
import { PrivacyNotice } from "@/components/legal/PrivacyNotice"
import { ROUTES } from "@/lib/route"
import { cn } from "@/lib/utils"

function helpMessageForError(detail: string): string {
  switch (detail) {
    case "invalid_credentials":
      return "Login failed — wrong username/email or password."
    case "email_not_verified":
      return (
        "This account still needs to be verified. "
        + "Check the email you used for this account."
      )
    case "rate_limited":
      return "Too many emails were sent. Wait a few minutes and try again."
    case "account_disabled":
      return "This account has been disabled."
    case "database_unavailable":
      return "Server database is unavailable. Try again in a moment."
    case "google_not_configured":
      return "Google sign-in is not configured on the server yet."
    case "invalid_google_token":
    case "google_email_unverified":
      return "Google sign-in failed. Try again or use your password."
    case "password_account_exists":
      return "An account with this Google email already exists. Enter that account’s password to link Google and continue."
    case "email_not_configured":
      return "Email is not configured on the server. Contact an admin."
    case "email_send_failed":
      return "Could not send the verification email. Try again later."
    default:
      return "Login failed. Check your details and try again."
  }
}

function resendMessage(detail: string): string {
  switch (detail) {
    case "rate_limited":
      return "Too many emails were sent. Wait a few minutes and try again."
    case "email_not_configured":
      return "Email is not configured on the server. Contact an admin."
    case "email_send_failed":
      return "Could not send the verification email. Try again later."
    case "database_unavailable":
      return "Server database is unavailable. Try again in a moment."
    default:
      return "Could not send a new verification email. Try again later."
  }
}

export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { setSession } = useAuth()
  const { comingSoon } = useComingSoon()
  const nextFromQuery = safeNextPath(
    new URLSearchParams(location.search).get("next")
  )
  const nextFromState = safeNextPath(
    (location.state as { from?: string } | null)?.from
  )
  const redirectTo = nextFromQuery || nextFromState || ROUTES.MAIN

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
  const [needsVerify, setNeedsVerify] = useState(false)
  const [resending, setResending] = useState(false)
  /** Pending Google ID token waiting for password proof to link. */
  const [pendingGoogleToken, setPendingGoogleToken] = useState<string | null>(
    null
  )

  const finishBoot = useCallback(() => {
    navigate(redirectTo, { replace: true })
  }, [navigate, redirectTo])

  const beginSession = useCallback(
    (accessToken: string, user: AuthUser) => {
      setSession(accessToken, user)
      setHelpTone("success")
      setHelpText(`Welcome back, ${user.user_name}. Login successful.`)
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
      setHelpText("Checking Google sign-in…")
      setNeedsVerify(false)

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


  async function onResendVerify() {
    const target = identifier.trim()
    if (target === "") {
      setHelpTone("error")
      setHelpText("Enter the username or email, then resend.")
      return
    }
    setResending(true)
    try {
      await resendVerificationRequest(target)
      setHelpTone("success")
      setHelpText(
        "A new link was sent to the email on this account. "
        + "Check that inbox."
      )
    } catch (error) {
      setHelpTone("error")
      if (error instanceof ApiError) {
        setHelpText(resendMessage(error.detail))
      } else {
        setHelpText("Could not reach the server.")
      }
    } finally {
      setResending(false)
    }
  }

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

    if (!identifier.trim() || !password) {
      setHelpTone("error")
      setHelpText("Both fields are required.")
      return
    }

    setSubmitting(true)
    setHelpTone("pending")
    setHelpText("Checking credentials…")
    setNeedsVerify(false)

    try {
      const result = await loginRequest(identifier.trim(), password)
      beginSession(result.access_token, result.user)
    } catch (error) {
      setHelpTone("error")
      if (error instanceof ApiError) {
        setHelpText(helpMessageForError(error.detail))
        if (error.detail === "email_not_verified") {
          setNeedsVerify(true)
        }
      } else {
        setHelpText("Could not reach the server. Is the API running?")
      }
    } finally {
      setSubmitting(false)
    }
  }

  const formLocked = submitting || resending || booting
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
            LOGIN
          </h1>

          <form
            onSubmit={onSubmit}
            className="flex flex-col gap-4 border border-cyan-500/20 bg-black/50 p-6"
          >
            {linkingGoogle ? (
              <p className="border border-amber-500/30 bg-black/40 p-3 text-sm text-amber-100/90">
                Security check: this Google email already belongs to a verified
                password account. Enter that password to link Google — a stranger
                who only knew your email cannot get in.
              </p>
            ) : (
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
            )}

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

            {needsVerify ? (
              <div className="border border-amber-500/30 bg-black/40 p-3">
                <p className="text-sm leading-snug text-amber-100/90">
                  Check the email you used for this account.
                  A new link is sent only to that inbox.
                </p>
                <Button
                  type="button"
                  disabled={formLocked}
                  className={
                    "font-buahs93 mt-2 h-9 w-full rounded-none "
                    + "bg-amber-800 px-4 text-sm text-white "
                    + "hover:bg-amber-700 disabled:opacity-60"
                  }
                  onClick={() => void onResendVerify()}
                >
                  {resending ? "SENDING…" : "RESEND VERIFICATION LINK"}
                </Button>
              </div>
            ) : null}

            <GlitchFx
              type="submit"
              label={
                submitting
                  ? linkingGoogle
                    ? "LINKING…"
                    : "LOGGING IN…"
                  : linkingGoogle
                    ? "LINK GOOGLE & LOGIN"
                    : "LOGIN"
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
                    "Enter your username or email, then your password."
                  )
                }}
              >
                CANCEL GOOGLE LINK
              </Button>
            ) : null}

            <PrivacyNotice>
              Signing in with a password or Google creates a session cookie
              on this site.
            </PrivacyNotice>

            <GoogleSignInButton
              disabled={formLocked || linkingGoogle}
              onCredential={(token) => void onGoogleCredential(token)}
              onLoadError={() => {
                setHelpTone("error")
                setHelpText("Could not load Google sign-in.")
              }}
            />

            <p className="text-center text-sm text-white/50">
              <Link
                to={ROUTES.FORGOT_PASSWORD}
                className="text-cyan-300 underline hover:text-cyan-200"
              >
                FORGOT PASSWORD
              </Link>
              {comingSoon ? null : (
                <>
                  {" · "}
                  Need an account?{" "}
                  <Link
                    to={ROUTES.REGISTER}
                    className="text-cyan-300 underline hover:text-cyan-200"
                  >
                    CREATE ACCOUNT
                  </Link>
                </>
              )}
            </p>
          </form>
        </div>
      </section>
    </>
  )
}
