/** Pure helpers for API error bodies (no fetch). */

export function detailFromErrorBody(body: unknown, fallback: string): string {
  if (body == null || typeof body !== "object") return fallback
  const detail = (body as { detail?: unknown }).detail
  if (typeof detail === "string") {
    const text = detail.trim()
    return text || fallback
  }
  if (!Array.isArray(detail) || detail.length === 0) return fallback
  const first = detail[0]
  if (first == null || typeof first !== "object") return fallback
  const msg = (first as { msg?: unknown }).msg
  if (typeof msg !== "string") return fallback
  return msg.trim() || fallback
}
