/**
 * Email verification / invite / password-reset API client.
 */

import { apiBaseUrl, readJsonOrThrow } from "@/lib/api/client"

type Ok = { ok: boolean }

async function postOk(path: string, body: unknown): Promise<Ok> {
  const response = await fetch(`${apiBaseUrl()}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  return readJsonOrThrow<Ok>(response, "email_auth_failed")
}

export function verifyEmailRequest(token: string) {
  return postOk("/auth/email/verify", { token })
}

export function resendVerificationRequest(email: string) {
  return postOk("/auth/email/resend-verification", { email })
}

export function forgotPasswordRequest(email: string) {
  return postOk("/auth/email/forgot-password", { email })
}

export function resetPasswordRequest(token: string, password: string) {
  return postOk("/auth/email/reset-password", { token, password })
}

export function acceptInviteRequest(
  token: string,
  password: string,
  user_name?: string
) {
  return postOk("/auth/email/accept-invite", {
    token,
    password,
    user_name: user_name || undefined,
  })
}
