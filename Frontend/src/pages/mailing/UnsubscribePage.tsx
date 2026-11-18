/**
 * Public mailing-list / account blog-email unsubscribe confirmation.
 */

import { useEffect, useState } from "react"
import { Link, useSearchParams } from "react-router-dom"

import {
  HELP_TONE_CLASS,
  type HelpTone,
} from "@/components/auth/authFormStyles"
import { ApiError } from "@/lib/api/client"
import { unsubscribeMailingList } from "@/lib/api/mailingList"
import { ROUTES } from "@/lib/route"
import { cn } from "@/lib/utils"
import { AuthUtilityShell } from "@/pages/auth/AuthUtilityShell"

export function UnsubscribePage() {
  const [params] = useSearchParams()
  const token = params.get("token")?.trim() ?? ""
  const [tone, setTone] = useState<HelpTone>("pending")
  const [text, setText] = useState("Unsubscribing…")

  useEffect(() => {
    if (!token) {
      setTone("error")
      setText("Missing unsubscribe token.")
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const result = await unsubscribeMailingList(token)
        if (cancelled) return
        setTone("success")
        if (result.kind === "account") {
          setText(
            "Blog email notifications are off. "
              + "Turn them back on in Account settings."
          )
          return
        }
        setText("You are unsubscribed from the mailing list.")
      } catch (error) {
        if (cancelled) return
        setTone("error")
        if (error instanceof ApiError) {
          if (error.detail === "invalid_token") {
            setText("This unsubscribe link is invalid.")
            return
          }
          setText(error.detail)
          return
        }
        setText("Could not unsubscribe. Try again later.")
      }
    })()
    return () => {
      cancelled = true
    }
  }, [token])

  return (
    <AuthUtilityShell title="Unsubscribe">
      <p className={cn("font-mono text-sm", HELP_TONE_CLASS[tone])}>
        {text}
      </p>
      <p className="mt-6 font-mono text-xs text-cyan-100/60">
        <Link className="text-cyan-300 underline" to={ROUTES.HOME}>
          Back home
        </Link>
        {" · "}
        <Link className="text-cyan-300 underline" to={ROUTES.ACCOUNT}>
          Account settings
        </Link>
      </p>
    </AuthUtilityShell>
  )
}
