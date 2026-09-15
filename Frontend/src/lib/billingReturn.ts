/**
 * Survive Stripe Checkout round-trips.
 *
 * Stripe is a top-level redirect. If success_url lands on a *different* origin
 * than the one that stored the JWT (localhost vs 127.0.0.1), the session looks
 * "logged out". We remember the exact origin+path we intended to return to.
 */

const BILLING_RETURN_KEY = "mi_billing_return"

export function rememberBillingReturn(pathWithQuery: string): void {
  try {
    sessionStorage.setItem(
      BILLING_RETURN_KEY,
      `${window.location.origin}${pathWithQuery}`
    )
  } catch {
    /* private mode / blocked storage */
  }
}

export function clearBillingReturn(): void {
  try {
    sessionStorage.removeItem(BILLING_RETURN_KEY)
  } catch {
    /* ignore */
  }
}

/**
 * If Stripe sent us to the wrong loopback host, bounce to the origin we left
 * from (same path/query) so localStorage JWT is visible again.
 */
export function repairBillingReturnOrigin(): boolean {
  try {
    const intended = sessionStorage.getItem(BILLING_RETURN_KEY)
    if (!intended) return false
    const url = new URL(intended)
    if (url.origin === window.location.origin) return false
    const hereHost = window.location.hostname
    const thereHost = url.hostname
    const loopback = new Set(["localhost", "127.0.0.1"])
    if (!loopback.has(hereHost) || !loopback.has(thereHost)) return false
    window.location.replace(
      `${url.origin}${window.location.pathname}${window.location.search}`
    )
    return true
  } catch {
    return false
  }
}
