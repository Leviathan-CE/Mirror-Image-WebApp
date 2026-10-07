import { describe, expect, it } from "vitest"

import { planArenaHoverPreview } from "@/components/Playtester/board/arenaHoverPreview.logic"

describe("planArenaHoverPreview", () => {
  it("puts the preview above a card sitting in the hand", () => {
    const anchor = { left: 400, top: 700, right: 500, bottom: 780 }
    const preview = planArenaHoverPreview(anchor, 1000, 800)
    expect(preview.top + preview.height).toBeLessThanOrEqual(anchor.top)
    expect(preview.left).toBeGreaterThanOrEqual(12)
    expect(preview.top).toBeGreaterThanOrEqual(12)
  })

  it("puts the preview on the open side of a battlefield card", () => {
    const anchor = { left: 1000, top: 200, right: 1140, bottom: 400 }
    const preview = planArenaHoverPreview(anchor, 1200, 800)
    expect(preview.left + preview.width).toBeLessThanOrEqual(anchor.left)
  })

  it("keeps the preview inside the viewport", () => {
    const preview = planArenaHoverPreview(
      { left: 8, top: 8, right: 80, bottom: 120 },
      390,
      700
    )
    expect(preview.left).toBeGreaterThanOrEqual(12)
    expect(preview.top).toBeGreaterThanOrEqual(12)
    expect(preview.left + preview.width).toBeLessThanOrEqual(390 - 12)
    expect(preview.top + preview.height).toBeLessThanOrEqual(700 - 12)
  })
})
