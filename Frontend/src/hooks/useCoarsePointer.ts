/**
 * True when the primary pointer is coarse (typical phone / tablet).
 * Mirrors the deck builder's matchMedia("(pointer: coarse)") gate.
 */

import { useEffect, useState } from "react"

export function useCoarsePointer(): boolean {
  const [coarse, setCoarse] = useState(false)

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return
    const media = window.matchMedia("(pointer: coarse)")
    function sync() {
      setCoarse(media.matches)
    }
    sync()
    media.addEventListener("change", sync)
    return () => media.removeEventListener("change", sync)
  }, [])

  return coarse
}
