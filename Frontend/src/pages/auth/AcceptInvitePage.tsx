import { useState, type SubmitEvent } from "react"
import { Link, useSearchParams } from "react-router-dom"

import {
  HELP_TONE_CLASS,
  type HelpTone,
} from "@/components/auth/authFormStyles"
import { GlitchFx } from "@/components/effects/GlitchFx"
import { EditBox } from "@/components/ui/EditBox"
import { acceptInviteRequest } from "@/lib/api/email_auth"
import { ApiError } from "@/lib/api/client"
import { ROUTES } from "@/lib/route"
import { cn } from "@/lib/utils"
import { AuthUtilityShell } from "@/pages/auth/AuthUtilityShell"

export function AcceptInvitePage() {
  const [params] = useSearchParams()
  const token = params.get("token")?.trim() ?? ""
  const [userName, setUserName] = useState("")
  const [password, setPassword] = useState("")
  const [tone, setTone] = useState<HelpTone>("idle")
  const [text, setText] = useState(
    "Set your password to accept the invite (username optional)."
  )
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  async function onSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!token) {
      setTone("error")
      setText("Missing invite token.")
      return
    }
    if (password.length < 8) {
      setTone("error")
      setText("Password must be at least 8 characters.")
      return
    }
    setSubmitting(true)
    try {
      await acceptInviteRequest(token, password, userName.trim() || undefined)
      setTone("success")
      setText("Invite accepted. You can log in.")
      setDone(true)
    } catch (error) {
      setTone("error")
      setText(
        error instanceof ApiError
          ? error.detail === "invalid_or_expired_token"
            ? "This invite is invalid or expired."
            : error.detail
          : "Invite failed."
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthUtilityShell title="ACCEPT INVITE">
      {done ? (
        <>
          <p className={cn("text-sm", HELP_TONE_CLASS.success)}>{text}</p>
          <Link
            to={ROUTES.LOGIN}
            className="mt-4 inline-block text-cyan-300 underline"
          >
            GO TO LOGIN
          </Link>
        </>
      ) : (
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <EditBox
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
            placeholder="username (optional)"
            autoComplete="username"
            disabled={submitting}
          />
          <EditBox
            password
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="password"
            autoComplete="new-password"
            disabled={submitting}
          />
          <p className={cn("text-sm", HELP_TONE_CLASS[tone])}>{text}</p>
          <GlitchFx
            type="submit"
            label={submitting ? "SAVING…" : "ACCEPT INVITE"}
            disabled={submitting}
            size="lg"
            className="font-buahs93 h-10 w-full rounded-none bg-cyan-700 px-8 hover:bg-cyan-900 disabled:opacity-60"
          />
        </form>
      )}
    </AuthUtilityShell>
  )
}
