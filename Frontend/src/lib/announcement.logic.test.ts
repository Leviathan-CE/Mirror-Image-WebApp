import { describe, expect, it } from "vitest"

import {
  markdownImageToken,
  parseImageRef,
  parseYoutubeId,
  sanitizeAnnouncementMarkdown,
  splitTaggedText,
} from "@/lib/announcement.logic"

describe("parseYoutubeId", () => {
  it("accepts watch and short links", () => {
    expect(parseYoutubeId("dQw4w9wgXcQ")).toBe("dQw4w9wgXcQ")
    expect(
      parseYoutubeId("https://www.youtube.com/watch?v=dQw4w9wgXcQ")
    ).toBe("dQw4w9wgXcQ")
    expect(parseYoutubeId("https://youtu.be/dQw4w9wgXcQ")).toBe("dQw4w9wgXcQ")
  })

  it("rejects other hosts and schemes", () => {
    expect(parseYoutubeId("https://attacker.example/watch?v=dQw4w9wgXcQ")).toBeNull()
    expect(parseYoutubeId("javascript:alert(1)")).toBeNull()
  })
})

describe("sanitizeAnnouncementMarkdown", () => {
  it("strips tags and code, keeps allowlisted images", () => {
    const out = sanitizeAnnouncementMarkdown(
      'Hello <script>alert(1)</script> ![x](https://attacker.example) ![ok](media:12) `rm` done'
    )
    expect(out).not.toContain("<script>")
    expect(out).not.toContain("attacker")
    expect(out).not.toContain("rm")
    expect(out).toContain("![ok](media:12)")
    expect(out).toContain("Hello")
    expect(out).toContain("done")
  })
})

describe("image refs and tags", () => {
  it("parses allowlisted refs", () => {
    expect(parseImageRef("media:12")).toEqual({ kind: "media", id: 12 })
    expect(parseImageRef("https://attacker.example")).toBeNull()
    expect(markdownImageToken("card-art", 9, "Pilot")).toBe(
      "![Pilot](card-art:9)"
    )
  })

  it("maps LIF_POW to the split icon", () => {
    const parts = splitTaggedText("Pay [LIF_POW] now")
    expect(parts.some((p) => p.type === "tag" && p.icon === "lifPow")).toBe(
      true
    )
  })
})
