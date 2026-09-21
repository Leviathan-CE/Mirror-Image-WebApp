import { USERNAME_RULE } from "@/lib/username.logic"

export function acceptInviteErrorText(detail: string): string {
  if (detail === "invalid_or_expired_token") {
    return "This invite is invalid or expired."
  }
  if (detail === "username_or_email_taken") {
    return "That username is already taken. Choose another."
  }
  if (
    detail.includes("user_name") ||
    detail.includes("underscore") ||
    detail.toLowerCase().includes("at least 3")
  ) {
    return USERNAME_RULE
  }
  return detail
}
