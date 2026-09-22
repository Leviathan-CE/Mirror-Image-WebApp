/**
 * Public + staff announcement board API.
 */

import { apiBaseUrl, authHeaders, readJsonOrThrow } from "@/lib/api/client"

export type AnnouncementCover = {
  kind: string
  image_url: string | null
  youtube_id: string | null
}

export type AnnouncementPost = {
  id: number
  slug: string
  title: string
  body_markdown: string
  status: "draft" | "published" | string
  published_at: string | null
  created_at: string | null
  updated_at: string | null
  cover: AnnouncementCover
  images: Record<string, string>
  cover_kind?: string
  cover_media_id?: number | null
  cover_card_id?: number | null
  cover_card_face?: "art" | "thumb" | string | null
  cover_youtube_id?: string | null
}

export type AnnouncementWrite = {
  title: string
  body_markdown?: string
  status?: "draft" | "published"
  cover_kind?: "image" | "youtube" | "card"
  cover_media_id?: number | null
  cover_card_id?: number | null
  cover_card_face?: "art" | "thumb" | null
  cover_youtube?: string | null
}

export type AnnouncementMediaItem = {
  id: number
  label: string
  byte_size: number
  url: string | null
}

export function announcementMediaUrl(
  path: string | null | undefined
): string | null {
  if (!path) return null
  if (path.startsWith("http")) return path
  return `${apiBaseUrl()}/${path.replace(/^\//, "")}`
}

export async function fetchPublishedAnnouncements(): Promise<AnnouncementPost[]> {
  const response = await fetch(`${apiBaseUrl()}/announcements`)
  return readJsonOrThrow<AnnouncementPost[]>(
    response,
    "announcements_failed"
  )
}

export async function fetchAdminAnnouncements(
  token: string
): Promise<AnnouncementPost[]> {
  const response = await fetch(`${apiBaseUrl()}/admin/announcements`, {
    headers: authHeaders(token),
  })
  return readJsonOrThrow<AnnouncementPost[]>(
    response,
    "admin_announcements_failed"
  )
}

export async function createAnnouncement(
  token: string,
  body: AnnouncementWrite
): Promise<AnnouncementPost> {
  const response = await fetch(`${apiBaseUrl()}/admin/announcements`, {
    method: "POST",
    headers: { ...authHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  return readJsonOrThrow<AnnouncementPost>(
    response,
    "admin_announcement_create_failed"
  )
}

export async function patchAnnouncement(
  token: string,
  id: number,
  body: Partial<AnnouncementWrite>
): Promise<AnnouncementPost> {
  const response = await fetch(`${apiBaseUrl()}/admin/announcements/${id}`, {
    method: "PATCH",
    headers: { ...authHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  return readJsonOrThrow<AnnouncementPost>(
    response,
    "admin_announcement_patch_failed"
  )
}

export async function deleteAnnouncement(
  token: string,
  id: number
): Promise<void> {
  const response = await fetch(`${apiBaseUrl()}/admin/announcements/${id}`, {
    method: "DELETE",
    headers: authHeaders(token),
  })
  if (!response.ok) {
    const { ApiError, parseErrorDetail } = await import("@/lib/api/client")
    throw new ApiError(
      response.status,
      await parseErrorDetail(response, "admin_announcement_delete_failed")
    )
  }
}

export async function fetchAnnouncementMedia(
  token: string,
  q = ""
): Promise<AnnouncementMediaItem[]> {
  const url = new URL(`${apiBaseUrl()}/admin/announcement-media`)
  if (q.trim()) url.searchParams.set("q", q.trim())
  const response = await fetch(url, { headers: authHeaders(token) })
  return readJsonOrThrow<AnnouncementMediaItem[]>(
    response,
    "announcement_media_failed"
  )
}

export async function uploadAnnouncementMedia(
  token: string,
  file: File
): Promise<AnnouncementMediaItem> {
  const body = new FormData()
  body.append("file", file)
  const response = await fetch(`${apiBaseUrl()}/admin/announcement-media`, {
    method: "POST",
    headers: authHeaders(token),
    body,
  })
  return readJsonOrThrow<AnnouncementMediaItem>(
    response,
    "announcement_media_upload_failed"
  )
}
