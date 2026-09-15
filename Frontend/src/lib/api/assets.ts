/**
 * System assets gated behind login (signed media URLs).
 *
 * Card backs are not in `public/` — guests cannot hotlink `/images/card_back.png`.
 * Playtester / printouts mint a short-lived `/media/system/card_back.png?exp&sig`.
 */

import { apiBaseUrl, authHeaders, readJsonOrThrow } from "@/lib/api/client"
import { cardArtUrl } from "@/lib/api/decks"

type CardBackResponse = {
  card_back_path: string
}

/** Absolute signed URL for the card back image. Requires a session token. */
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
