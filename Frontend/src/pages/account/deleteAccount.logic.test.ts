import { describe, expect, it } from "vitest"

import {
  deleteAccountErrorText,
  deleteUsernameMatches,
} from "./deleteAccount.logic"

describe("deleteUsernameMatches", () => {
  it("requires an exact username", () => {
    expect(deleteUsernameMatches("admin", "admin")).toBe(true)
    expect(deleteUsernameMatches("Admin", "admin")).toBe(false)
    expect(deleteUsernameMatches("admin ", "admin")).toBe(false)
  })
})

describe("deleteAccountErrorText", () => {
  it("maps known API details", () => {
    expect(deleteAccountErrorText("username_mismatch")).toContain("match")
    expect(deleteAccountErrorText("cannot_remove_last_admin")).toContain(
      "last admin"
    )
  })
})
