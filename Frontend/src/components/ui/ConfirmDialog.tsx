/**
 * In-app confirm dialog (replaces window.confirm for destructive actions).
 */

import { useEffect } from "react"
import { createPortal } from "react-dom"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export type ConfirmDialogProps = {
  open: boolean
  title: string
  description: string
  confirmLabel?: string
  cancelLabel?: string
  /** Danger styling for delete / irreversible actions. */
  tone?: "default" | "danger"
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "default",
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  useEffect(() => {
    if (!open) return
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !busy) onCancel()
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [open, busy, onCancel])

  if (!open || typeof document === "undefined") return null

  return createPortal(
    <div
      className="fixed inset-0 z-[140] flex items-center justify-center bg-black/75 p-4"
      role="presentation"
      onClick={() => {
        if (!busy) onCancel()
      }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-desc"
        className="w-full max-w-md border border-cyan-500/35 bg-black/95 p-5 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <h2
          id="confirm-dialog-title"
          className="font-buahs93 text-sm tracking-wide text-cyan-100"
        >
          {title}
        </h2>
        <p
          id="confirm-dialog-desc"
          className="mt-2 font-mono text-[11px] leading-relaxed text-cyan-100/65"
        >
          {description}
        </p>
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <Button
            type="button"
            disabled={busy}
            className="font-buahs93 h-9 rounded-none border border-cyan-500/35 bg-black/70 px-4 text-sm text-cyan-100 hover:border-cyan-400/60 hover:bg-cyan-500/10"
            onClick={onCancel}
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            disabled={busy}
            className={cn(
              "font-buahs93 h-9 rounded-none px-4 text-sm text-white disabled:opacity-60",
              tone === "danger"
                ? "bg-red-800 hover:bg-red-700"
                : "bg-cyan-700 hover:bg-cyan-900"
            )}
            onClick={onConfirm}
          >
            {busy ? "Working…" : confirmLabel}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  )
}
