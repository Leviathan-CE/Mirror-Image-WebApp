import { act, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { LONG_PRESS_MS } from "@/components/Playtester/board/touchPlay.logic"
import { useLongPressMenu } from "@/hooks/useLongPressMenu"

describe("useLongPressMenu", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("fires the menu after the delay and aborts drag", () => {
    const { result } = renderHook(() => useLongPressMenu())
    const onMenu = vi.fn()
    const onAbortDrag = vi.fn()

    act(() => {
      result.current.arm({
        pointerId: 1,
        clientX: 40,
        clientY: 80,
        enabled: true,
        onMenu,
        onAbortDrag,
      })
    })

    expect(onMenu).not.toHaveBeenCalled()
    act(() => {
      vi.advanceTimersByTime(LONG_PRESS_MS)
    })
    expect(onAbortDrag).toHaveBeenCalledTimes(1)
    expect(onMenu).toHaveBeenCalledWith(40, 80)
    expect(result.current.release(1)).toBe(true)
  })

  it("does not arm when disabled", () => {
    const { result } = renderHook(() => useLongPressMenu())
    const onMenu = vi.fn()

    act(() => {
      result.current.arm({
        pointerId: 1,
        clientX: 0,
        clientY: 0,
        enabled: false,
        onMenu,
      })
      vi.advanceTimersByTime(LONG_PRESS_MS + 50)
    })

    expect(onMenu).not.toHaveBeenCalled()
  })

  it("cancels when the pointer moves too far", () => {
    const { result } = renderHook(() => useLongPressMenu())
    const onMenu = vi.fn()

    act(() => {
      result.current.arm({
        pointerId: 1,
        clientX: 10,
        clientY: 10,
        enabled: true,
        onMenu,
      })
      result.current.noteMove(1, 40, 10)
      vi.advanceTimersByTime(LONG_PRESS_MS + 50)
    })

    expect(onMenu).not.toHaveBeenCalled()
    expect(result.current.release(1)).toBe(false)
  })

  it("cancels on early release", () => {
    const { result } = renderHook(() => useLongPressMenu())
    const onMenu = vi.fn()

    act(() => {
      result.current.arm({
        pointerId: 1,
        clientX: 10,
        clientY: 10,
        enabled: true,
        onMenu,
      })
      expect(result.current.release(1)).toBe(false)
      vi.advanceTimersByTime(LONG_PRESS_MS + 50)
    })

    expect(onMenu).not.toHaveBeenCalled()
  })
})
