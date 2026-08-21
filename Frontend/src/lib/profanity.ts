/**
 * Client-side mirror of Backend/app/profanity.py.
 *
 * Why both sides?
 * - Backend is the real gate (anyone can skip the browser).
 * - Frontend gives instant feedback before a round-trip.
 *
 * Keep PROFANE_TERMS in sync with the Python module when you edit the list.
 */

const PROFANE_TERMS = new Set([
  "asshole",
  "assholes",
  "bastard",
  "bastards",
  "bitch",
  "bitches",
  "bollocks",
  "bullshit",
  "cock",
  "cocks",
  "cunt",
  "cunts",
  "dick",
  "dicks",
  "dumbass",
  "fag",
  "faggot",
  "faggots",
  "fuck",
  "fucked",
  "fucker",
  "fuckers",
  "fucking",
  "motherfucker",
  "motherfuckers",
  "nigger",
  "niggers",
  "piss",
  "pussy",
  "shit",
  "shits",
  "shithead",
  "slut",
  "sluts",
  "twat",
  "wank",
  "wanker",
  "whore",
  "whores",
])

const LEET: Record<string, string> = {
  "@": "a",
  "4": "a",
  "8": "b",
  "(": "c",
  "3": "e",
  "1": "i",
  "!": "i",
  "0": "o",
  $: "s",
  "5": "s",
  "7": "t",
}

const NON_ALNUM = /[^a-z0-9]+/g

/** API `detail` when the server rejects public text. */
export const PROFANITY_REJECTED = "profanity_rejected"

export const PUBLIC_TEXT_BLOCKED_MESSAGE =
  "That text can’t be used in public-facing fields."

function normalizeForProfanity(text: string): string {
  const folded = text.normalize("NFKD").replace(/\p{M}/gu, "")
  let lowered = folded.toLowerCase()
  lowered = [...lowered].map((ch) => LEET[ch] ?? ch).join("")
  return lowered
}

/**
 * Return the matched blocked term, or null if clean / empty.
 */
export function findProfanity(text: string | null | undefined): string | null {
  if (text == null) return null
  const raw = String(text).trim()
  if (!raw) return null

  const normalized = normalizeForProfanity(raw)
  const tokens = new Set(
    normalized.split(NON_ALNUM).filter((t) => t.length > 0)
  )
  const compact = normalized.replace(NON_ALNUM, "")

  for (const term of PROFANE_TERMS) {
    if (term.includes(" ")) {
      const spaced = term.replace(/ /g, "")
      if (normalized.includes(term) || compact.includes(spaced)) return term
      continue
    }
    if (tokens.has(term) || compact === term) return term
    if (term.length >= 4 && compact.includes(term)) return term
  }
  return null
}

export function containsProfanity(text: string | null | undefined): boolean {
  return findProfanity(text) != null
}

/** True when every provided string passes the public-text filter. */
export function isPublicTextClean(
  ...texts: Array<string | null | undefined>
): boolean {
  return texts.every((t) => !containsProfanity(t))
}
