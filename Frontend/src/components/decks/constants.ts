/**
 * Deck-builder knobs (limits, drag MIME, classified face copy).
 * Edit values here — not DeckCardStack / ClassifiedCardFace / deckCardDrag.
 */

/** HTML5 drag MIME for in-app card moves. */
export const DECK_CARD_DRAG_MIME = "application/x-mi-deck-card"

/** Max copies of a card in a normal (non-augment) section. */
export const DECK_CARD_MAX_COPIES = 3

/** Sentinel `fromCategoryId` for drags that originate in the card library browser. */
export const LIBRARY_DRAG_CATEGORY_ID = -1

/** Eyebrow above the classified stamp. */
export const CLASSIFIED_EYEBROW = {
  classified: "RESTRICTED ACCESS",
  top_secret: "UNRELEASED ASSET",
} as const

/** Stamp badge text. */
export const CLASSIFIED_STAMP = {
  classified: "CLASSIFIED",
  top_secret: "TOP SECRET",
} as const

/** Footer when top_secret (no subscribe CTA). */
export const TOP_SECRET_FOOTER = "Coming soon to preview"

/** Subscribe CTA for classified (preview without entitlement). */
export const CLASSIFIED_SUBSCRIBE_CTA = "AQUIRE LEVEL 3 ACCESS"
