import { describe, expect, it } from "vitest"

import { intentAllowed, isPlayNetMessage } from "@/components/Playtester/net/playNet.logic"

describe("playNet messages", () => {
  it("accepts typed envelopes", () => {
    expect(isPlayNetMessage({ type: "snapshot" })).toBe(true)
    expect(isPlayNetMessage({ type: "intent", action: { t: "sh", seat: "p2" } })).toBe(
      true
    )
    expect(isPlayNetMessage(null)).toBe(false)
    expect(isPlayNetMessage({ foo: 1 })).toBe(false)
  })

  it("rejects intents aimed at the other seat", () => {
    expect(intentAllowed({ t: "sh", seat: "p2" }, "p2")).toBe(true)
    expect(intentAllowed({ t: "sh", seat: "p1" }, "p2")).toBe(false)
    expect(intentAllowed({ t: "ts", seat: "p1" }, "p2")).toBe(true)
    expect(
      intentAllowed({ t: "mv", seat: "p2", i: ["p1-card"], z: "hand" }, "p2", (id) =>
        id.startsWith("p1") ? "p1" : "p2"
      )
    ).toBe(false)
  })

  it("allows counter and expend/ready intents on the other seat's cards", () => {
    const ownerOf = (id: string) => (id.startsWith("p1") ? "p1" : "p2")
    expect(
      intentAllowed({ t: "ct", i: ["p1-card"], k: "damage", d: 1 }, "p2", ownerOf)
    ).toBe(true)
    expect(intentAllowed({ t: "xp", i: ["p1-card"] }, "p2", ownerOf)).toBe(true)
    // Still rejected for actions that are not counter/expend, e.g. delete.
    expect(intentAllowed({ t: "rm", i: ["p1-card"] }, "p2", ownerOf)).toBe(false)
  })
})
