/**
 * Shared HTTP helpers for API modules.
 * Login and deck clients import from here — change base URL / errors in one place.
 */

export function apiBaseUrl(): string {
  return (
    (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") ||
    "http://127.0.0.1:8000"
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
    const body = (await response.json()) as { detail?: string }
    if (typeof body.detail === "string") return body.detail
  } catch {
    /* ignore non-JSON errors */
  }
  return fallback
}

export function authHeaders(token?: string | null): HeadersInit {
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export async function readJsonOrThrow<T>(
  response: Response,
  fallback: string
): Promise<T> {
  if (!response.ok) {
    throw new ApiError(
      response.status,
      await parseErrorDetail(response, fallback)
    )
  }
  return (await response.json()) as T
}
