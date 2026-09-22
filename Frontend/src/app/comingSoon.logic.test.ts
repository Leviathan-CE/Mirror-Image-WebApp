import { describe, expect, it } from "vitest"

import { comingSoonBlocksVisitor } from "@/app/comingSoon.logic"
import { ROUTES } from "@/lib/route"

describe("comingSoonBlocksVisitor", () => {
  it("lets everyone through when the flag is off", () => {
    expect(
      comingSoonBlocksVisitor({
        comingSoon: false,
        role: "user",
        pathname: ROUTES.HOME,
      })
    ).toBe(false)
  })

  it("lets developers through every path", () => {
    expect(
      comingSoonBlocksVisitor({
        comingSoon: true,
        role: "developer",
        pathname: ROUTES.HOME,
      })
    ).toBe(false)
  })

  it("lets admins through every path", () => {
    expect(
      comingSoonBlocksVisitor({
        comingSoon: true,
        role: "admin",
        pathname: ROUTES.HOME,
      })
    ).toBe(false)
    expect(
      comingSoonBlocksVisitor({
        comingSoon: true,
        role: "admin",
        pathname: ROUTES.PLAY_TESTER,
      })
    ).toBe(false)
  })

  it("keeps login and admin console reachable for staff", () => {
    expect(
      comingSoonBlocksVisitor({
        comingSoon: true,
        role: null,
        pathname: ROUTES.LOGIN,
      })
    ).toBe(false)
    expect(
      comingSoonBlocksVisitor({
        comingSoon: true,
        role: null,
        pathname: ROUTES.ADMIN,
      })
    ).toBe(false)
    expect(
      comingSoonBlocksVisitor({
        comingSoon: true,
        role: null,
        pathname: ROUTES.ADMIN_CARDS,
      })
    ).toBe(false)
  })

  it("blocks the public app for guests and plain users", () => {
    expect(
      comingSoonBlocksVisitor({
        comingSoon: true,
        role: null,
        pathname: ROUTES.HOME,
      })
    ).toBe(true)
    expect(
      comingSoonBlocksVisitor({
        comingSoon: true,
        role: "user",
        pathname: ROUTES.MAIN,
      })
    ).toBe(true)
    expect(
      comingSoonBlocksVisitor({
        comingSoon: true,
        role: "user",
        pathname: ROUTES.REGISTER,
      })
    ).toBe(true)
    expect(
      comingSoonBlocksVisitor({
        comingSoon: true,
        role: null,
        pathname: ROUTES.UPDATES,
      })
    ).toBe(true)
  })
})
