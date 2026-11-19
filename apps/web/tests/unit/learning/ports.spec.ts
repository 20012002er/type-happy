import { afterEach, describe, expect, it, vi } from 'vitest'
import { toLocalDateKey } from '../../../src/learning/date-key'
import type { Clock, Random, StoragePort } from '../../../src/learning/ports'
import {
  createCryptoIdGenerator,
  getBrowserStorage,
  mathRandom,
  systemClock,
} from '../../../src/learning/system-adapters'
import { createManualClock } from '../../helpers/manual-clock'
import { MemoryStorage } from '../../helpers/memory-storage'
import { createSeededRandom } from '../../helpers/seeded-random'

afterEach(() => {
  vi.useRealTimers()
  window.localStorage.clear()
})

describe('replaceable ports', () => {
  it('accepts the existing manual test adapters without production dependencies', () => {
    const clock: Clock = createManualClock(123)
    const random: Random = createSeededRandom(7)
    const storage: StoragePort = new MemoryStorage()

    expect(clock.now()).toBe(123)
    expect(random.next()).toBeGreaterThanOrEqual(0)
    storage.setItem('key', 'value')
    expect(storage.getItem('key')).toBe('value')
    storage.removeItem('key')
    expect(storage.getItem('key')).toBeNull()
  })

  it('provides system clock implementations separately', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 10, 19, 8, 30))
    expect(systemClock.now()).toBe(Date.now())
    expect(systemClock.date().getTime()).toBe(Date.now())
  })

  it('provides bounded math random integers and picks', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.999)
    expect(mathRandom.next()).toBe(0.999)
    expect(mathRandom.int(2, 5)).toBe(5)
    expect(mathRandom.pick(['a', 'b', 'c'])).toBe('c')
    expect(() => mathRandom.int(5, 2)).toThrow('invalid')
    expect(() => mathRandom.int(1.5, 2)).toThrow('invalid')
    expect(() => mathRandom.pick([])).toThrow('empty')
  })

  it('uses injected crypto UUIDs and browser local storage', () => {
    const uuid = '00000000-0000-4000-8000-000000000000' as const
    const ids = createCryptoIdGenerator({ randomUUID: () => uuid })
    expect(ids.next()).toBe(uuid)

    const storage = getBrowserStorage()
    storage.setItem('learning', 'saved')
    expect(storage.getItem('learning')).toBe('saved')
    storage.removeItem('learning')
    expect(storage.getItem('learning')).toBeNull()
  })
})

describe('device local date keys', () => {
  it('uses local calendar fields across midnight and accepts timestamps', () => {
    const beforeMidnight = new Date(2026, 0, 2, 23, 59, 59, 999)
    const afterMidnight = new Date(2026, 0, 3, 0, 0, 0, 0)

    expect(toLocalDateKey(beforeMidnight)).toBe('2026-01-02')
    expect(toLocalDateKey(afterMidnight)).toBe('2026-01-03')
    expect(toLocalDateKey(afterMidnight.getTime())).toBe('2026-01-03')
  })

  it('does not substitute the UTC ISO date for the device date', () => {
    const date = new Date('2026-06-01T23:30:00.000Z')
    vi.spyOn(date, 'getFullYear').mockReturnValue(2026)
    vi.spyOn(date, 'getMonth').mockReturnValue(5)
    vi.spyOn(date, 'getDate').mockReturnValue(2)
    const toISOString = vi.spyOn(date, 'toISOString')

    expect(toLocalDateKey(date)).toBe('2026-06-02')
    expect(toISOString).not.toHaveBeenCalled()
  })

  it('rejects invalid dates instead of creating unstable keys', () => {
    expect(() => toLocalDateKey(new Date('invalid'))).toThrow('invalid date')
    expect(() => toLocalDateKey(Number.NaN)).toThrow('invalid date')
  })
})
