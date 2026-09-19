import { describe, expect, it } from "vitest"

import { acceptInviteErrorText } from "@/pages/auth/acceptInvite.logic"

describe("acceptInviteErrorText", () => {
  it("explains a bad username instead of showing the raw code", () => {
    expect(acceptInviteErrorText("invalid_username")).toContain("underscore")
    expect(acceptInviteErrorText("email_auth_failed")).toContain("blank")
  })
})
