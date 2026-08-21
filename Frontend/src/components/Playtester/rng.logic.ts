/**
 * Seeded 32-bit PRNG for replayable shuffles and minted instance ids.
 * Same seed + same call count ⇒ same stream (host and later a rules server).
 */

/** Inclusive 0 … 2^32-1 state. */
export type RngState = number

/** Returns [0, 1). */
export type RngNext = () => number

/**
 * Mulberry32 — one 32-bit add/multiply mix per call.
 * Not cryptographic; it only has to be deterministic and cheap.
 *
 * Why a seed instead of Math.random: two clients (or a replay) must draw
 * the same shuffle from the same integer. Math.random cannot do that.
 */
export function mulberry32(seed: number): { next: RngNext; getState: () => RngState } {
  let a = seed >>> 0
  return {
    getState: () => a >>> 0,
    next() {
      a = (a + 0x6d2b79f5) | 0
      let t = Math.imul(a ^ (a >>> 15), 1 | a)
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    },
  }
}

/** One step: new state plus a [0, 1) sample. */
export function rngStep(state: RngState): { state: RngState; value: number } {
  const rng = mulberry32(state)
  const value = rng.next()
  return { state: rng.getState(), value }
}

/** Bind a mutable state cell so shuffleInPlace can call `next()` repeatedly. */
export function rngFromState(state: { current: RngState }): RngNext {
  return () => {
    const stepped = rngStep(state.current)
    state.current = stepped.state
    return stepped.value
  }
}
