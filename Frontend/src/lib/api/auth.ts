/**
 * Auth / login API client.
 */

import { apiBaseUrl, authHeaders, readJsonOrThrow } from "@/lib/api/client"

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
  const response = await fetch(`${apiBaseUrl()}/auth/login`, {
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
  const response = await fetch(`${apiBaseUrl()}/auth/google/config`)
  return readJsonOrThrow<GoogleAuthConfig>(response, "google_config_failed")
}

/** Exchange a Google Identity Services ID token for an app JWT. */
export async function googleLoginRequest(
  idToken: string
): Promise<LoginResponse> {
  const response = await fetch(`${apiBaseUrl()}/auth/google`, {
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
  const response = await fetch(`${apiBaseUrl()}/auth/google/link-with-password`, {
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
  const response = await fetch(`${apiBaseUrl()}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_name, email, password }),
  })
  return readJsonOrThrow<RegisterResponse>(response, "create_account_failed")
}

/** Load the current user (includes role) from a Bearer token. */
export async function fetchCurrentUser(token: string): Promise<AuthUser> {
  const response = await fetch(`${apiBaseUrl()}/auth/me`, {
    headers: authHeaders(token),
  })
  return readJsonOrThrow<AuthUser>(response, "me_fetch_failed")
}
