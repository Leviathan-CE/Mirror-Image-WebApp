/**
 * Mirror a changing value into a ref for use in event handlers / timeouts.
 * Write happens in an effect so render stays pure (react-hooks/refs).
 */
import { useEffect, useRef, type RefObject } from "react"

export function useLatestRef<T>(value: T): RefObject<T> {
  const ref = useRef(value)
  useEffect(() => {
    ref.current = value
  })
  return ref
}
