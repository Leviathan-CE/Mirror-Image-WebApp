/**
 * Settings danger zone: type your username, then permanently delete.
 */

import { useCallback, useState } from "react"
import { createPortal } from "react-dom"
import { useNavigate } from "react-router-dom"

import { useAuth } from "@/app/providers/AuthProvider"
import { Button } from "@/components/ui/button"
import { EditBox } from "@/components/ui/EditBox"
import { ApiError } from "@/lib/api/client"
import { deleteAccountRequest } from "@/lib/api/auth"
import { ROUTES } from "@/lib/route"
import { cn } from "@/lib/utils"
import {
  deleteAccountErrorText,
  deleteUsernameMatches,
} from "@/pages/account/deleteAccount.logic"

const dangerButtonClassName =
  "font-buahs93 h-9 rounded-none border border-red-500/60 bg-red-900 px-5 text-sm text-red-50 hover:bg-red-800 disabled:opacity-60"

const cancelButtonClassName =
  "font-buahs93 h-9 rounded-none border border-cyan-500/35 bg-black/70 px-4 text-sm text-cyan-100 hover:border-cyan-400/60 hover:bg-cyan-500/10"

export function DeleteAccountPanel() {
  const navigate = useNavigate()
  const { user, token, clearSession } = useAuth()
  const [open, setOpen] = useState(false)
  const [typedName, setTypedName] = useState("")
  const [busy, setBusy] = useState(false)
  const [errorText, setErrorText] = useState("")

  const actualName = user?.user_name ?? ""
  const canConfirm = deleteUsernameMatches(typedName, actualName)

  const close = useCallback(() => {
    if (busy) return
    setOpen(false)
    setTypedName("")
    setErrorText("")
  }, [busy])

  async function onConfirm() {
    if (!token || !canConfirm) return
    setBusy(true)
    setErrorText("")
    try {
      await deleteAccountRequest(token, typedName)
      clearSession()
      navigate(ROUTES.HOME, { replace: true })
    } catch (error: unknown) {
      setBusy(false)
      const detail = error instanceof ApiError ? error.detail : ""
      setErrorText(deleteAccountErrorText(detail))
    }
  }

  return (
    <section className="mt-6 border border-red-500/35 bg-black/50 p-5">
      <h2 className="font-buahs93 text-sm tracking-wide text-red-200">
        DELETE ACCOUNT
      </h2>
      <p className="mt-1 font-mono text-[11px] leading-relaxed text-red-100/70">
        Permanent. Cancels any Stripe subscription immediately, deletes decks
        you own and their cards, and removes this login. This cannot be undone.
      </p>
      <div className="mt-4">
        <Button
          type="button"
          className={dangerButtonClassName}
          onClick={() => setOpen(true)}
        >
          DELETE ACCOUNT
        </Button>
      </div>

      {open && typeof document !== "undefined"
        ? createPortal(
            <div
              className="fixed inset-0 z-[140] flex items-center justify-center bg-black/75 p-4"
              role="presentation"
              onClick={close}
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
                  CONFIRM DELETE
                </h3>
                <p className="mt-2 font-mono text-[11px] leading-relaxed text-red-100/70">
                  Type your username{" "}
                  <span className="text-red-100">{actualName}</span> exactly.
                  Stripe billing stops now. Owned decks and this account are
                  removed. Cancel to keep everything.
                </p>
                <label className="mt-4 flex flex-col gap-1">
                  <span className="font-mono text-[10px] uppercase text-white/45">
                    Username
                  </span>
                  <EditBox
                    value={typedName}
                    onChange={(event) => setTypedName(event.target.value)}
                    autoComplete="off"
                    disabled={busy}
                  />
                </label>
                {errorText ? (
                  <p className="mt-3 font-mono text-xs text-red-300" role="alert">
                    {errorText}
                  </p>
                ) : null}
                <div className="mt-5 flex flex-wrap justify-end gap-2">
                  <Button
                    type="button"
                    className={cancelButtonClassName}
                    disabled={busy}
                    onClick={close}
                  >
                    CANCEL
                  </Button>
                  <Button
                    type="button"
                    className={cn(dangerButtonClassName, "border-red-400")}
                    disabled={busy || !canConfirm}
                    onClick={() => void onConfirm()}
                  >
                    {busy ? "DELETING…" : "CONFIRM DELETE"}
                  </Button>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </section>
  )
}
