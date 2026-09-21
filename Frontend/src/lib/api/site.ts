/**
 * Coming-soon splash API. GET is public; PATCH is admin-only.
 */

import { apiBaseUrl, authHeaders, readJsonOrThrow } from "@/lib/api/client"

export type ComingSoonStatus = {
  coming_soon: boolean
}

export async function fetchComingSoon(): Promise<ComingSoonStatus> {
  const response = await fetch(`${apiBaseUrl()}/site/coming-soon`)
  return readJsonOrThrow<ComingSoonStatus>(response, "coming_soon_failed")
}

export async function patchComingSoon(
  token: string,
  comingSoon: boolean
): Promise<ComingSoonStatus> {
  const response = await fetch(`${apiBaseUrl()}/admin/site/coming-soon`, {
    method: "PATCH",
    headers: {
      ...authHeaders(token),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ coming_soon: comingSoon }),
  })
  return readJsonOrThrow<ComingSoonStatus>(response, "coming_soon_patch_failed")
}
