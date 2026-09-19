import { describe, expect, it } from "vitest"

import { canManageCards, isAdminRole } from "@/lib/roles.logic"

describe("roles.logic", () => {
  it("treats only admin as full admin", () => {
    expect(isAdminRole("admin")).toBe(true)
    expect(isAdminRole("developer")).toBe(false)
    expect(isAdminRole("user")).toBe(false)
  })

  it("lets admin and developer manage cards", () => {
    expect(canManageCards("admin")).toBe(true)
    expect(canManageCards("developer")).toBe(true)
    expect(canManageCards("user")).toBe(false)
    expect(canManageCards("distributor")).toBe(false)
  })
})
