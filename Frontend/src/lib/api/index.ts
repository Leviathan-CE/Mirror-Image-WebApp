/**
 * Public API barrel — prefer importing from `@/lib/api/auth` or `@/lib/api/decks`
 * when you only need one domain; this re-export keeps existing `@/lib/api` imports working.
 */

export { ApiError, apiBaseUrl } from "@/lib/api/client"
export {
  loginRequest,
  type AuthUser,
  type LoginResponse,
} from "@/lib/api/auth"
export {
  searchCards,
  fetchCardById,
  type CardSearchHit,
  type CardDetail,
} from "@/lib/api/cards"
export {
  DEFAULT_DECK_CATEGORY_NAMES,
  PILOT_SECTION_NAME,
  AUGMENT_SECTION_NAME,
  addDeckCard,
  createDeckCategory,
  deleteDeckCategory,
  deckCoverUrl,
  fetchDeckDetail,
  fetchMyDecks,
  removeDeckCard,
  updateDeck,
  updateDeckCard,
  updateDeckCategory,
  cardArtUrl,
  type AddDeckCardPayload,
  type DeckCardEntry,
  type DeckCategoryOut,
  type DeckDetail,
  type DeckSummary,
  type DeckUpdatePayload,
  type UpdateDeckCardPayload,
} from "@/lib/api/decks"
