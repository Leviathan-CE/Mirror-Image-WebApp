/**
 * Playtester rooms: REST create + WebSocket signaling / action relay.
 */

import {
  apiBaseUrl,
  authHeaders,
  readJsonOrThrow,
} from "@/lib/api/client"

export type PlayRoomCreated = {
  code: string
  seat: "p1" | "p2"
  deck_id: number
}

export function playWsUrl(code: string): string {
  const http = apiBaseUrl()
  const ws = http.replace(/^http/i, "ws")
  return `${ws}/play/ws/rooms/${encodeURIComponent(code)}`
}

export async function createPlayRoom(
  deckId: number,
  token: string
): Promise<PlayRoomCreated> {
  const response = await fetch(`${apiBaseUrl()}/play/rooms`, {
    method: "POST",
    headers: {
      ...authHeaders(token),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ deck_id: deckId }),
  })
  return readJsonOrThrow<PlayRoomCreated>(response, "play_room_create_failed")
}
