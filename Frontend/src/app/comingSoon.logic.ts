/**
 * Who still sees the real app while coming-soon is on.
 *
 * Admins keep the site (so they can turn the flag off).
 * Login / password / invite routes stay open so staff can sign in.
 * Everyone else gets the splash.
 */

import { isStaffRole, ROUTES } from "@/lib/route"

function pathIs(pathname: string, route: string): boolean {
  return pathname === route || pathname.startsWith(`${route}/`)
}

export function comingSoonBlocksVisitor(args: {
  comingSoon: boolean
  role: string | null | undefined
  pathname: string
}): boolean {
  if (!args.comingSoon) return false
  if (isStaffRole(args.role)) return false

  const path = args.pathname
  if (pathIs(path, ROUTES.LOGIN)) return false
  if (pathIs(path, ROUTES.FORGOT_PASSWORD)) return false
  if (pathIs(path, ROUTES.RESET_PASSWORD)) return false
  if (pathIs(path, ROUTES.VERIFY_EMAIL)) return false
  if (pathIs(path, ROUTES.ACCEPT_INVITE)) return false
  if (pathIs(path, ROUTES.ADMIN)) return false
  return true
}
