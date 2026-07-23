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
  access_token: string
  token_type: string
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
