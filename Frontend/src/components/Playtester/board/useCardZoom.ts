/**
 * Hover target for the Arena-style card preview.
 * The first card waits briefly. Moving onto another card swaps at once.
 * Face-down cards stay hidden.
 */

import { useEffect, useRef, useState } from "react"

import type { PlayingCardInstance } from "@/components/Playtester/session/playCard.logic"

export const HOVER_ZOOM_DELAY_MS = 120

export type CardZoomPreview = {
  card: PlayingCardInstance
  anchor: HTMLElement
}

export function useCardZoom() {
  const [preview, setPreview] = useState<CardZoomPreview | null>(null)
  const timerRef = useRef<number | null>(null)
  const hoveringIdRef = useRef<string | null>(null)
  const showingRef = useRef(false)

  function clearTimer() {
    if (timerRef.current == null) return
    window.clearTimeout(timerRef.current)
    timerRef.current = null
  }

  useEffect(() => () => clearTimer(), [])

  function show(card: PlayingCardInstance, anchor: HTMLElement) {
    showingRef.current = true
    setPreview({ card, anchor })
  }

  function beginHover(card: PlayingCardInstance, anchor: HTMLElement) {
    if (card.faceDown) return
    hoveringIdRef.current = card.instanceId
    clearTimer()
    if (showingRef.current) {
      show(card, anchor)
      return
    }
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null
      if (hoveringIdRef.current !== card.instanceId) return
      show(card, anchor)
    }, HOVER_ZOOM_DELAY_MS)
  }

  function endHover() {
    hoveringIdRef.current = null
    clearTimer()
    showingRef.current = false
    setPreview(null)
  }

  return { preview, beginHover, endHover }
}
