import { afterEach, describe, expect, it } from "vitest"

import {
  beginHandDropCue,
  endHandDropCue,
  subscribeHandDropCue,
} from "@/components/Playtester/drag/handDropCue"

afterEach(() => {
  let active = true
  const stop = subscribeHandDropCue((next) => {
    active = next
  })
  while (active) endHandDropCue()
  stop()
})

describe("handDropCue", () => {
  it("turns on at the first pickup and off when that drag ends", () => {
    const seen: boolean[] = []
    const stop = subscribeHandDropCue((active) => {
      seen.push(active)
    })

    beginHandDropCue()
    beginHandDropCue()
    endHandDropCue()
    endHandDropCue()

    expect(seen).toEqual([false, true, false])
    stop()
  })

  it("ignores an end when nothing is being dragged", () => {
    const seen: boolean[] = []
    const stop = subscribeHandDropCue((active) => {
      seen.push(active)
    })

    endHandDropCue()

    expect(seen).toEqual([false])
    stop()
  })
})
