import { act, renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { useDeckDetail } from "@/hooks/useDeckDetail"
import { fetchDeckDetail, type DeckDetail } from "@/lib/api/decks"

vi.mock("@/lib/api/decks", () => ({
  fetchDeckDetail: vi.fn(),
}))

const fetchDeckDetailMock = vi.mocked(fetchDeckDetail)

function deck(id: number): DeckDetail {
  return { id, cards: [], categories: [] } as unknown as DeckDetail
}

/** Make the next fetch hang so the in-flight status is observable. */
function deferFetch(): { resolve: (detail: DeckDetail) => void } {
  let resolve!: (detail: DeckDetail) => void
  fetchDeckDetailMock.mockImplementation(
    () =>
      new Promise<DeckDetail>((res) => {
        resolve = res
      })
  )
  return {
    resolve: (detail) => resolve(detail),
  }
}

describe("useDeckDetail", () => {
  beforeEach(() => {
    fetchDeckDetailMock.mockReset()
    fetchDeckDetailMock.mockImplementation(async (id: number) => deck(id))
  })

  it("forwards the playtest room code", async () => {
    renderHook(() => useDeckDetail(4, "jwt-token", "AB12CD"))

    await waitFor(() => {
      expect(fetchDeckDetailMock).toHaveBeenCalledWith(4, "jwt-token", "AB12CD")
    })
  })

  it("refetches when the opponent sits down and pooling turns on", async () => {
    const { rerender } = renderHook(
      ({ room }: { room: string | null }) => useDeckDetail(4, "jwt-token", room),
      { initialProps: { room: null as string | null } }
    )

    await waitFor(() => {
      expect(fetchDeckDetailMock).toHaveBeenCalledWith(4, "jwt-token", null)
    })

    rerender({ room: "AB12CD" })

    await waitFor(() => {
      expect(fetchDeckDetailMock).toHaveBeenCalledWith(4, "jwt-token", "AB12CD")
    })
    expect(fetchDeckDetailMock).toHaveBeenCalledTimes(2)
  })

  it("stays ready while re-resolving the same deck", async () => {
    // The playtester wipes its table when status leaves "ready", so pooling
    // must not blank a dealt board.
    const { result, rerender } = renderHook(
      ({ room }: { room: string | null }) => useDeckDetail(4, "jwt-token", room),
      { initialProps: { room: null as string | null } }
    )

    await waitFor(() => {
      expect(result.current.status).toBe("ready")
    })

    const pending = deferFetch()
    rerender({ room: "AB12CD" })
    await waitFor(() => {
      expect(fetchDeckDetailMock).toHaveBeenCalledTimes(2)
    })

    // In flight: the previous deck stays on screen, still ready.
    expect(result.current.status).toBe("ready")
    expect(result.current.deck?.id).toBe(4)

    await act(async () => pending.resolve(deck(4)))
    expect(result.current.status).toBe("ready")
  })

  it("shows loading when the deck id itself changes", async () => {
    const { result, rerender } = renderHook(
      ({ id }: { id: number }) => useDeckDetail(id, "jwt-token", null),
      { initialProps: { id: 4 } }
    )

    await waitFor(() => {
      expect(result.current.status).toBe("ready")
    })

    const pending = deferFetch()
    rerender({ id: 9 })

    await waitFor(() => {
      expect(result.current.status).toBe("loading")
    })

    await act(async () => pending.resolve(deck(9)))
    expect(result.current.status).toBe("ready")
    expect(result.current.deck?.id).toBe(9)
  })

  it("skips the request for a deck id that is not loaded yet", async () => {
    const { result } = renderHook(() => useDeckDetail(0, "jwt-token", null))

    await waitFor(() => {
      expect(result.current.status).toBe("loading")
    })
    expect(fetchDeckDetailMock).not.toHaveBeenCalled()
  })
})
