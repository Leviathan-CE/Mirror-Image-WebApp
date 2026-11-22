/**
 * Public blog mailing-list subscribe / unsubscribe.
 */

import { apiBaseUrl, readJsonOrThrow,
  apiFetch,
} from "@/lib/api/client"

export type SubscribeResult = {
  subscribed: boolean
  already_subscribed: boolean
}

export type UnsubscribeResult = {
  unsubscribed: boolean
  kind: string
}

export async function subscribeMailingList(
  email: string
): Promise<SubscribeResult> {
  const response = await apiFetch(`${apiBaseUrl()}/mailing-list/subscribe`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  })
  return readJsonOrThrow<SubscribeResult>(
    response,
    "mailing_subscribe_failed"
  )
}

export async function unsubscribeMailingList(
  token: string
): Promise<UnsubscribeResult> {
  const url = new URL(`${apiBaseUrl()}/mailing-list/unsubscribe`)
  url.searchParams.set("token", token)
  const response = await apiFetch(url)
  return readJsonOrThrow<UnsubscribeResult>(
    response,
    "mailing_unsubscribe_failed"
  )
}
