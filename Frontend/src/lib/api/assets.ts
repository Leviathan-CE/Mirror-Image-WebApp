/**
 * System assets for playtester / printouts.
 *
 * Free duplex back lives in `public/` so any logged-in user can print with it.
 * Premium system back stays staff-only via a signed `/media/...` mint.
 */

import { apiBaseUrl, authHeaders, readJsonOrThrow } from "@/lib/api/client"
import { cardArtUrl } from "@/lib/api/decks"

/** Public free card back for duplex print (all users). */
export const FREE_CARD_BACK_SRC = "/images/card_back_free.png"

export const FREE_CARD_BACK_ID = "free"
export const STANDARD_CARD_BACK_ID = "standard"

export type CardBackOption = {
  id: string
  label: string
  src: string
}

export const FREE_CARD_BACK_OPTION: CardBackOption = {
  id: FREE_CARD_BACK_ID,
  label: "Free card back",
  src: FREE_CARD_BACK_SRC,
}

type CardBackResponse = {
  card_back_path: string
}

/**
 * Absolute signed URL for the premium system card back.
 * Staff-only on the API — non-staff callers get 403.
 */
export async function fetchCardBackUrl(token: string): Promise<string> {
  const response = await fetch(`${apiBaseUrl()}/assets/card-back`, {
    headers: authHeaders(token),
  })
  const body = await readJsonOrThrow<CardBackResponse>(
    response,
    "card_back_fetch_failed"
  )
  const url = cardArtUrl(body.card_back_path)
  if (!url) {
    throw new Error("card_back_missing_path")
  }
  return url
}
