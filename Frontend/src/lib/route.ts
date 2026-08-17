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
  VERIFY_EMAIL: "/verify-email",
  FORGOT_PASSWORD: "/forgot-password",
  RESET_PASSWORD: "/reset-password",
  ACCEPT_INVITE: "/accept-invite",
  DECK_COMUNITY: "/comunity_decks",
  PLAY_TESTER: "/play_tester",

  /** Stripe subscription / billing. */
  SUBSCRIBE: "/subscribe",

  /** Admin console (role: admin). */
  ADMIN: "/admin",
  ADMIN_CARDS: "/admin/cards",
  ADMIN_USERS: "/admin/users",

  /** Build a deck detail URL — never navigate to bare "/decks". */
  deck: (deckId: string | number) => `/decks/${deckId}` as const,
  DECK_PATTERN: "/decks/:deckId",

  //pick a deck and send it to play tester
  playTester: (deckId: string | number) => `/play_tester/${deckId}` as const,
  PLAY_TESTER_PATTERN: "/play_tester/:deckId",
  playTesterVs: (deckId: string | number, vsDeckId: string | number) =>
    `/play_tester/${deckId}/vs/${vsDeckId}` as const,
  PLAY_TESTER_VS_PATTERN: "/play_tester/:deckId/vs/:vsDeckId",
} as const

export const ADMIN_ROLE = "admin" as const
