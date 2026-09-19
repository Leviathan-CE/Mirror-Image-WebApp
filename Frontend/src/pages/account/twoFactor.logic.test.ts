import { describe, expect, it } from "vitest"

import {
  twoFactorMethodLabel,
  twoFactorToggleChecked,
  twoFactorTogglePhaseAfterClick,
} from "@/pages/account/twoFactor.logic"
import { isTwoFactorChallenge } from "@/lib/api/auth"

describe("twoFactor.logic", () => {
  it("labels email 2FA", () => {
    expect(twoFactorMethodLabel("email")).toBe("email")
    expect(twoFactorMethodLabel(null)).toBe("off")
  })

  it("shows the switch as on while enabling, off while disabling", () => {
    expect(twoFactorToggleChecked(false, "idle")).toBe(false)
    expect(twoFactorToggleChecked(false, "enabling")).toBe(true)
    expect(twoFactorToggleChecked(true, "disabling")).toBe(false)
    expect(twoFactorToggleChecked(true, "idle")).toBe(true)
  })

  it("starts the opposite flow, or cancels a pending confirm", () => {
    expect(twoFactorTogglePhaseAfterClick(false, "idle")).toBe("enabling")
    expect(twoFactorTogglePhaseAfterClick(true, "idle")).toBe("disabling")
    expect(twoFactorTogglePhaseAfterClick(false, "enabling")).toBe("idle")
    expect(twoFactorTogglePhaseAfterClick(true, "disabling")).toBe("idle")
  })
})

describe("isTwoFactorChallenge", () => {
  it("detects a login challenge", () => {
    expect(
      isTwoFactorChallenge({
        requires_2fa: true,
        challenge_id: "abc",
        two_factor_method: "email",
        dest_hint: "a***@x.com",
      })
    ).toBe(true)
  })

  it("rejects a normal login", () => {
    expect(
      isTwoFactorChallenge({
        access_token: "tok",
        token_type: "bearer",
        user: {
          id: 1,
          user_name: "a",
          email: "a@b.c",
          role: "user",
        },
      })
    ).toBe(false)
  })
})
