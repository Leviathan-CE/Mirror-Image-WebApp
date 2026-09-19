/** Role checks shared by route guards and headers (no React). */

export const ADMIN_ROLE = "admin" as const
export const DEVELOPER_ROLE = "developer" as const

const CARD_MANAGER_ROLES = new Set<string>([ADMIN_ROLE, DEVELOPER_ROLE])

export function isAdminRole(role: string | null | undefined): boolean {
  return role === ADMIN_ROLE
}

export function canManageCards(role: string | null | undefined): boolean {
  return typeof role === "string" && CARD_MANAGER_ROLES.has(role)
}
