import type { Clock, IdGenerator, Random, StoragePort } from './ports'

export const systemClock: Clock = {
  now: () => Date.now(),
  date: () => new Date(),
}

export const mathRandom: Random = {
  next: () => Math.random(),
  int(minimum, maximum) {
    if (!Number.isInteger(minimum) || !Number.isInteger(maximum) || minimum > maximum) {
      throw new Error('Random integer range is invalid')
    }
    return minimum + Math.floor(Math.random() * (maximum - minimum + 1))
  },
  pick(values) {
    if (values.length === 0) throw new Error('Cannot pick from an empty collection')
    return values[this.int(0, values.length - 1)]
  },
}

export function createCryptoIdGenerator(
  source: Pick<Crypto, 'randomUUID'> = globalThis.crypto,
): IdGenerator {
  return { next: () => source.randomUUID() }
}

export function getBrowserStorage(): StoragePort {
  return window.localStorage
}
