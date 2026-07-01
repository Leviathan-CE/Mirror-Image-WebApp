import { describe, expect, it } from "vitest"

import { cn } from "./utils"

describe("cn", () => {
  it("merges class names", () => {
    expect(cn("px-2", "text-sm")).toBe("px-2 text-sm")
  })

  it("resolves conflicting tailwind utilities", () => {
    expect(cn("px-2", "px-4")).toBe("px-4")
  })
})
