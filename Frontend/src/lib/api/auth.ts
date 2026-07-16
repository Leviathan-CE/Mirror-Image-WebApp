/**
 * Auth / login API client.
 */

import { apiBaseUrl, readJsonOrThrow } from "@/lib/api/client"

export type AuthUser = {
  id: number
  user_name: string
  email: string
}

export type LoginResponse = {
  access_token: string
  token_type: string
  user: AuthUser
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
