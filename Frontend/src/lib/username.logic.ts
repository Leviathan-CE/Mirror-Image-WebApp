/**
 * Same rule as Backend admin/auth: ^[a-zA-Z0-9_]{3,32}$
 * Invite may omit a name; create may not.
 */

export const USERNAME_PATTERN = /^[a-zA-Z0-9_]{3,32}$/

export const USERNAME_RULE =
  "Username must be 3–32 letters, numbers, or underscores (no spaces, @, or dots)."

export function isValidUsername(value: string): boolean {
  return USERNAME_PATTERN.test(value)
}

export function createUsernameError(raw: string): string | null {
  const value = raw.trim()
  if (!value) return USERNAME_RULE
  if (!isValidUsername(value)) return USERNAME_RULE
  return null
}

export function inviteUsernameError(raw: string): string | null {
  const value = raw.trim()
  if (!value) return null
  if (!isValidUsername(value)) return USERNAME_RULE
  return null
}
