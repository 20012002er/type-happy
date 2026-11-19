export interface ManualClock {
  now: () => number
  date: () => Date
  set: (timestamp: number) => void
  advance: (milliseconds: number) => void
}

export function createManualClock(initialTimestamp = 0): ManualClock {
  let current = initialTimestamp

  const assertFinite = (value: number) => {
    if (!Number.isFinite(value)) throw new Error('Clock value must be finite')
  }

  return {
    now: () => current,
    date: () => new Date(current),
    set(timestamp) {
      assertFinite(timestamp)
      current = timestamp
    },
    advance(milliseconds) {
      assertFinite(milliseconds)
      current += milliseconds
    },
  }
}
