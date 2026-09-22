/**
 * Pure helpers for announcement markdown: YouTube ids, image refs, game tags.
 */

import { spriteNameToIcon } from "@/components/cards/spriteIcons"
import type { GameIconName } from "@/components/common/GameIcon"

const YOUTUBE_ID_RE = /^[A-Za-z0-9_-]{11}$/
const IMAGE_REF_RE = /^(media|card-art|card-thumb):(\d+)$/
const TAG_RE = /\[([A-Za-z0-9_-]+)\]/g
const BAD_SCHEMES = ["javascript:", "data:", "vbscript:", "file:"]

export type AnnouncementImageKind = "media" | "card-art" | "card-thumb"

export type TaggedPart =
  | { type: "text"; value: string }
  | { type: "tag"; value: string; icon: GameIconName | null }

export function parseYoutubeId(value: string | null | undefined): string | null {
  const raw = (value ?? "").trim()
  if (!raw) return null
  const lowered = raw.toLowerCase()
  if (BAD_SCHEMES.some((scheme) => lowered.startsWith(scheme))) return null
  if (YOUTUBE_ID_RE.test(raw)) return raw

  let parsed: URL
  try {
    parsed = new URL(raw)
  } catch {
    return null
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null
  const host = parsed.hostname.toLowerCase()
  const allowed = new Set([
    "youtube.com",
    "www.youtube.com",
    "m.youtube.com",
    "youtu.be",
    "www.youtu.be",
    "youtube-nocookie.com",
    "www.youtube-nocookie.com",
  ])
  if (!allowed.has(host)) return null

  if (host.endsWith("youtu.be")) {
    const id = parsed.pathname.replace(/^\//, "").split("/")[0] ?? ""
    return YOUTUBE_ID_RE.test(id) ? id : null
  }
  const parts = parsed.pathname.split("/").filter(Boolean)
  if (
    parts[0] &&
    ["embed", "shorts", "live"].includes(parts[0]) &&
    parts[1] &&
    YOUTUBE_ID_RE.test(parts[1])
  ) {
    return parts[1]
  }
  const v = parsed.searchParams.get("v") ?? ""
  return YOUTUBE_ID_RE.test(v) ? v : null
}

export function youtubeThumbUrl(id: string): string {
  return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`
}

export function youtubeEmbedUrl(id: string): string {
  return `https://www.youtube-nocookie.com/embed/${id}`
}

export function parseImageRef(
  href: string | null | undefined
): { kind: AnnouncementImageKind; id: number } | null {
  const match = IMAGE_REF_RE.exec((href ?? "").trim())
  if (!match) return null
  return { kind: match[1] as AnnouncementImageKind, id: Number(match[2]) }
}

export function imageRefToken(kind: AnnouncementImageKind, id: number): string {
  return `${kind}:${id}`
}

export function markdownImageToken(
  kind: AnnouncementImageKind,
  id: number,
  alt: string
): string {
  const safeAlt = alt.replace(/[\[\]]/g, "")
  return `![${safeAlt}](${imageRefToken(kind, id)})`
}

/**
 * Same rules as the API: drop HTML, code, and non-allowlisted images/URLs.
 * Run this again on render so a bad payload never becomes a DOM node.
 */
export function sanitizeAnnouncementMarkdown(
  text: string | null | undefined
): string {
  if (!text) return ""
  const htmlTag = /<[^>]*>/gi
  const fence = /```[\s\S]*?```/g
  const inlineCode = /`[^`]*`/g
  const image = /!\[([^\]]*)\]\(([^)]+)\)/g
  const link = /(?<!!)\[([^\]]+)\]\(([^)]+)\)/g
  const nul = /[\x00-\x08\x0b\x0c\x0e-\x1f]/g

  let cleaned = text.replace(nul, "")
  cleaned = cleaned.replace(htmlTag, "")
  cleaned = cleaned.replace(fence, "")
  cleaned = cleaned.replace(inlineCode, "")
  cleaned = cleaned.replace(image, (_all, alt: string, href: string) => {
    const raw = href.trim()
    return parseImageRef(raw) ? `![${alt}](${raw})` : ""
  })
  cleaned = cleaned.replace(link, (_all, label: string, href: string) => {
    const raw = href.trim()
    const lowered = raw.toLowerCase()
    if (BAD_SCHEMES.some((scheme) => lowered.startsWith(scheme))) return label
    if (parseYoutubeId(raw)) return `[${label}](${raw})`
    try {
      const parsed = new URL(raw)
      if (parsed.protocol === "http:" || parsed.protocol === "https:") {
        return `[${label}](${raw})`
      }
    } catch {
      return label
    }
    return label
  })
  return cleaned
}

export function splitTaggedText(text: string): TaggedPart[] {
  const parts: TaggedPart[] = []
  let last = 0
  TAG_RE.lastIndex = 0
  for (const match of text.matchAll(TAG_RE)) {
    const index = match.index ?? 0
    if (index > last) {
      parts.push({ type: "text", value: text.slice(last, index) })
    }
    const token = match[1] ?? ""
    parts.push({
      type: "tag",
      value: token,
      icon: spriteNameToIcon(token),
    })
    last = index + match[0].length
  }
  if (last < text.length) {
    parts.push({ type: "text", value: text.slice(last) })
  }
  return parts
}
