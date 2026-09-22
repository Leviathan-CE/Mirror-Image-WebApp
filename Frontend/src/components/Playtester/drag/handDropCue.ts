/**
 * Signals that a card drag has crossed the pickup threshold and can land
 * in the hand. Drag sources begin once on that crossing and end once when
 * the gesture finishes. The counter stays up if those calls ever nest.
 */

type Listener = (active: boolean) => void

let depth = 0
const listeners = new Set<Listener>()

function emit() {
  const active = depth > 0
  for (const listener of listeners) listener(active)
}

export function beginHandDropCue() {
  depth += 1
  if (depth !== 1) return
  emit()
}

export function endHandDropCue() {
  if (depth === 0) return
  depth -= 1
  if (depth !== 0) return
  emit()
}

export function subscribeHandDropCue(listener: Listener) {
  listener(depth > 0)
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
