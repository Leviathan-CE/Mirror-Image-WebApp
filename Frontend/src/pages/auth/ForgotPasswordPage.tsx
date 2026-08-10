import { useState, type SubmitEvent } from "react"
import { Link } from "react-router-dom"

import {
  HELP_TONE_CLASS,
  type HelpTone,
} from "@/components/auth/authFormStyles"
import { GlitchFx } from "@/components/effects/GlitchFx"
import { EditBox } from "@/components/ui/EditBox"
import { forgotPasswordRequest } from "@/lib/api/email_auth"
import { ApiError } from "@/lib/api/client"
import { ROUTES } from "@/lib/route"
import { cn } from "@/lib/utils"
import { AuthUtilityShell } from "@/pages/auth/AuthUtilityShell"

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [tone, setTone] = useState<HelpTone>("idle")
  const [text, setText] = useState(
    "Enter your account email. If it exists, we will send a reset link."
  )
  const [submitting, setSubmitting] = useState(false)

  async function onSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!email.trim()) {
      setTone("error")
      setText("Email is required.")
      return
    }
    setSubmitting(true)
    try {
      await forgotPasswordRequest(email.trim())
      setTone("success")
      setText("If that account can reset, a link was sent.")
    } catch (error) {
      setTone("error")
      setText(
        error instanceof ApiError ? error.detail : "Request failed."
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthUtilityShell title="FORGOT PASSWORD">
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <EditBox
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="email"
          autoComplete="email"
          disabled={submitting}
        />
        <p className={cn("text-sm", HELP_TONE_CLASS[tone])}>{text}</p>
        <GlitchFx
          type="submit"
          label={submitting ? "SENDING…" : "SEND RESET LINK"}
          disabled={submitting}
          size="lg"
          className="font-buahs93 h-10 w-full rounded-none bg-cyan-700 px-8 hover:bg-cyan-900 disabled:opacity-60"
        />
        <Link
          to={ROUTES.LOGIN}
          className="text-center text-sm text-cyan-300 underline"
        >
          BACK TO LOGIN
        </Link>
      </form>
    </AuthUtilityShell>
  )
}
