/**
 * Settings danger zone: type your username to permanently delete the account.
 */

import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"

import { useAuth } from "@/app/providers/AuthProvider"
import { GlitchFx } from "@/components/effects/GlitchFx"
import { Button } from "@/components/ui/button"
import { ApiError } from "@/lib/api/client"
import { deleteAccount } from "@/lib/api/auth"
import { ROUTES } from "@/lib/route"
import {
  canConfirmAccountDelete,
  deleteAccountHelp,
} from "@/pages/account/deleteAccount.logic"

const fieldClassName =
  "font-buahs93 h-8 rounded-none border border-red-500/35 bg-black/80 px-2 text-xs tracking-wide text-cyan-100 outline-none hover:border-red-400/50 focus-visible:border-red-400"

export function DeleteAccountPanel() {
  const navigate = useNavigate()
  const { token, user, clearSession } = useAuth()
  const [open, setOpen] = useState(false)
  const [typedName, setTypedName] = useState("")
  const [help, setHelp] = useState("")
  const [busy, setBusy] = useState(false)

  if (!token || !user) return null
  const accessToken = token

  const userName = user.user_name
  const canDelete = canConfirmAccountDelete(typedName, userName)

  function closeDialog() {
    if (busy) return
    setOpen(false)
    setTypedName("")
    setHelp("")
  }

  useEffect(() => {
    if (!open) return
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !busy) closeDialog()
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [open, busy])

  async function confirmDelete() {
    if (!canDelete) {
      setHelp("Type your username exactly to confirm.")
      return
    }
    setBusy(true)
    setHelp("")
    try {
      await deleteAccount(accessToken, userName)
      clearSession()
      navigate(ROUTES.HOME, { replace: true })
    } catch (error) {
      setHelp(
        error instanceof ApiError
          ? deleteAccountHelp(error.detail)
          : "Could not reach the server."
      )
      setBusy(false)
    }
  }

  return (
    <section className="mt-6 border border-red-500/30 bg-black/50 p-5">
      <h2 className="font-buahs93 text-sm tracking-wide text-red-200">
        DELETE ACCOUNT
      </h2>
      <p className="mt-1 font-mono text-[11px] text-cyan-100/45">
        Permanent. This cannot be undone.
      </p>
      <GlitchFx
        type="button"
        label="DELETE MY ACCOUNT"
        className="font-buahs93 mt-4 h-9 rounded-none border border-red-500/50 bg-black/70 px-5 text-red-200 hover:border-red-400 hover:bg-red-500/10"
        onClick={() => {
          setTypedName("")
          setHelp("")
          setOpen(true)
        }}
      />

      {open ? (
        <div
          className="fixed inset-0 z-[140] flex items-center justify-center bg-black/75 p-4"
          role="presentation"
          onClick={closeDialog}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-account-title"
            className="w-full max-w-md border border-red-500/40 bg-black/95 p-5 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <h3
              id="delete-account-title"
              className="font-buahs93 text-sm tracking-wide text-red-200"
            >
              DELETE THIS ACCOUNT?
            </h3>
            <p className="mt-2 font-mono text-[11px] leading-relaxed text-cyan-100/65">
              This permanently removes <span className="text-cyan-200">{userName}</span>{" "}
              and everything on it:
            </p>
            <ul className="mt-2 list-disc pl-5 font-mono text-[11px] leading-relaxed text-cyan-100/65">
              <li>all public and private decks</li>
              <li>likes, tags, and account preferences</li>
              <li>login, email, and two-factor settings</li>
              <li>any paid subscription — canceled immediately, no more charges</li>
            </ul>
            <p className="mt-3 font-mono text-[11px] text-red-200/80">
              Type <span className="text-cyan-200">{userName}</span> to confirm.
            </p>
            <label className="mt-2 flex flex-col gap-1">
              <span className="font-mono text-[10px] tracking-wide text-red-300/70">
                USERNAME
              </span>
              <input
                autoComplete="off"
                spellCheck={false}
                value={typedName}
                disabled={busy}
                className={fieldClassName}
                onChange={(event) => setTypedName(event.target.value)}
              />
            </label>
            {help ? (
              <p role="status" className="mt-3 font-mono text-[11px] text-red-200/80">
                {help}
              </p>
            ) : null}
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <Button
                type="button"
                disabled={busy}
                className="font-buahs93 h-9 rounded-none border border-cyan-500/35 bg-black/70 px-4 text-sm text-cyan-100 hover:border-cyan-400/60 hover:bg-cyan-500/10"
                onClick={closeDialog}
              >
                CANCEL
              </Button>
              <Button
                type="button"
                disabled={busy || !canDelete}
                className="font-buahs93 h-9 rounded-none bg-red-800 px-4 text-sm text-white hover:bg-red-700 disabled:opacity-60"
                onClick={() => void confirmDelete()}
              >
                {busy ? "DELETING…" : "DELETE FOREVER"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}
