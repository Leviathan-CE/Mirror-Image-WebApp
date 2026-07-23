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
  REGISTER: "/register",
  DECK_COMUNITY: "/comunity_decks",

  /** Stripe subscription / billing. */
  SUBSCRIBE: "/subscribe",

  /** Admin console (role: admin). */
  ADMIN: "/admin",
  ADMIN_CARDS: "/admin/cards",
  ADMIN_USERS: "/admin/users",

  /** Build a deck detail URL — never navigate to bare "/decks". */
  deck: (deckId: string | number) => `/decks/${deckId}` as const,
  DECK_PATTERN: "/decks/:deckId",
} as const

export const ADMIN_ROLE = "admin" as const
