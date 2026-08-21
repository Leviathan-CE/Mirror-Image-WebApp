import { afterEach, describe, expect, it, vi } from "vitest"

import { cardArtUrl, deckCoverUrl, fetchDeckDetail } from "@/lib/api/decks"

type FetchMock = ReturnType<typeof stubFetch>

function jsonOk(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: async () => body,
  } as unknown as Response
}

function stubFetch(body: unknown = { id: 7, cards: [], categories: [] }) {
  const fetchMock = vi.fn(async (input: string | URL, init?: RequestInit) => {
    void input
    void init
    return jsonOk(body)
  })
  vi.stubGlobal("fetch", fetchMock)
  return fetchMock
}

/** URL the stubbed fetch was called with (it is passed a `URL`, not a string). */
function requestedUrl(mock: FetchMock): URL {
  const [input] = mock.mock.calls[0] ?? []
  return new URL(String(input))
}

describe("fetchDeckDetail", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("requests the deck with no query string by default", async () => {
    const fetchMock = stubFetch()

    await fetchDeckDetail(7, "jwt-token")

    const url = requestedUrl(fetchMock)
    expect(url.pathname).toBe("/decks/7")
    expect(url.search).toBe("")
    expect(fetchMock.mock.calls[0]?.[1]).toEqual({
      headers: { Authorization: "Bearer jwt-token" },
    })
  })

  it("sends a playtest room code so the server can pool card access", async () => {
    const fetchMock = stubFetch()

    await fetchDeckDetail(7, "jwt-token", "AB12CD")

    expect(requestedUrl(fetchMock).searchParams.get("room")).toBe("AB12CD")
  })

  it("omits the room param when there is no room", async () => {
    const fetchMock = stubFetch()

    await fetchDeckDetail(7, "jwt-token", null)

    expect(requestedUrl(fetchMock).searchParams.has("room")).toBe(false)
  })
})

describe("cardArtUrl", () => {
  const signed = "media/set-one/hard-light_thumbnail.png?exp=1787002200&sig=abc"

  it("returns null when the server withheld the art", () => {
    // Classified / unpublished cards come back with no path at all.
    expect(cardArtUrl(null)).toBeNull()
    expect(cardArtUrl(undefined, 12)).toBeNull()
    expect(cardArtUrl("")).toBeNull()
  })

  it("keeps the signature intact and adds the origin", () => {
    const url = new URL(cardArtUrl(signed)!)

    expect(url.pathname).toBe("/media/set-one/hard-light_thumbnail.png")
    expect(url.searchParams.get("sig")).toBe("abc")
    expect(url.searchParams.get("exp")).toBe("1787002200")
  })

  it("appends the cache-buster without clobbering the query", () => {
    const url = new URL(cardArtUrl(signed, 1699999999)!)

    expect(url.searchParams.get("sig")).toBe("abc")
    expect(url.searchParams.get("v")).toBe("1699999999")
  })

  it("starts the query string when a path carries no signature", () => {
    expect(cardArtUrl("media/set-one/a.png", 7)).toContain("a.png?v=7")
  })

  it("passes absolute urls through untouched", () => {
    const external = "https://cdn.example.com/art.png"
    expect(cardArtUrl(external, 7)).toBe(external)
  })
})

describe("deckCoverUrl", () => {
  it("adds the origin to the signed cover path", () => {
    const url = new URL(deckCoverUrl("media/decks/12/ops_cover.png?exp=1&sig=z")!)

    expect(url.pathname).toBe("/media/decks/12/ops_cover.png")
    expect(url.searchParams.get("sig")).toBe("z")
  })

  it("returns null without a cover", () => {
    expect(deckCoverUrl(null)).toBeNull()
  })
})
