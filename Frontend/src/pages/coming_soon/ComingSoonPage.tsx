/**
 * Public splash while the admin coming-soon flag is on.
 */

import { useState } from "react"
import type { FormEvent } from "react"
import { useNavigate } from "react-router-dom"

import { useAuth } from "@/app/providers/AuthProvider"
import { sharedImages } from "@/assets"
import { GlitchFx } from "@/components/effects/GlitchFx"
import { ApiError } from "@/lib/api/client"
import { subscribeMailingList } from "@/lib/api/mailingList"
import { ROUTES } from "@/lib/route"

const loginCtaClass =
  "font-buahs93 h-12 rounded-none border border-cyan-500/50 bg-black/60 px-8 text-base text-cyan-100 hover:border-cyan-400 hover:bg-cyan-500/10 sm:h-14 sm:px-10 sm:text-lg"

const fieldClass =
  "font-mono h-11 w-full max-w-md border border-cyan-500/40 bg-black/70 px-3 text-sm text-cyan-50 outline-none placeholder:text-cyan-100/35 focus:border-cyan-400"

export function ComingSoonPage() {
  const navigate = useNavigate()
  const { isAuthenticated, clearSession } = useAuth()
  const [email, setEmail] = useState("")
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function onSubscribe(event: FormEvent) {
    event.preventDefault()
    if (busy) return
    const cleaned = email.trim()
    if (!cleaned) {
      setError("Enter an email address.")
      setMessage(null)
      return
    }
    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      const result = await subscribeMailingList(cleaned)
      if (result.already_subscribed) {
        setMessage("You are already on the list.")
      } else {
        setMessage("Thanks — check your inbox for a confirmation.")
      }
      setEmail("")
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.detail === "invalid_email") {
          setError("That email does not look valid.")
        } else if (err.detail === "email_not_configured") {
          setError("Mail is not configured yet. Try again later.")
        } else {
          setError(err.detail)
        }
      } else {
        setError("Could not subscribe. Try again later.")
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="relative flex min-h-[100svh] flex-col justify-end overflow-hidden bg-black text-cyan-50">
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${sharedImages.ZONE_BACKGROUND})` }}
        aria-hidden
      />
      <div
        className="absolute inset-0 bg-gradient-to-t from-black via-black/70 to-black/35"
        aria-hidden
      />

      <div className="relative z-10 mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 pb-16 pt-28 sm:pb-20 sm:pt-32">
        <div className="flex items-end gap-4 sm:gap-5">
          <img
            src={sharedImages.LOGO_MARK}
            alt=""
            className="h-16 w-auto shrink-0 object-contain sm:h-24 md:h-28"
          />
          <h1 className="font-glitch text-4xl leading-none tracking-wide text-cyan-200 sm:text-6xl md:text-7xl">
            MIRROR IMAGE
          </h1>
        </div>
        <p className="font-buahs93 text-xs tracking-[0.35em] text-cyan-400">
          COMING SOON
        </p>
        <h2 className="font-buahs93 max-w-2xl text-xl text-white sm:text-2xl md:text-3xl">
          The site is not open to the public yet.
        </h2>
        <p className="max-w-xl text-sm leading-relaxed text-cyan-100/80 sm:text-base">
          Leave your email for Updates when we publish. Staff can sign in to
          open the site from the admin console.
        </p>

        <form
          onSubmit={(event) => void onSubscribe(event)}
          className="flex max-w-xl flex-col gap-3"
        >
          <label className="flex flex-col gap-2">
            <span className="font-buahs93 text-[11px] tracking-wide text-cyan-300/80">
              EMAIL FOR UPDATES
            </span>
            <input
              type="email"
              name="email"
              autoComplete="email"
              value={email}
              disabled={busy}
              onChange={(event) => setEmail(event.target.value)}
              className={fieldClass}
              placeholder="you@example.com"
              aria-label="Email for updates"
            />
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <GlitchFx
              type="submit"
              label={busy ? "SENDING…" : "NOTIFY ME"}
              size="lg"
              variant="outline"
              disabled={busy}
              className={loginCtaClass}
            />
          </div>
          {message ? (
            <p className="font-mono text-sm text-cyan-200" role="status">
              {message}
            </p>
          ) : null}
          {error ? (
            <p className="font-mono text-sm text-red-300" role="alert">
              {error}
            </p>
          ) : null}
        </form>

        <div className="flex flex-wrap gap-3 pt-2">
          {isAuthenticated ? (
            <GlitchFx
              label="SIGN OUT"
              size="lg"
              variant="outline"
              className={loginCtaClass}
              onClick={clearSession}
            />
          ) : (
            <GlitchFx
              label="LOGIN"
              size="lg"
              variant="outline"
              className={loginCtaClass}
              onClick={() => navigate(ROUTES.LOGIN)}
            />
          )}
        </div>
      </div>
    </section>
  )
}
