/**
 * Build a letter-size print-and-play PDF from deck card art.
 */

import { jsPDF } from "jspdf"

import type { DeckPrintoutSlot } from "@/components/decks/deckPrintout.logic"
import { cardArtUrl } from "@/lib/api/decks"

const PAGE_W_MM = 215.9
const PAGE_H_MM = 279.4
/** Minimal printable inset — keeps cards as large as possible on letter paper. */
const MARGIN_MM = 5
const COLS = 3
const ROWS = 3
/** Hairline between cuts; borders are drawn on each card. */
const GAP_MM = 0.5
/** Card height ÷ width (3:4 portrait, matches deck board 240×320). */
const CARD_ASPECT = 4 / 3

export type DeckPrintoutPdfResult = {
  missingArt: number
}

type GridLayout = {
  cardW: number
  cardH: number
  originX: number
  originY: number
}

function computeGridLayout(): GridLayout {
  const usableW = PAGE_W_MM - MARGIN_MM * 2
  const usableH = PAGE_H_MM - MARGIN_MM * 2
  const maxWFromWidth = (usableW - GAP_MM * (COLS - 1)) / COLS
  const maxHFromHeight = (usableH - GAP_MM * (ROWS - 1)) / ROWS

  let cardW = maxWFromWidth
  let cardH = cardW * CARD_ASPECT
  if (cardH > maxHFromHeight) {
    cardH = maxHFromHeight
    cardW = cardH / CARD_ASPECT
  }

  const gridW = cardW * COLS + GAP_MM * (COLS - 1)
  const gridH = cardH * ROWS + GAP_MM * (ROWS - 1)
  return {
    cardW,
    cardH,
    originX: (PAGE_W_MM - gridW) / 2,
    originY: (PAGE_H_MM - gridH) / 2,
  }
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

function slotPosition(
  layout: GridLayout,
  indexOnPage: number
): { x: number; y: number } {
  const col = indexOnPage % COLS
  const row = Math.floor(indexOnPage / COLS)
  return {
    x: layout.originX + col * (layout.cardW + GAP_MM),
    y: layout.originY + row * (layout.cardH + GAP_MM),
  }
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

function safeFileName(name: string): string {
  return name.replace(/[^\w\-]+/g, "_").replace(/_+/g, "_").slice(0, 80)
}

export async function generateDeckPrintoutPdf(opts: {
  deckName: string
  slots: DeckPrintoutSlot[]
}): Promise<DeckPrintoutPdfResult> {
  const { deckName, slots } = opts
  const layout = computeGridLayout()
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "letter" })

  if (slots.length === 0) {
    doc.save(`${safeFileName(deckName || "deck")}_printout.pdf`)
    return { missingArt: 0 }
  }

  let missingArt = 0
  let indexOnPage = 0

  for (const slot of slots) {
    if (indexOnPage === COLS * ROWS) {
      doc.addPage()
      indexOnPage = 0
    }

    const { x, y } = slotPosition(layout, indexOnPage)
    const artUrl = cardArtUrl(slot.card_art_path, slot.card_art_version)
    let drawn = false

    if (artUrl) {
      const dataUrl = await loadImageDataUrl(artUrl)
      if (dataUrl) {
        const format = dataUrl.includes("image/png") ? "PNG" : "JPEG"
        doc.addImage(dataUrl, format, x, y, layout.cardW, layout.cardH)
        drawn = true
      }
    }

    if (!drawn) {
      missingArt += 1
      drawPlaceholder(doc, x, y, layout.cardW, layout.cardH, slot.card_name)
    }

    doc.setDrawColor(200, 200, 200)
    doc.setLineWidth(0.1)
    doc.rect(x, y, layout.cardW, layout.cardH)

    indexOnPage += 1
  }

  const fileName = `${safeFileName(deckName || "deck")}_printout.pdf`
  doc.save(fileName)

  return { missingArt }
}
