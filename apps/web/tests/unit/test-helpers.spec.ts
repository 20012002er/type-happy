import { describe, expect, it } from 'vitest'
import { createEmptyVersionedSnapshot, malformedJsonFixtures } from '../fixtures/storage'
import { createManualClock } from '../helpers/manual-clock'
import { MemoryStorage } from '../helpers/memory-storage'
import { createSeededRandom } from '../helpers/seeded-random'

describe('manual clock', () => {
  it('advances, sets and rolls back time without using the system clock', () => {
    const clock = createManualClock(1_000)

    expect(clock.now()).toBe(1_000)
    clock.advance(500)
    expect(clock.date().getTime()).toBe(1_500)
    clock.advance(-250)
    expect(clock.now()).toBe(1_250)
    clock.set(9_000)
    expect(clock.now()).toBe(9_000)
    expect(() => clock.advance(Number.NaN)).toThrow('finite')
  })
})

describe('seeded random', () => {
  it('repeats the same sequence for the same seed', () => {
    const left = createSeededRandom(42)
    const right = createSeededRandom(42)
    const different = createSeededRandom(43)

    const sequence = Array.from({ length: 20 }, () => left.next())
    expect(sequence).toEqual(Array.from({ length: 20 }, () => right.next()))
    expect(sequence.every((value) => value >= 0 && value < 1)).toBe(true)
    expect(sequence).not.toEqual(Array.from({ length: 20 }, () => different.next()))
  })

  it('provides bounded integers and stable collection picks', () => {
    const random = createSeededRandom(7)
    const values = Array.from({ length: 100 }, () => random.int(2, 5))

    expect(values.every((value) => Number.isInteger(value) && value >= 2 && value <= 5)).toBe(true)
    expect(['a', 'b', 'c']).toContain(random.pick(['a', 'b', 'c']))
    expect(() => random.int(3, 2)).toThrow('invalid')
    expect(() => random.pick([])).toThrow('empty')
  })
})

describe('memory storage', () => {
  it('implements browser storage operations and fresh snapshots', () => {
    const storage = new MemoryStorage({ existing: 'yes' })
    const snapshot = createEmptyVersionedSnapshot()
    snapshot.revision = 3

    storage.setItem('learning', JSON.stringify(snapshot))
    expect(storage.getItem('existing')).toBe('yes')
    expect(storage.getItem('missing')).toBeNull()
    expect(storage.length).toBe(2)
    expect(storage.snapshot()).toEqual({ existing: 'yes', learning: JSON.stringify(snapshot) })

    storage.removeItem('existing')
    expect(storage.getItem('existing')).toBeNull()
    storage.clear()
    expect(storage.length).toBe(0)
    expect(createEmptyVersionedSnapshot().revision).toBe(0)
  })

  it('injects a one-shot quota failure and then recovers', () => {
    const storage = new MemoryStorage()
    storage.failNext('setItem', new DOMException('Storage is full', 'QuotaExceededError'))

    expect(() => storage.setItem('learning', 'value')).toThrow('Storage is full')
    expect(storage.getItem('learning')).toBeNull()
    storage.setItem('learning', 'value')
    expect(storage.getItem('learning')).toBe('value')

    storage.failNext('getItem')
    expect(() => storage.getItem('learning')).toThrow('Injected getItem failure')
    expect(storage.getItem('learning')).toBe('value')
  })

  it('provides malformed JSON fixtures for recovery tests', () => {
    for (const fixture of malformedJsonFixtures) {
      expect(() => JSON.parse(fixture)).toThrow()
    }
  })
})
