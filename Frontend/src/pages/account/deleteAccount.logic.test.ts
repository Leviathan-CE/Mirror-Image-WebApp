import { describe, expect, it } from "vitest"

import {
  canConfirmAccountDelete,
  deleteAccountHelp,
} from "@/pages/account/deleteAccount.logic"

describe("deleteAccount.logic", () => {
  it("requires an exact username match", () => {
    expect(canConfirmAccountDelete("Hero", "Hero")).toBe(true)
    expect(canConfirmAccountDelete(" Hero ", "Hero")).toBe(true)
    expect(canConfirmAccountDelete("hero", "Hero")).toBe(false)
    expect(canConfirmAccountDelete("", "Hero")).toBe(false)
    expect(canConfirmAccountDelete("Hero", "")).toBe(false)
  })

  it("maps API details to settings copy", () => {
    expect(deleteAccountHelp("username_mismatch")).toContain("exactly")
    expect(deleteAccountHelp("stripe_cancel_failed")).toContain("not deleted")
    expect(deleteAccountHelp("cannot_remove_last_admin")).toContain("admin")
  })
})
