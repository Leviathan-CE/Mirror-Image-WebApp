/**
 * Site flags API. GET is public; PATCH is admin-only.
 */

import { apiBaseUrl, authHeaders, readJsonOrThrow } from "@/lib/api/client"

export type ComingSoonStatus = {
  coming_soon: boolean
}

export type PreviewsForLoggedInStatus = {
  previews_for_logged_in: boolean
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

export async function fetchPreviewsForLoggedIn(): Promise<PreviewsForLoggedInStatus> {
  const response = await fetch(
    `${apiBaseUrl()}/site/previews-for-logged-in`
  )
  return readJsonOrThrow<PreviewsForLoggedInStatus>(
    response,
    "previews_flag_failed"
  )
}

export async function patchPreviewsForLoggedIn(
  token: string,
  enabled: boolean
): Promise<PreviewsForLoggedInStatus> {
  const response = await fetch(
    `${apiBaseUrl()}/admin/site/previews-for-logged-in`,
    {
      method: "PATCH",
      headers: {
        ...authHeaders(token),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ previews_for_logged_in: enabled }),
    }
  )
  return readJsonOrThrow<PreviewsForLoggedInStatus>(
    response,
    "previews_flag_patch_failed"
  )
}
