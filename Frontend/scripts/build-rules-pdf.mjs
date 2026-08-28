/**
 * Builds public/docs/Rules.pdf from Rules.md by expanding icon placeholders
 * (e.g. `[EXPEND]`) into inline images, then rendering with md-to-pdf.
 *
 * Placeholder → file mapping mirrors GameIcon.tsx (public/images/icons),
 * except TLV which uses TLV-pdf.png for print contrast on white paper.
 */
import { readFileSync, mkdirSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { mdToPdf } from "md-to-pdf"

const __dirname = dirname(fileURLToPath(import.meta.url))
const FRONTEND_ROOT = join(__dirname, "..")
const RULES_MD = join(FRONTEND_ROOT, "public/docs/Rules.md")
const RULES_PDF = join(FRONTEND_ROOT, "public/docs/Rules.pdf")
const ICONS_DIR = join(FRONTEND_ROOT, "public/images/icons")
const STYLESHEET = join(__dirname, "rules-pdf.css")

/** @type {Record<string, { file: string; shape?: "tag" | "token" }>} */
const PLACEHOLDER_TO_ICON = {
  EXPEND: { file: "EX.png" },
  TLV: { file: "TLV-pdf.png" },
  "HAND SIZE": { file: "HS.png" },
  HP: { file: "HP.png" },
  RECYCLE: { file: "RE.png" },
  TRASH: { file: "tr.png" },
  DISMANTLE: { file: "DIS.png" },
  RAM: { file: "Costs/RAM.png" },
  LIF: { file: "Costs/LIF.png" },
  MET: { file: "Costs/MET.png" },
  POW: { file: "Costs/POW.png" },
  STL: { file: "Costs/STL.png" },
  TIM: { file: "Costs/TIM.png" },
  "LIF-MET": { file: "Costs/LIF-MET.png" },
  "LIF-POW": { file: "Costs/LIF-POW.png" },
  "LIF-RAM": { file: "Costs/LIF-RAM.png" },
  "LIF-STL": { file: "Costs/LIF-STL.png" },
  "LIF-TIM": { file: "Costs/LIF-TIM.png" },
  "MET-STL": { file: "Costs/MET-STL.png" },
  "MET-TIM": { file: "Costs/MET-TIM.png" },
  "POW-MET": { file: "Costs/POW-MET.png" },
  "POW-RAM": { file: "Costs/POW-RAM.png" },
  "POW-STL": { file: "Costs/POW-STL.png" },
  "POW-TIM": { file: "Costs/POW-TIM.png" },
  "RAM-MET": { file: "Costs/RAM-MET.png" },
  "RAM-STL": { file: "Costs/RAM-STL.png" },
  "RAM-TIM": { file: "Costs/RAM-TIM.png" },
  "STL-TIM": { file: "Costs/STL-TIM.png" },
  MULTI: { file: "Costs/MULTI.png" },
  GEN: { file: "Costs/GEN-X.png" },
  GEN0: { file: "Costs/GEN-0.png" },
  GEN1: { file: "Costs/GEN-1.png" },
  GEN2: { file: "Costs/GEN-2.png" },
  GEN3: { file: "Costs/GEN3.png" },
  GEN4: { file: "Costs/GEN4.png" },
  GEN5: { file: "Costs/GEN5.png" },
  GEN6: { file: "Costs/GEN6.png" },
  GEN7: { file: "Costs/GEN7.png" },
  GEN8: { file: "Costs/GEN8.png" },
  GEN9: { file: "Costs/GEN9.png" },
  GEN10: { file: "Costs/GEN-10.png" },
  GENX: { file: "Costs/GEN-X.png" },

  // Timing / trigger tags (keywords/).
  ATOMIC: { file: "keywords/ATOMIC.png", shape: "tag" },
  "ENTERS PLAY": { file: "keywords/enters play.png", shape: "tag" },
  "ENTERS BATTLEFIELD": { file: "keywords/battlefield.png", shape: "tag" },
  "ENTERS STOCKPILE": { file: "keywords/stockpile.png", shape: "tag" },
  ATTACK: { file: "keywords/attack trigger.png", shape: "tag" },
  "ON ATTACK": { file: "keywords/attack trigger.png", shape: "tag" },
  START: { file: "keywords/START.png", shape: "tag" },
  "START OF TURN": { file: "keywords/START.png", shape: "tag" },
  "END TURN": { file: "keywords/end of turn.png", shape: "tag" },
  "END OF TURN": { file: "keywords/end of turn.png", shape: "tag" },
  INVOKE: { file: "keywords/invoke.png", shape: "tag" },
  IF: { file: "keywords/IF.png", shape: "tag" },
  CONDITIONAL: { file: "keywords/IF.png", shape: "tag" },
  STATIC: { file: "keywords/static.png", shape: "tag" },
  EFFECT: { file: "keywords/Effect.png", shape: "tag" },
  DEFEATED: { file: "keywords/defeated.png", shape: "tag" },
  "ON DEFEAT": { file: "keywords/defeated.png", shape: "tag" },
}

function iconTagToIcon(tag) {
  const key = tag.trim().toUpperCase().replace(/\s+/g, " ")
  return PLACEHOLDER_TO_ICON[key] ?? null
}

function iconImgHtml(tag) {
  const icon = iconTagToIcon(tag)
  if (!icon) {
    return null
  }

  const absPath = join(ICONS_DIR, icon.file)
  const ext = icon.file.split(".").pop()?.toLowerCase() ?? "png"
  const mime = ext === "jpg" || ext === "jpeg" ? "image/jpeg" : "image/png"
  const base64 = readFileSync(absPath).toString("base64")
  const src = `data:${mime};base64,${base64}`
  const alt = tag.trim()

  if (icon.shape === "tag") {
    return `<img src="${src}" alt="${alt}" class="rule-tag" />`
  }

  return `<img src="${src}" alt="${alt}" class="rule-icon" />`
}

/** Only replaces backtick-wrapped placeholders like `[EXPEND]`. */
function expandIconPlaceholders(markdown) {
  const unknown = new Set()

  const expanded = markdown.replace(/`\[([^\]]+)\]`/g, (match, rawTag) => {
    const html = iconImgHtml(rawTag)
    if (!html) {
      unknown.add(rawTag)
      return match
    }
    return html
  })

  if (unknown.size > 0) {
    console.warn(
      "Unknown icon placeholders (left as text):",
      [...unknown].sort().join(", ")
    )
  }

  return expanded
}

async function main() {
  const markdown = readFileSync(RULES_MD, "utf8")
  const content = expandIconPlaceholders(markdown)
  const css = readFileSync(STYLESHEET, "utf8")

  mkdirSync(dirname(RULES_PDF), { recursive: true })

  console.log("Rendering Rules.pdf…")
  await mdToPdf(
    { content },
    {
      dest: RULES_PDF,
      css,
      pdf_options: {
        format: "Letter",
        printBackground: true,
        margin: {
          top: "18mm",
          right: "16mm",
          bottom: "18mm",
          left: "16mm",
        },
      },
      launch_options: {
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
      },
    }
  )

  console.log(`Wrote ${RULES_PDF}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
