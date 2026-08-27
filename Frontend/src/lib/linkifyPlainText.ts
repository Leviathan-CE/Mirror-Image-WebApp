/**
 * Split plain text into safe http(s) link segments — no HTML/markdown parsing.
 */

export type PlainTextSegment =
  | { kind: "text"; value: string }
  | { kind: "link"; href: string; label: string }

/** http(s) URLs and bare www. hosts (not inside angle brackets). */
const URL_PATTERN =
  /(?:https?:\/\/[^\s<>\[\]{}|\\^`"]+|www\.[^\s<>\[\]{}|\\^`"]+)/gi

const TRAILING_PUNCT = /[.,;:!?)'\]}>]+$/u

/**
 * Return a normalized http(s) href, or null when the URL is unsafe/invalid.
 */
export function safeHttpHref(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return null

  const candidate = /^www\./i.test(trimmed)
    ? `https://${trimmed}`
    : trimmed

  try {
    const url = new URL(candidate)
    if (url.protocol !== "http:" && url.protocol !== "https:") return null
    return url.href
  } catch {
    return null
  }
}

function splitUrlMatch(raw: string): { label: string; hrefTarget: string } {
  const trailing = raw.match(TRAILING_PUNCT)?.[0] ?? ""
  const core = trailing ? raw.slice(0, -trailing.length) : raw
  return { label: raw, hrefTarget: core || raw }
}

export function parsePlainTextLinks(text: string): PlainTextSegment[] {
  if (!text) return []

  const segments: PlainTextSegment[] = []
  let lastIndex = 0

  for (const match of text.matchAll(URL_PATTERN)) {
    const raw = match[0]
    const index = match.index ?? 0

    if (index > lastIndex) {
      segments.push({ kind: "text", value: text.slice(lastIndex, index) })
    }

    const { label, hrefTarget } = splitUrlMatch(raw)
    const href = safeHttpHref(hrefTarget)
    if (href) {
      segments.push({ kind: "link", href, label })
    } else {
      segments.push({ kind: "text", value: raw })
    }

    lastIndex = index + raw.length
  }

  if (lastIndex < text.length) {
    segments.push({ kind: "text", value: text.slice(lastIndex) })
  }

  return segments.length > 0 ? segments : [{ kind: "text", value: text }]
}
