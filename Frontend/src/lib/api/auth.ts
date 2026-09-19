/**
 * Auth / login API client.
 */

import {
  ApiError,
  apiBaseUrl,
  authHeaders,
  parseErrorDetail,
  readJsonOrThrow,
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
  two_factor_enabled?: boolean
  two_factor_method?: "email" | null
  two_factor_dest_hint?: string | null
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

export type TwoFactorChallenge = {
  requires_2fa: true
  challenge_id: string
  two_factor_method: "email" | string
  dest_hint: string
}

export type LoginResult = LoginResponse | TwoFactorChallenge

export function isTwoFactorChallenge(
  value: LoginResult
): value is TwoFactorChallenge {
  return (
    typeof value === "object" &&
    value != null &&
    "requires_2fa" in value &&
    value.requires_2fa === true &&
    typeof value.challenge_id === "string"
  )
}

export type TwoFactorStatus = {
  enabled: boolean
  method: "email" | null
  dest_hint: string | null
  email_available: boolean
  requires_code?: boolean
  challenge_id?: string | null
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
): Promise<LoginResult> {
  const response = await fetch(`${apiBaseUrl()}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier, password }),
  })
  return readJsonOrThrow<LoginResult>(response, "login_failed")
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
): Promise<LoginResult> {
  const response = await fetch(`${apiBaseUrl()}/auth/google`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id_token: idToken }),
  })
  return readJsonOrThrow<LoginResult>(response, "google_login_failed")
}

/**
 * Verified password account already owns this Google email:
 * prove password, then attach Google and sign in.
 */
export async function googleLinkWithPasswordRequest(
  idToken: string,
  password: string
): Promise<LoginResult> {
  const response = await fetch(`${apiBaseUrl()}/auth/google/link-with-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id_token: idToken, password }),
  })
  return readJsonOrThrow<LoginResult>(response, "google_link_failed")
}

export async function fetchTwoFactorStatus(
  token: string
): Promise<TwoFactorStatus> {
  const response = await fetch(`${apiBaseUrl()}/auth/2fa/status`, {
    headers: authHeaders(token),
  })
  return readJsonOrThrow<TwoFactorStatus>(response, "2fa_status_failed")
}

export async function startTwoFactor(
  token: string,
  method: "email" = "email"
): Promise<TwoFactorChallenge> {
  const response = await fetch(`${apiBaseUrl()}/auth/2fa/start`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(token),
    },
    body: JSON.stringify({ method }),
  })
  return readJsonOrThrow<TwoFactorChallenge>(response, "2fa_start_failed")
}

export async function confirmTwoFactor(
  token: string,
  challengeId: string,
  code: string
): Promise<TwoFactorStatus> {
  const response = await fetch(`${apiBaseUrl()}/auth/2fa/confirm`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(token),
    },
    body: JSON.stringify({ challenge_id: challengeId, code }),
  })
  return readJsonOrThrow<TwoFactorStatus>(response, "2fa_confirm_failed")
}

export async function disableTwoFactor(
  token: string,
  body: { password?: string; challenge_id?: string; code?: string }
): Promise<TwoFactorStatus> {
  const response = await fetch(`${apiBaseUrl()}/auth/2fa/disable`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(token),
    },
    body: JSON.stringify({
      password: body.password ?? "",
      challenge_id: body.challenge_id ?? "",
      code: body.code ?? "",
    }),
  })
  return readJsonOrThrow<TwoFactorStatus>(response, "2fa_disable_failed")
}

export async function completeTwoFactorLogin(
  challengeId: string,
  code: string
): Promise<LoginResponse> {
  const response = await fetch(`${apiBaseUrl()}/auth/2fa/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ challenge_id: challengeId, code }),
  })
  return readJsonOrThrow<LoginResponse>(response, "2fa_login_failed")
}

export async function resendTwoFactor(
  challengeId: string
): Promise<TwoFactorChallenge> {
  const response = await fetch(`${apiBaseUrl()}/auth/2fa/resend`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ challenge_id: challengeId }),
  })
  return readJsonOrThrow<TwoFactorChallenge>(response, "2fa_resend_failed")
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

export async function deleteAccount(
  token: string,
  userName: string
): Promise<void> {
  const response = await fetch(`${apiBaseUrl()}/auth/me`, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(token),
    },
    body: JSON.stringify({ user_name: userName }),
  })
  if (response.ok) return
  throw new ApiError(
    response.status,
    await parseErrorDetail(response, "account_delete_failed")
  )
}

export async function patchUserPreferences(
  token: string,
  patch: UserPreferencesPatch
): Promise<UserPreferences> {
  const response = await fetch(`${apiBaseUrl()}/auth/me/preferences`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(token),
    },
    body: JSON.stringify(patch),
  })
  return readJsonOrThrow<UserPreferences>(response, "preferences_update_failed")
}
