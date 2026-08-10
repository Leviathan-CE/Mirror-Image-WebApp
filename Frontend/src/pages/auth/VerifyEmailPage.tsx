import { useEffect, useState } from "react"
import { Link, useSearchParams } from "react-router-dom"

import {
  HELP_TONE_CLASS,
  type HelpTone,
} from "@/components/auth/authFormStyles"
import { verifyEmailRequest } from "@/lib/api/email_auth"
import { ApiError } from "@/lib/api/client"
import { ROUTES } from "@/lib/route"
import { cn } from "@/lib/utils"
import { AuthUtilityShell } from "@/pages/auth/AuthUtilityShell"

export function VerifyEmailPage() {
  const [params] = useSearchParams()
  const token = params.get("token")?.trim() ?? ""
  const [tone, setTone] = useState<HelpTone>("pending")
  const [text, setText] = useState("Verifying your email…")

  useEffect(() => {
    if (!token) {
      setTone("error")
      setText("Missing verification token.")
      return
    }
    let cancelled = false
    void (async () => {
      try {
        await verifyEmailRequest(token)
        if (!cancelled) {
          setTone("success")
          setText("Email verified. You can log in now.")
        }
      } catch (error) {
        if (cancelled) return
        setTone("error")
        setText(
          error instanceof ApiError
            ? error.detail === "invalid_or_expired_token"
              ? "This link is invalid or expired."
              : error.detail
            : "Verification failed."
        )
      }
    })()
    return () => {
      cancelled = true
    }
  }, [token])

  return (
    <AuthUtilityShell title="VERIFY EMAIL">
      <p className={cn("text-sm", HELP_TONE_CLASS[tone])}>{text}</p>
      <Link
        to={ROUTES.LOGIN}
        className="mt-4 inline-block text-cyan-300 underline hover:text-cyan-200"
      >
        GO TO LOGIN
      </Link>
    </AuthUtilityShell>
  )
}
