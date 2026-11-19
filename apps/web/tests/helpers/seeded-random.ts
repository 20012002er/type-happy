export interface SeededRandom {
  next: () => number
  int: (minimum: number, maximum: number) => number
  pick: <T>(values: readonly T[]) => T
}

export function createSeededRandom(seed: number): SeededRandom {
  let state = seed >>> 0

  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0
    let value = state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }

  const int = (minimum: number, maximum: number) => {
    if (!Number.isInteger(minimum) || !Number.isInteger(maximum) || minimum > maximum) {
      throw new Error('Random integer range is invalid')
    }
    return minimum + Math.floor(next() * (maximum - minimum + 1))
  }

  return {
    next,
    int,
    pick(values) {
      if (values.length === 0) throw new Error('Cannot pick from an empty collection')
      return values[int(0, values.length - 1)]
    },
  }
}
