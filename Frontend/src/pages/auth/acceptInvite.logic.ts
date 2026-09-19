/** Accept-invite page copy (no React). */

export function acceptInviteErrorText(detail: string): string {
  if (detail === "invalid_or_expired_token") {
    return "This invite is invalid or expired."
  }
  if (detail === "invalid_username") {
    return "Username must be 3–32 letters, numbers, or underscore. Leave it blank to keep the invited name."
  }
  if (detail === "username_or_email_taken") {
    return "That username is already taken."
  }
  if (detail === "email_auth_failed") {
    return "Could not accept the invite. Leave username blank unless you want a new one (letters, numbers, underscore only)."
  }
  return detail
}
