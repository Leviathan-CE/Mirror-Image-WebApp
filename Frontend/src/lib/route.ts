/**
 * Frontend path constants — import these instead of hardcoding strings.
 */

export const ROUTES = {
  HOME: "/",
  MAIN: "/main",
  CARDS: "/cards",
  HOW_TO_PLAY: "/how-to-play",
  LORE: "/lore",
  LOGIN: "/login",
  DECK_COMUNITY: "/comunity_decks",

  /** Build a deck detail URL — never navigate to bare "/decks". */
  deck: (deckId: string | number) => `/decks/${deckId}` as const,
  DECK_PATTERN: "/decks/:deckId",
} as const
