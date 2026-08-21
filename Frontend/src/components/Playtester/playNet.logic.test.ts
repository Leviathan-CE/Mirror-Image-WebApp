import { describe, expect, it } from "vitest"

import { intentAllowed, isPlayNetMessage } from "@/components/Playtester/playNet.logic"

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
})
