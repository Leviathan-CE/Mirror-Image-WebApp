/**
 * Staff printout options: page preview, duplex backs, margin, file name.
 */

import { useCallback, useEffect, useState } from "react"
import { createPortal } from "react-dom"

import {
  PRINTOUT_COLS,
  PRINTOUT_GAP_MM,
  PRINTOUT_MARGIN_DEFAULT_MM,
  PRINTOUT_MARGIN_MAX_MM,
  PRINTOUT_MARGIN_MIN_MM,
  PRINTOUT_PAGE_H_MM,
  PRINTOUT_PAGE_W_MM,
  PRINTOUT_PER_PAGE,
  computePrintoutGridLayout,
  defaultPrintoutFileName,
  printoutPageCount,
  type DeckPrintoutSlot,
} from "@/components/decks/deckPrintout.logic"
import { Button } from "@/components/ui/button"
import { EditBox } from "@/components/ui/EditBox"
import { cardFaceUrl } from "@/lib/api/decks"

const PREVIEW_PAGE_W_PX = 220

export type DeckPrintoutDialogOptions = {
  includeBacks: boolean
  marginMm: number
  fileName: string
}

export type DeckPrintoutDialogProps = {
  open: boolean
  slots: DeckPrintoutSlot[]
  deckName: string
  cardBackSrc: string | null
  busy: boolean
  onCancel: () => void
  onGenerate: (options: DeckPrintoutDialogOptions) => void
}

