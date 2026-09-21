/**
 * Peer browse chrome — copy + local UI → wire mapping.
 * Browsing is UI-only (no card faces/ids on the wire).
 */

import type { PlayNetMessage } from "@/components/Playtester/net/playNet.logic"

export type BrowseMessage = Extract<PlayNetMessage, { type: "browse" }>

export type LocalBrowseUi = {
  /** Look-at-top peek card count; null when peek is closed. */
  deckPeekCount: number | null
  deckSearchOpen: boolean
  pileBrowser: "trashyard" | "dismantled" | null
}

/**
 * Precedence: peek > deck search > own pile browser.
 * Opp pile browsers are ignored (out of scope for this signal).
 */
export function browseMessageFromLocalUi(ui: LocalBrowseUi): BrowseMessage {
  if (ui.deckPeekCount != null && ui.deckPeekCount > 0) {
    return { type: "browse", pile: "library-top", count: ui.deckPeekCount }
  }
  if (ui.deckSearchOpen) {
    return { type: "browse", pile: "library" }
  }
  if (ui.pileBrowser === "trashyard") {
    return { type: "browse", pile: "trashyard" }
  }
  if (ui.pileBrowser === "dismantled") {
    return { type: "browse", pile: "dismantled" }
  }
  return { type: "browse", pile: null }
}

/** Label for the peer’s matching opp pile, or null when idle. */
export function peerBrowseStatusLabel(msg: BrowseMessage | null): string | null {
  if (!msg || msg.pile == null) return null
  if (msg.pile === "library-top") {
    return `Looking at top ${msg.count}`
  }
  return "Searching…"
}

/** Which opp pile should show the status line for this browse message. */
export function peerBrowseOppPile(
  msg: BrowseMessage | null
): "library" | "trashyard" | "dismantled" | null {
  if (!msg || msg.pile == null) return null
  if (msg.pile === "library" || msg.pile === "library-top") return "library"
  return msg.pile
}
