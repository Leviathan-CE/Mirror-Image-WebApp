export function deleteUsernameMatches(typed: string, actual: string): boolean {
  return typed === actual
}

export function deleteAccountErrorText(detail: string): string {
  if (detail === "username_mismatch") {
    return "Username does not match this account."
  }
  if (detail === "cannot_remove_last_admin") {
    return "Cannot delete the last admin account."
  }
  if (detail === "stripe_cancel_failed") {
    return "Could not cancel the Stripe subscription. Try again or contact support."
  }
  return "Could not delete the account."
}
