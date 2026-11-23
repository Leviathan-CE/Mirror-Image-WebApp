/**
 * Shared HTTP helpers for API modules.
 * Login and deck clients import from here — change base URL / errors in one place.
 */

import { detailFromErrorBody } from "@/lib/api/client.logic"

/**
 * API origin the browser should call.
 *
 * When you open the site on localhost / 127.0.0.1, use the *same hostname*
 * for the API (port 8001). Browsers treat `localhost` and `127.0.0.1` as
 * different origins — mixing them causes CORS failures that look like
 * "Could not load Google sign-in".
 *
 * This also ignores a production VITE_API_URL baked into a Docker image
 * while you are testing locally.
 */
export function apiBaseUrl(): string {
  if (typeof window !== "undefined") {
    const host = window.location.hostname
    if (host === "localhost" || host === "127.0.0.1") {
      return `http://${host}:8001`
    }
  }

  return (
    (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") ||
    "http://127.0.0.1:8001"
  )
}

export class ApiError extends Error {
  status: number
  detail: string

  constructor(status: number, detail: string) {
    super(detail)
    this.status = status
    this.detail = detail
  }
}

export async function parseErrorDetail(
  response: Response,
  fallback: string
): Promise<string> {
  try {
    return detailFromErrorBody(await response.json(), fallback)
  } catch {
    return fallback
  }
}

const SESSION_GONE = new Set([
  "missing_bearer_token",
  "invalid_token",
  "token_expired",
])

let onSessionGone: (() => void) | null = null

/** AuthProvider registers this so a dead cookie logs the tab out. */
export function setSessionGoneHandler(handler: () => void): void {
  onSessionGone = handler
}

export function sessionGoneText(
  detail: string,
  fallback: string
): string {
  if (!SESSION_GONE.has(detail)) return fallback
  return "Session expired. Log in again."
}

function noteSessionGone(status: number, detail: string): void {
  if (status !== 401) return
  if (!SESSION_GONE.has(detail)) return
  if (onSessionGone == null) return
  onSessionGone()
}

export function authHeaders(token?: string | null): HeadersInit {
  // Cookie auth replaced the Bearer header. Callers still pass token.
  void token
  return {}
}

/** Browser calls that should send the httpOnly session cookie. */
export function apiFetch(
  input: RequestInfo | URL,
  init: RequestInit = {}
): Promise<Response> {
  return fetch(input, {
    ...init,
    credentials: "include",
  })
}

export async function readJsonOrThrow<T>(
  response: Response,
  fallback: string
): Promise<T> {
  if (response.ok) {
    return (await response.json()) as T
  }
  const detail = await parseErrorDetail(response, fallback)
  noteSessionGone(response.status, detail)
  throw new ApiError(response.status, detail)
}
