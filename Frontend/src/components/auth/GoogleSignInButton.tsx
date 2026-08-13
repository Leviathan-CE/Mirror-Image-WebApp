/**
 * Mounts the Google Identity Services button using the client id from the API.
 * Always shows the OR / host row; if Google is not configured, shows a short note.
 */

import { useEffect, useEffectEvent, useRef, useState } from "react"

import { fetchGoogleAuthConfig } from "@/lib/api/auth"
import { mountGoogleSignInButton } from "@/lib/auth/googleSignIn"

type GoogleSignInButtonProps = {
  disabled?: boolean
  onCredential: (idToken: string) => void
  onLoadError?: () => void
}

export function GoogleSignInButton({
  disabled = false,
  onCredential,
  onLoadError,
}: GoogleSignInButtonProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const [clientId, setClientId] = useState<string | null>(null)
  const [status, setStatus] = useState<"loading" | "ready" | "missing" | "error">(
    "loading"
  )
  const [errorHint, setErrorHint] = useState("")

  // Stable callbacks — parents often pass inline functions.
  const onCredentialEvent = useEffectEvent((token: string) => {
    onCredential(token)
  })
  const onLoadErrorEvent = useEffectEvent(() => {
    onLoadError?.()
  })

  useEffect(() => {
    let cancelled = false
    void fetchGoogleAuthConfig()
      .then((config) => {
        if (cancelled) return
        const id = config.google_client_id?.trim() || ""
        if (!id) {
          setClientId(null)
          setStatus("missing")
          return
        }
        setClientId(id)
        setStatus("ready")
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setStatus("error")
        setErrorHint(
          err instanceof Error ? err.message : "Could not reach /auth/google/config"
        )
        onLoadErrorEvent()
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (disabled || status !== "ready" || !clientId) return
    const parent = hostRef.current
    if (!parent) return

    let cancelled = false
    let cleanup: (() => void) | undefined

    void mountGoogleSignInButton(parent, clientId, (token) => {
      if (!cancelled) onCredentialEvent(token)
    })
      .then((unmount) => {
        if (cancelled) unmount()
        else cleanup = unmount
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setStatus("error")
          setErrorHint(
            err instanceof Error ? err.message : "Google script failed to load"
          )
          onLoadErrorEvent()
        }
      })

    return () => {
      cancelled = true
      cleanup?.()
    }
  }, [disabled, status, clientId])

  if (disabled) return null

  return (
    <>
      <div className="flex items-center gap-3 text-xs text-white/40">
        <span className="h-px flex-1 bg-white/15" />
        OR
        <span className="h-px flex-1 bg-white/15" />
      </div>
      {status === "missing" ? (
        <p className="text-center text-xs text-white/45">
          Google sign-in is not configured (API missing GOOGLE_CLIENT_ID).
        </p>
      ) : status === "error" ? (
        <p className="text-center text-xs text-red-300/80">
          Could not load Google sign-in
          {errorHint ? ` (${errorHint})` : ""}.
        </p>
      ) : (
        <div
          ref={hostRef}
          className="flex min-h-10 w-full justify-center overflow-hidden [&_iframe]:max-w-full"
          aria-label="Continue with Google"
        />
      )}
    </>
  )
}
