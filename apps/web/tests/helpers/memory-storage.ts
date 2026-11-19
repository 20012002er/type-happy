export type StorageOperation = 'getItem' | 'setItem' | 'removeItem' | 'clear'

export class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>()
  private readonly failures = new Map<StorageOperation, Error[]>()

  constructor(initialValues: Record<string, string> = {}) {
    for (const [key, value] of Object.entries(initialValues)) {
      this.values.set(key, value)
    }
  }

  get length() {
    return this.values.size
  }

  key(index: number) {
    return [...this.values.keys()][index] ?? null
  }

  getItem(key: string) {
    this.throwIfFailed('getItem')
    return this.values.get(String(key)) ?? null
  }

  setItem(key: string, value: string) {
    this.throwIfFailed('setItem')
    this.values.set(String(key), String(value))
  }

  removeItem(key: string) {
    this.throwIfFailed('removeItem')
    this.values.delete(String(key))
  }

  clear() {
    this.throwIfFailed('clear')
    this.values.clear()
  }

  failNext(operation: StorageOperation, error = new Error(`Injected ${operation} failure`)) {
    const queue = this.failures.get(operation) ?? []
    queue.push(error)
    this.failures.set(operation, queue)
  }

  snapshot() {
    return Object.fromEntries(
      [...this.values.entries()].sort(([left], [right]) => left.localeCompare(right)),
    )
  }

  private throwIfFailed(operation: StorageOperation) {
    const error = this.failures.get(operation)?.shift()
    if (error) throw error
  }
}
