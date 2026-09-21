import { describe, expect, it } from "vitest"

import { USERNAME_RULE } from "@/lib/username.logic"
import { acceptInviteErrorText } from "./acceptInvite.logic"

describe("acceptInviteErrorText", () => {
  it("explains a bad or used invite token", () => {
    expect(acceptInviteErrorText("invalid_or_expired_token")).toBe(
      "This invite is invalid or expired."
    )
  })

  it("maps user_name validation to the public rule", () => {
    expect(
      acceptInviteErrorText(
        "Value error, user_name must be 3–32 chars: letters, numbers, underscore only"
      )
    ).toBe(USERNAME_RULE)
  })
})
