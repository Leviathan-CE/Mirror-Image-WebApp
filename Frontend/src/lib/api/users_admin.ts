/**
 * Admin users API — list/create/invite/patch/delete + feature catalog.
 */

import { apiBaseUrl, authHeaders, readJsonOrThrow } from "@/lib/api/client"

export type UserRole = "user" | "admin" | "distributor"

export type FeatureCatalogItem = {
  key: string
  label: string
  description: string
}

export type AdminUserItem = {
  id: number
  user_name: string
  email: string
  role: UserRole | string
  is_active: boolean
  email_verified: boolean
  subscription_status: string
  subscription_type: string
  features: string[]
  created_at: string | null
}

export type AdminUserListResponse = {
  items: AdminUserItem[]
  total: number
  limit: number
  offset: number
}

export type AdminUserListQuery = {
  q?: string
  role?: UserRole | ""
  is_active?: boolean | null
  limit?: number
  offset?: number
}

export async function fetchAdminFeatures(
  token: string
): Promise<FeatureCatalogItem[]> {
  const response = await fetch(`${apiBaseUrl()}/admin/features`, {
    headers: authHeaders(token),
  })
  return readJsonOrThrow<FeatureCatalogItem[]>(response, "admin_features_failed")
}

export async function fetchAdminUsers(
  token: string,
  query: AdminUserListQuery = {}
): Promise<AdminUserListResponse> {
  const url = new URL(`${apiBaseUrl()}/admin/users`)
  const q = query.q?.trim()
  if (q) url.searchParams.set("q", q)
  if (query.role) url.searchParams.set("role", query.role)
  if (query.is_active === true || query.is_active === false) {
    url.searchParams.set("is_active", String(query.is_active))
  }
  if (query.limit != null) url.searchParams.set("limit", String(query.limit))
  if (query.offset != null) url.searchParams.set("offset", String(query.offset))

  const response = await fetch(url, { headers: authHeaders(token) })
  return readJsonOrThrow<AdminUserListResponse>(response, "admin_users_failed")
}

export async function createAdminUser(
  token: string,
  body: {
    user_name: string
    email: string
    password: string
    role: UserRole
    feature_keys: string[]
  }
): Promise<AdminUserItem> {
  const response = await fetch(`${apiBaseUrl()}/admin/users`, {
    method: "POST",
    headers: { ...authHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  return readJsonOrThrow<AdminUserItem>(response, "admin_create_user_failed")
}

export async function inviteAdminUser(
  token: string,
  body: {
    email: string
    user_name?: string
    role: UserRole
    feature_keys: string[]
  }
): Promise<AdminUserItem> {
  const response = await fetch(`${apiBaseUrl()}/admin/users/invite`, {
    method: "POST",
    headers: { ...authHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  return readJsonOrThrow<AdminUserItem>(response, "admin_invite_user_failed")
}

export async function patchAdminUser(
  token: string,
  userId: number,
  body: {
    role?: UserRole
    is_active?: boolean
    feature_keys?: string[]
    resend_verification?: boolean
  }
): Promise<AdminUserItem> {
  const response = await fetch(`${apiBaseUrl()}/admin/users/${userId}`, {
    method: "PATCH",
    headers: { ...authHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  return readJsonOrThrow<AdminUserItem>(response, "admin_patch_user_failed")
}

export async function deleteAdminUser(
  token: string,
  userId: number
): Promise<void> {
  const response = await fetch(`${apiBaseUrl()}/admin/users/${userId}`, {
    method: "DELETE",
    headers: authHeaders(token),
  })
  if (!response.ok) {
    await readJsonOrThrow(response, "admin_delete_user_failed")
  }
}
