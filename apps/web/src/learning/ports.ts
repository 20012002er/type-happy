export interface Clock {
  now: () => number
  date: () => Date
}

export interface Random {
  next: () => number
  int: (minimum: number, maximum: number) => number
  pick: <T>(values: readonly T[]) => T
}

export interface IdGenerator {
  next: () => string
}

export interface StoragePort {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
  removeItem: (key: string) => void
}
