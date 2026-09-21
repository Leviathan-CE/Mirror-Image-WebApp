import { describe, expect, it } from "vitest"

import {
  USERNAME_RULE,
  createUsernameError,
  inviteUsernameError,
  isValidUsername,
} from "./username.logic"

describe("isValidUsername", () => {
  it("accepts letters numbers underscore in range", () => {
    expect(isValidUsername("admin")).toBe(true)
    expect(isValidUsername("user_01")).toBe(true)
    expect(isValidUsername("abc")).toBe(true)
  })

  it("rejects spaces email punctuation and short names", () => {
    expect(isValidUsername("Jane Doe")).toBe(false)
    expect(isValidUsername("a@b.com")).toBe(false)
    expect(isValidUsername("ab")).toBe(false)
    expect(isValidUsername("")).toBe(false)
  })
})

describe("inviteUsernameError", () => {
  it("allows blank invite name", () => {
    expect(inviteUsernameError("")).toBeNull()
    expect(inviteUsernameError("   ")).toBeNull()
  })

  it("rejects filled invalid names", () => {
    expect(inviteUsernameError("jane@site.com")).toBe(USERNAME_RULE)
  })
})

describe("createUsernameError", () => {
  it("requires a valid name", () => {
    expect(createUsernameError("")).toBe(USERNAME_RULE)
    expect(createUsernameError("ok_name")).toBeNull()
  })
})
