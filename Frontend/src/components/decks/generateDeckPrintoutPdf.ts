/**
 * Build a letter-size print-and-play PDF from deck card art.
 *
 * - Subscribers: faces only (3×3 per page) — no real card backs.
 * - Staff: optional duplex — each face sheet followed by a mirrored back sheet
 *   (pass `cardBackUrl` from the auth-gated card-back asset).
 */

import { jsPDF } from "jspdf"

import {
  PRINTOUT_COLS,
  PRINTOUT_GAP_MM,
  PRINTOUT_MARGIN_DEFAULT_MM,
  PRINTOUT_PAGE_H_MM,
  PRINTOUT_PAGE_W_MM,
  PRINTOUT_PER_PAGE,
  computePrintoutGridLayout,
  duplexBackIndex,
  resolvePrintoutFileName,
  type DeckPrintoutSlot,
  type PrintoutGridLayout,
} from "@/components/decks/deckPrintout.logic"
import { cardFaceUrl } from "@/lib/api/decks"

export type DeckPrintoutPdfResult = {
  missingArt: number
  fileName: string
}

function slotPosition(
  layout: PrintoutGridLayout,
  indexOnPage: number
): { x: number; y: number } {
  const col = indexOnPage % PRINTOUT_COLS
  const row = Math.floor(indexOnPage / PRINTOUT_COLS)
  return {
    x: layout.originX + col * (layout.cardW + PRINTOUT_GAP_MM),
    y: layout.originY + row * (layout.cardH + PRINTOUT_GAP_MM),
  }
}

function drawCardBorder(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  h: number
) {
  doc.setDrawColor(200, 200, 200)
  doc.setLineWidth(0.1)
  doc.rect(x, y, w, h)
}

function drawPlaceholder(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string
) {
  doc.setDrawColor(120, 120, 120)
  doc.setLineWidth(0.2)
  doc.rect(x, y, w, h)
  doc.setFont("helvetica", "normal")
  doc.setFontSize(8)
  doc.setTextColor(40, 40, 40)
  const lines = doc.splitTextToSize(label, w - 4)
  doc.text(lines, x + 2, y + 6)
}

function imageFormat(dataUrl: string): "PNG" | "JPEG" {
  return dataUrl.includes("image/png") ? "PNG" : "JPEG"
}

async function loadImageDataUrl(url: string): Promise<string | null> {
  try {
    const response = await fetch(url)
    if (!response.ok) return null
    const blob = await response.blob()
    return await new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result))
      reader.onerror = () => reject(reader.error)
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

export async function generateDeckPrintoutPdf(opts: {
  deckName: string
  slots: DeckPrintoutSlot[]
  /**
   * When set and `includeBacks` is true, append duplex back sheets.
   * When omitted, faces only.
   */
  cardBackUrl?: string | null
  includeBacks?: boolean
  marginMm?: number
  fileName?: string
}): Promise<DeckPrintoutPdfResult> {
  const { deckName, slots, cardBackUrl } = opts
  const includeBacks = opts.includeBacks ?? Boolean(cardBackUrl)
  const layout = computePrintoutGridLayout(
    opts.marginMm ?? PRINTOUT_MARGIN_DEFAULT_MM
  )
  const fileName = resolvePrintoutFileName(opts.fileName, deckName)
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: [PRINTOUT_PAGE_W_MM, PRINTOUT_PAGE_H_MM],
  })

  if (slots.length === 0) {
    doc.save(fileName)
    return { missingArt: 0, fileName }
  }

  const backDataUrl =
    includeBacks && cardBackUrl ? await loadImageDataUrl(cardBackUrl) : null
  let missingArt = 0

  for (let pageStart = 0; pageStart < slots.length; pageStart += PRINTOUT_PER_PAGE) {
    if (pageStart > 0) doc.addPage()

    const pageSlots = slots.slice(pageStart, pageStart + PRINTOUT_PER_PAGE)

    for (let i = 0; i < pageSlots.length; i++) {
      const slot = pageSlots[i]!
      const { x, y } = slotPosition(layout, i)
      const artUrl = cardFaceUrl(slot)
      let drawn = false

      if (artUrl) {
        const dataUrl = await loadImageDataUrl(artUrl)
        if (dataUrl) {
          doc.addImage(
            dataUrl,
            imageFormat(dataUrl),
            x,
            y,
            layout.cardW,
            layout.cardH
          )
          drawn = true
        }
      }

      if (!drawn) {
        missingArt += 1
        drawPlaceholder(doc, x, y, layout.cardW, layout.cardH, slot.card_name)
      }

      drawCardBorder(doc, x, y, layout.cardW, layout.cardH)
    }

    if (!includeBacks) continue

    doc.addPage()
    for (let i = 0; i < pageSlots.length; i++) {
      const { x, y } = slotPosition(layout, duplexBackIndex(i, PRINTOUT_COLS))
      if (backDataUrl) {
        doc.addImage(
          backDataUrl,
          imageFormat(backDataUrl),
          x,
          y,
          layout.cardW,
          layout.cardH
        )
      } else {
        drawPlaceholder(doc, x, y, layout.cardW, layout.cardH, "Card back")
      }
      drawCardBorder(doc, x, y, layout.cardW, layout.cardH)
    }
  }

  doc.save(fileName)
  return { missingArt, fileName }
}
