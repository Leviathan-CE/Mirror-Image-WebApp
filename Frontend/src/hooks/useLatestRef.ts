/**
 * Mirror a changing value into a ref for use in event handlers / timeouts.
 * Layout effect so the ref is current before paint / pointer handlers run.
 */
import { useLayoutEffect, useRef, type RefObject } from "react"

export function useLatestRef<T>(value: T): RefObject<T> {
  const ref = useRef(value)
  useLayoutEffect(() => {
    ref.current = value
  })
  return ref
}
