/**
 * Parse card keyword strings and resolve help text from How To Play definitions.
 */

import type { ReactNode } from "react"

import { findKeywordAbility } from "@/lib/howToPlay/keywords"

export type ParsedKeyword = {
  /** Display label, e.g. "Stealth GEN2". */
  label: string
  /** Lookup key used against How To Play. */
  helpKey: string
  help: ReactNode | null
  /** Raw parameter after `:`, if any. */
  param: string | null
}

export function parseKeyword(raw: string): ParsedKeyword {
  const trimmed = String(raw ?? "").trim()
  const colon = trimmed.indexOf(":")
  const namePart = (colon >= 0 ? trimmed.slice(0, colon) : trimmed).trim()
  const param = colon >= 0 ? trimmed.slice(colon + 1).trim() || null : null

  const spaced = namePart.replace(/_/g, " ").replace(/\s+/g, " ").trim()
  const ability = findKeywordAbility(spaced)
  const label = param ? `${spaced} ${param}` : spaced

  return {
    label,
    helpKey: ability?.name ?? spaced.toUpperCase(),
    help: ability?.text ?? null,
    param,
  }
}
