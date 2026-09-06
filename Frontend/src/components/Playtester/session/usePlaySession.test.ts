import { describe, expect, it } from "vitest"

import { canStartTurn } from "@/components/Playtester/session/usePlaySession"

describe("canStartTurn", () => {
  it("allows starting your own turn in a networked match", () => {
    expect(canStartTurn("host", "p1", "p1")).toBe(true)
    expect(canStartTurn("guest", "p2", "p2")).toBe(true)
  })

  it("blocks a networked player from starting a turn that is not theirs", () => {
    // Regression: the START TURN action used to ready cards, draw, and hand
    // the turn to whoever clicked it, with no check against `turnSeat` — a
    // player could steal a turn mid-opponent's-turn in a live P2P match.
    expect(canStartTurn("guest", "p1", "p2")).toBe(false)
    expect(canStartTurn("host", "p2", "p1")).toBe(false)
  })

  it("stays exempt in hotseat — one client owns both seats", () => {
    expect(canStartTurn("local", "p2", "p1")).toBe(true)
    expect(canStartTurn("local", "p1", "p1")).toBe(true)
  })
})