function PrintoutSheetPreview({
  slots,
  pageIndex,
  marginMm,
  cardBackSrc,
  showBacks,
}: {
  slots: DeckPrintoutSlot[]
  pageIndex: number
  marginMm: number
  cardBackSrc: string | null
  showBacks: boolean
}) {
  const layout = computePrintoutGridLayout(marginMm)
  const scale = PREVIEW_PAGE_W_PX / PRINTOUT_PAGE_W_MM
  const start = pageIndex * PRINTOUT_PER_PAGE
  const pageSlots = slots.slice(start, start + PRINTOUT_PER_PAGE)

  return (
    <div
      className="relative shrink-0 bg-zinc-200 shadow-inner"
      style={{
        width: PRINTOUT_PAGE_W_MM * scale,
        height: PRINTOUT_PAGE_H_MM * scale,
      }}
    >
      {pageSlots.map((slot, indexOnPage) => {
        const col = indexOnPage % PRINTOUT_COLS
        const row = Math.floor(indexOnPage / PRINTOUT_COLS)
        const x =
          (layout.originX + col * (layout.cardW + PRINTOUT_GAP_MM)) * scale
        const y =
          (layout.originY + row * (layout.cardH + PRINTOUT_GAP_MM)) * scale
        const src = showBacks ? cardBackSrc : cardFaceUrl(slot)
        const label = showBacks ? "Card back" : slot.card_name
        return (
          <div
            key={`${slot.section}-${slot.card_id}-${start + indexOnPage}`}
            className="absolute overflow-hidden bg-black/80"
            style={{
              left: x,
              top: y,
              width: layout.cardW * scale,
              height: layout.cardH * scale,
            }}
          >
            {src ? (
              <img
                src={src}
                alt={label}
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="block p-0.5 font-mono text-[7px] leading-tight text-cyan-100/80">
                {label}
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}

export function DeckPrintoutDialog({
  open,
  slots,
  deckName,
  cardBackSrc,
  busy,
  onCancel,
  onGenerate,
}: DeckPrintoutDialogProps) {
  const [includeBacks, setIncludeBacks] = useState(true)
  const [marginMm, setMarginMm] = useState(PRINTOUT_MARGIN_DEFAULT_MM)
  const [fileName, setFileName] = useState("")
  const [previewPage, setPreviewPage] = useState(0)

  useEffect(() => {
    if (!open) return
    setIncludeBacks(Boolean(cardBackSrc))
    setMarginMm(PRINTOUT_MARGIN_DEFAULT_MM)
    setFileName(defaultPrintoutFileName(deckName))
    setPreviewPage(0)
  }, [open, deckName, cardBackSrc])

  useEffect(() => {
    if (!open) return
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !busy) onCancel()
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [open, busy, onCancel])

  const facePages = printoutPageCount(slots.length)
  const lastPage = Math.max(0, facePages - 1)

  const goPrevPage = useCallback(() => {
    setPreviewPage((page) => Math.max(0, page - 1))
  }, [])

  const goNextPage = useCallback(() => {
    setPreviewPage((page) => Math.min(lastPage, page + 1))
  }, [lastPage])

  const submit = useCallback(() => {
    if (busy) return
    const name = fileName.trim()
    if (!name) return
    if (includeBacks && !cardBackSrc) return
    onGenerate({ includeBacks, marginMm, fileName: name })
  }, [busy, fileName, includeBacks, cardBackSrc, marginMm, onGenerate])

  if (!open || typeof document === "undefined") return null
  if (facePages === 0) return null

  return createPortal(
    <div
      className="fixed inset-0 z-[140] flex items-center justify-center bg-black/75 p-4"
      role="presentation"
      onClick={() => {
        if (!busy) onCancel()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="printout-dialog-title"
        className="max-h-[92vh] w-full max-w-3xl overflow-y-auto border border-cyan-500/35 bg-black/95 p-5 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <h2
          id="printout-dialog-title"
          className="font-buahs93 text-sm tracking-wide text-cyan-100"
        >
          Print deck
        </h2>
        <p className="mt-1 font-mono text-[11px] text-cyan-100/65">
          {slots.length} card{slots.length === 1 ? "" : "s"} · {facePages} face
          sheet{facePages === 1 ? "" : "s"}
          {includeBacks ? " · matching back sheet after each page" : ""}
        </p>

        <div className="mt-4 flex flex-col gap-5 md:flex-row">
          <div className="flex flex-col items-center gap-2">
            <div className="flex items-start gap-3">
              <PrintoutSheetPreview
                slots={slots}
                pageIndex={previewPage}
                marginMm={marginMm}
                cardBackSrc={cardBackSrc}
                showBacks={false}
              />
              {includeBacks ? (
                <PrintoutSheetPreview
                  slots={slots}
                  pageIndex={previewPage}
                  marginMm={marginMm}
                  cardBackSrc={cardBackSrc}
                  showBacks
                />
              ) : null}
            </div>
            {facePages > 1 ? (
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  disabled={busy || previewPage === 0}
                  className="font-buahs93 h-8 rounded-none border border-cyan-500/35 bg-black/70 px-3 text-xs text-cyan-100"
                  onClick={goPrevPage}
                >
                  Prev
                </Button>
                <span className="font-mono text-[11px] text-cyan-100/70">
                  Page {previewPage + 1} / {facePages}
                </span>
                <Button
                  type="button"
                  disabled={busy || previewPage >= lastPage}
                  className="font-buahs93 h-8 rounded-none border border-cyan-500/35 bg-black/70 px-3 text-xs text-cyan-100"
                  onClick={goNextPage}
                >
                  Next
                </Button>
              </div>
            ) : null}
          </div>

          <div className="flex min-w-0 flex-1 flex-col gap-4">
            <label className="flex items-start gap-2 font-mono text-[11px] text-cyan-100/85">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={includeBacks}
                disabled={busy || !cardBackSrc}
                onChange={(event) => setIncludeBacks(event.target.checked)}
              />
              <span>
                Print card backs (duplex)
                {!cardBackSrc ? (
                  <span className="block text-amber-200/80">
                    Card back art is not loaded yet.
                  </span>
                ) : (
                  <span className="block text-cyan-100/50">
                    Each face sheet is followed by a mirrored back page for
                    long-edge flip.
                  </span>
                )}
              </span>
            </label>

            <label className="flex flex-col gap-1 font-mono text-[11px] text-cyan-100/85">
              Card margin ({marginMm} mm)
              <input
                type="range"
                min={PRINTOUT_MARGIN_MIN_MM}
                max={PRINTOUT_MARGIN_MAX_MM}
                step={0.5}
                value={marginMm}
                disabled={busy}
                onChange={(event) => setMarginMm(Number(event.target.value))}
              />
              <span className="text-cyan-100/50">
                Larger margin makes each card slightly smaller on the page.
              </span>
            </label>

            <label className="flex flex-col gap-1 font-mono text-[11px] text-cyan-100/85">
              File name
              <EditBox
                value={fileName}
                disabled={busy}
                onChange={(event) => setFileName(event.target.value)}
              />
            </label>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <Button
            type="button"
            disabled={busy}
            className="font-buahs93 h-9 rounded-none border border-cyan-500/35 bg-black/70 px-4 text-sm text-cyan-100 hover:border-cyan-400/60 hover:bg-cyan-500/10"
            onClick={onCancel}
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={busy || !fileName.trim()}
            className="font-buahs93 h-9 rounded-none bg-orange-600 px-4 text-sm text-white hover:bg-orange-800 disabled:opacity-60"
            onClick={submit}
          >
            {busy ? "Building PDF…" : "Create PDF"}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  )
}
