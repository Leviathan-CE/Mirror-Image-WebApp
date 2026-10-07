import { act, renderHook } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import type { PlayingCardInstance } from "@/components/Playtester/session/playCard.logic"
import {
  HOVER_ZOOM_DELAY_MS,
  useCardZoom,
} from "@/components/Playtester/board/useCardZoom"

function card(
  overrides: Partial<PlayingCardInstance> = {}
): PlayingCardInstance {
  return {
    instanceId: "a",
    name: "Spirit Wire",
    ...overrides,
  } as PlayingCardInstance
}

describe("useCardZoom", () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it("shows a preview after the hover delay and clears on leave", () => {
    vi.useFakeTimers()
    const { result } = renderHook(() => useCardZoom())
    const anchor = document.createElement("div")

    act(() => result.current.beginHover(card(), anchor))
    expect(result.current.preview).toBeNull()

    act(() => {
      vi.advanceTimersByTime(HOVER_ZOOM_DELAY_MS)
    })
    expect(result.current.preview?.card.instanceId).toBe("a")

    act(() => result.current.endHover())
    expect(result.current.preview).toBeNull()
  })

  it("swaps to the next card immediately once a preview is open", () => {
    vi.useFakeTimers()
    const { result } = renderHook(() => useCardZoom())
    const anchor = document.createElement("div")

    act(() => result.current.beginHover(card(), anchor))
    act(() => {
      vi.advanceTimersByTime(HOVER_ZOOM_DELAY_MS)
    })
    act(() =>
      result.current.beginHover(card({ instanceId: "b", name: "Other" }), anchor)
    )
    expect(result.current.preview?.card.instanceId).toBe("b")
  })

  it("does not preview a face-down card", () => {
    vi.useFakeTimers()
    const { result } = renderHook(() => useCardZoom())

    act(() =>
      result.current.beginHover(
        card({ faceDown: true }),
        document.createElement("div")
      )
    )
    act(() => {
      vi.advanceTimersByTime(HOVER_ZOOM_DELAY_MS)
    })
    expect(result.current.preview).toBeNull()
  })

  it("ignores a hover that ends before the delay", () => {
    vi.useFakeTimers()
    const { result } = renderHook(() => useCardZoom())

    act(() => result.current.beginHover(card(), document.createElement("div")))
    act(() => result.current.endHover())
    act(() => {
      vi.advanceTimersByTime(HOVER_ZOOM_DELAY_MS)
    })
    expect(result.current.preview).toBeNull()
  })
})
