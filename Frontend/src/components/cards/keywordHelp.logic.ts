/**
 * Parse card keyword strings and resolve help text from How To Play definitions.
 */

import type { ReactNode } from "react"

import { findKeywordAbility } from "@/lib/howToPlay/keywords"

export type ParsedKeyword = {
  /** Keyword name without the cost, e.g. "Stealth". */
  name: string
  /** Plain-text label, e.g. "Stealth GEN2". */
  label: string
  /** Lookup key used against How To Play. */
  helpKey: string
  help: ReactNode | null
  /** Raw parameter after `:`, if any. */
  param: string | null
  /**
   * Cost pieces after `:`, split on `+`.
   * "LIF+LIF" is two Life icons, not the letters LIF.
   */
  paramTokens: string[]
}

export type HelpXSplit = {
  before: string
  after: string
}

/**
 * Split reminder text at the standalone X.
 * Card details swap that X for the keyword's cost icons.
 */
export function splitHelpAtX(help: ReactNode | null): HelpXSplit | null {
  if (typeof help !== "string") return null
  const match = help.match(/\bX\b/)
  if (match == null) return null
  if (match.index == null) return null
  const at = match.index
  return {
    before: help.slice(0, at),
    after: help.slice(at + 1),
  }
}

function splitParam(param: string | null): string[] {
  if (param == null) return []
  const tokens: string[] = []
  for (const part of param.split("+")) {
    const token = part.trim()
    if (token === "") continue
    tokens.push(token)
  }
  return tokens
}

export function parseKeyword(raw: string): ParsedKeyword {
  const trimmed = String(raw ?? "").trim()
  const colon = trimmed.indexOf(":")
  const namePart = colon < 0 ? trimmed : trimmed.slice(0, colon)
  const after = colon < 0 ? "" : trimmed.slice(colon + 1).trim()
  const param = after === "" ? null : after
  const name = namePart.replace(/_/g, " ").replace(/\s+/g, " ").trim()
  const ability = findKeywordAbility(name)
  const paramTokens = splitParam(param)
  const label = param == null ? name : `${name} ${param}`

  return {
    name,
    label,
    helpKey: ability?.name ?? name.toUpperCase(),
    help: ability?.text ?? null,
    param,
    paramTokens,
  }
}
