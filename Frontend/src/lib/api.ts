/** API base URL — Docker/host API on :8000 by default. */
export function apiBaseUrl(): string {
  return (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "")
    || "http://127.0.0.1:8000"
}

export type AuthUser = {
  id: number
  user_name: string
  email: string
}

export type LoginResponse = {
  access_token: string
  token_type: string
  user: AuthUser
}

export type DeckSummary = {
  id: number
  name: string | null
  description: string | null
  is_public: boolean
  author_name: string
  cover_image_path: string | null
  card_count: number
}

/** Names seeded on new decks — users can rename/add/remove per deck. */
export const DEFAULT_DECK_CATEGORY_NAMES = [
  "Main",
  "Side",
  "Maybe",
  "Extra",
] as const

export type DeckCategoryOut = {
  id: number
  name: string
  sort_order: number
}

export type DeckCardEntry = {
  card_id: number
  card_name: string
  quantity: number
  category_id: number
  category_name: string
  sort_order: number
}

export type DeckDetail = DeckSummary & {
  categories: DeckCategoryOut[]
  cards: DeckCardEntry[]
}

export class ApiError extends Error {
  status: number
  detail: string

  constructor(status: number, detail: string) {
    super(detail)
    this.status = status
    this.detail = detail
  }
}

async function parseErrorDetail(response: Response, fallback: string): Promise<string> {
  try {
    const body = (await response.json()) as { detail?: string }
    if (typeof body.detail === "string") return body.detail
  } catch {
    /* ignore non-JSON errors */
  }
  return fallback
}

export async function loginRequest(
  identifier: string,
  password: string
): Promise<LoginResponse> {
  const response = await fetch(`${apiBaseUrl()}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier, password }),
  })

  if (!response.ok) {
    throw new ApiError(
      response.status,
      await parseErrorDetail(response, "login_failed")
    )
  }

  return (await response.json()) as LoginResponse
}

export async function fetchMyDecks(token: string): Promise<DeckSummary[]> {
  const response = await fetch(`${apiBaseUrl()}/decks/me`, {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (!response.ok) {
    throw new ApiError(
      response.status,
      await parseErrorDetail(response, "decks_fetch_failed")
    )
  }

  return (await response.json()) as DeckSummary[]
}
