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

  /** Public-ish supporter plan picker (auth required). */
  PLANS: "/plans",
  /** Payment step for a chosen subscription offer. */
  plansPay: (offerId: string) => `/plans/pay/${offerId}` as const,
  PLANS_PAY_PATTERN: "/plans/pay/:offerId",
  /** Manage existing subscription / Stripe portal (auth required). */
  SUBSCRIPTION: "/subscription",
  /** @deprecated Use PLANS or SUBSCRIPTION — kept for old bookmarks. */
  SUBSCRIBE: "/subscription",

  /** Logged-in account UI prefs. */
  ACCOUNT: "/account",

  /** Public announcement board. */
  UPDATES: "/updates",

  /** Public mailing-list unsubscribe (token in query). */
  UNSUBSCRIBE: "/unsubscribe",

  /** Logged-in notification inbox. */
  INBOX: "/inbox",

  /** Staff console (admin + developer). Users page is admin-only. */
  ADMIN: "/admin",
  ADMIN_CARDS: "/admin/cards",
  ADMIN_USERS: "/admin/users",
  ADMIN_UPDATES: "/admin/updates",

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
export const DEVELOPER_ROLE = "developer" as const
export const PLAYTESTER_ROLE = "play_tester" as const

export function isAdminRole(role: string | null | undefined): boolean {
  return role === ADMIN_ROLE
}

export function isStaffRole(role: string | null | undefined): boolean {
  return role === ADMIN_ROLE || role === DEVELOPER_ROLE
}

export function isPlayTesterRole(role: string | null | undefined): boolean {
  return role == PLAYTESTER_ROLE
}
