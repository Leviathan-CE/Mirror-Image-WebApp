/** Settings delete-account helpers (no React). */

export function canConfirmAccountDelete(
  typed: string,
  userName: string | null | undefined
): boolean {
  if (!userName) return false
  return typed.trim() === userName
}

export function deleteAccountHelp(detail: string): string {
  if (detail === "username_mismatch") {
    return "Username did not match. Type it exactly as shown."
  }
  if (detail === "cannot_remove_last_admin") {
    return "This is the last active admin. Promote someone else first."
  }
  if (detail === "stripe_cancel_failed") {
    return "Could not cancel the Stripe subscription. The account was not deleted."
  }
  return "Could not delete this account."
}
