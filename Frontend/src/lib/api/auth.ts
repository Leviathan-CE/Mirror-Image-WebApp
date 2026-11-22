/**
 * Auth / login API client.
 */

import {
  apiBaseUrl,
  authHeaders,
  parseErrorDetail,
  readJsonOrThrow,
  ApiError,
  apiFetch,
} from "@/lib/api/client"
import type {
  UserPreferences,
  UserPreferencesPatch,
} from "@/lib/userPreferences.logic"

export type AuthUser = {
  id: number
  user_name: string
  email: string
  role: string
  subscription_status?: string
  subscription_type?: string
  is_subscribed?: boolean
  email_verified?: boolean
  features?: string[]
  preferences?: UserPreferences
}

/** Narrow unknown JSON (e.g. localStorage) to a usable AuthUser. */
export function isAuthUser(value: unknown): value is AuthUser {
  if (value == null || typeof value !== "object") return false
  const row = value as Record<string, unknown>
  return (
    typeof row.id === "number" &&
    Number.isFinite(row.id) &&
    typeof row.user_name === "string" &&
    typeof row.email === "string" &&
    typeof row.role === "string"
  )
}

export type LoginResponse = {
  access_token: string
  token_type: string
  user: AuthUser
}

export type RegisterResponse = {
  id: number
  user_name: string
  email: string
  role: string
  message?: string
}

export async function loginRequest(
  identifier: string,
  password: string
): Promise<LoginResponse> {
  const response = await apiFetch(`${apiBaseUrl()}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier, password }),
  })
  return readJsonOrThrow<LoginResponse>(response, "login_failed")
}

/** Public Google Sign-In config (client id from API env). */
export type GoogleAuthConfig = {
  google_client_id: string | null
  enabled: boolean
}

export async function fetchGoogleAuthConfig(): Promise<GoogleAuthConfig> {
  const response = await apiFetch(`${apiBaseUrl()}/auth/google/config`)
  return readJsonOrThrow<GoogleAuthConfig>(response, "google_config_failed")
}

/** Exchange a Google Identity Services ID token for an app JWT. */
export async function googleLoginRequest(
  idToken: string
): Promise<LoginResponse> {
  const response = await apiFetch(`${apiBaseUrl()}/auth/google`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id_token: idToken }),
  })
  return readJsonOrThrow<LoginResponse>(response, "google_login_failed")
}

/**
 * Verified password account already owns this Google email:
 * prove password, then attach Google and sign in.
 */
export async function googleLinkWithPasswordRequest(
  idToken: string,
  password: string
): Promise<LoginResponse> {
  const response = await apiFetch(`${apiBaseUrl()}/auth/google/link-with-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id_token: idToken, password }),
  })
  return readJsonOrThrow<LoginResponse>(response, "google_link_failed")
}

export async function createAccount(
  user_name: string,
  email: string,
  password: string
): Promise<RegisterResponse> {
  const response = await apiFetch(`${apiBaseUrl()}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_name, email, password }),
  })
  return readJsonOrThrow<RegisterResponse>(response, "create_account_failed")
}

/** Load the current user from the session cookie. */
export async function fetchCurrentUser(
  _token?: string | null
): Promise<AuthUser> {
  const response = await apiFetch(`${apiBaseUrl()}/auth/me`, {
    headers: authHeaders(_token),
  })
  return readJsonOrThrow<AuthUser>(response, "me_fetch_failed")
}

export async function patchUserPreferences(
  token: string,
  patch: UserPreferencesPatch
): Promise<UserPreferences> {
  const response = await apiFetch(`${apiBaseUrl()}/auth/me/preferences`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(token),
    },
    body: JSON.stringify(patch),
  })
  return readJsonOrThrow<UserPreferences>(response, "preferences_update_failed")
}

export async function logoutRequest(): Promise<void> {
  const response = await apiFetch(`${apiBaseUrl()}/auth/logout`, {
    method: "POST",
  })
  if (response.status === 204 || response.ok) return
  throw new ApiError(
    response.status,
    await parseErrorDetail(response, "logout_failed")
  )
}

export async function exportAccountRequest(
  _token?: string | null
): Promise<AccountExport> {
  const response = await apiFetch(`${apiBaseUrl()}/auth/me/export`, {
    headers: authHeaders(_token),
  })
  return readJsonOrThrow<AccountExport>(response, "export_failed")
}

export type AccountExport = {
  profile: {
    user_name: string
    email: string
    role: string
    is_active: boolean
    email_verified: boolean
    created_at: string | null
  }
  preferences: UserPreferences | Record<string, unknown>
  oauth_providers: Array<{
    provider: string
    email_at_link: string | null
    linked_at: string | null
  }>
  subscription: {
    status: string
    type: string
    current_period_end: string | null
    cancel_at_period_end: boolean
  }
}

export async function deleteAccountRequest(
  token: string,
  user_name: string
): Promise<void> {
  const response = await apiFetch(`${apiBaseUrl()}/auth/me`, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(token),
    },
    body: JSON.stringify({ user_name }),
  })
  if (response.status === 204 || response.ok) return
  throw new ApiError(
    response.status,
    await parseErrorDetail(response, "account_delete_failed")
  )
}
