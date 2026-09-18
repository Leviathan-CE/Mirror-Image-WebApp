import { describe, expect, it } from "vitest"

import { playWsUrl } from "@/lib/api/playRooms"

describe("playWsUrl", () => {
  it("does not put a JWT on the websocket URL", () => {
    const url = playWsUrl("AB12CD")
    expect(url).not.toMatch(/token/)
    expect(url).toContain("/play/ws/rooms/AB12CD")
  })
})
