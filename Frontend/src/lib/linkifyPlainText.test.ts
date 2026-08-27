import { describe, expect, it } from "vitest"

import { parsePlainTextLinks, safeHttpHref } from "@/lib/linkifyPlainText"

describe("safeHttpHref", () => {
  it("accepts http and https URLs", () => {
    expect(safeHttpHref("https://example.com/path")).toBe(
      "https://example.com/path"
    )
    expect(safeHttpHref("http://example.com")).toBe("http://example.com/")
  })

  it("prefixes www. with https", () => {
    expect(safeHttpHref("www.example.com/deck")).toBe(
      "https://www.example.com/deck"
    )
  })

  it("rejects javascript and other schemes", () => {
    expect(safeHttpHref("javascript:alert(1)")).toBeNull()
    expect(safeHttpHref("data:text/html,hi")).toBeNull()
  })
})

describe("parsePlainTextLinks", () => {
  it("leaves plain text untouched", () => {
    expect(parsePlainTextLinks("mono red aggro")).toEqual([
      { kind: "text", value: "mono red aggro" },
    ])
  })

  it("linkifies https URLs and strips trailing punctuation from href", () => {
    expect(parsePlainTextLinks("See https://example.com/deck.")).toEqual([
      { kind: "text", value: "See " },
      {
        kind: "link",
        href: "https://example.com/deck",
        label: "https://example.com/deck.",
      },
    ])
  })

  it("keeps unsafe URLs as plain text", () => {
    expect(parsePlainTextLinks("bad javascript:alert(1) link")).toEqual([
      { kind: "text", value: "bad javascript:alert(1) link" },
    ])
  })

  it("preserves newlines in text segments", () => {
    expect(parsePlainTextLinks("line one\nhttps://example.com\nline three")).toEqual([
      { kind: "text", value: "line one\n" },
      { kind: "link", href: "https://example.com/", label: "https://example.com" },
      { kind: "text", value: "\nline three" },
    ])
  })
})
