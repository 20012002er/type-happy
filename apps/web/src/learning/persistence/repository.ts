import type { StoragePort } from '../ports'
import { migrateLearningSnapshot } from './migrations'
import {
  createEmptyLearningSnapshot,
  LEARNING_STORAGE_KEY,
  parseLearningSnapshot,
  UnsupportedSchemaVersionError,
  type LearningSnapshot,
} from './snapshot'

export class CorruptedSnapshotError extends Error {
  constructor(cause: unknown) {
    super('学习存档已损坏，需要恢复', { cause })
    this.name = 'CorruptedSnapshotError'
  }
}

export class RevisionConflictError extends Error {
  constructor(expected: number, actual: number) {
    super(`学习存档已被其他页面更新，请重试（期望 ${expected}，实际 ${actual}）`)
    this.name = 'RevisionConflictError'
  }
}

export class PersistenceWriteError extends Error {
  constructor(cause: unknown) {
    super('本次进度暂未保存', { cause })
    this.name = 'PersistenceWriteError'
  }
}

export class LearningRepository {
  constructor(private readonly storage: StoragePort) {}

  load(): LearningSnapshot {
    const raw = this.storage.getItem(LEARNING_STORAGE_KEY)
    if (raw === null) return createEmptyLearningSnapshot()
    try {
      return migrateLearningSnapshot(JSON.parse(raw))
    } catch (error) {
      if (error instanceof UnsupportedSchemaVersionError) throw error
      throw new CorruptedSnapshotError(error)
    }
  }

  save(snapshot: LearningSnapshot, expectedRevision: number): LearningSnapshot {
    const current = this.load()
    if (current.revision !== expectedRevision || snapshot.revision !== expectedRevision) {
      throw new RevisionConflictError(expectedRevision, current.revision)
    }
    const next = parseLearningSnapshot({
      ...structuredClone(snapshot),
      revision: current.revision + 1,
    })
    try {
      this.storage.setItem(LEARNING_STORAGE_KEY, JSON.stringify(next))
    } catch (error) {
      throw new PersistenceWriteError(error)
    }
    return next
  }

  transact(
    expectedRevision: number,
    operation: (snapshot: LearningSnapshot) => LearningSnapshot | void,
  ): LearningSnapshot {
    const current = this.load()
    if (current.revision !== expectedRevision) {
      throw new RevisionConflictError(expectedRevision, current.revision)
    }
    const draft = structuredClone(current)
    const result = parseLearningSnapshot(operation(draft) ?? draft)
    if (JSON.stringify(result) === JSON.stringify(current)) return current
    return this.save(result, expectedRevision)
  }

  clear(): void {
    try {
      this.storage.removeItem(LEARNING_STORAGE_KEY)
    } catch (error) {
      throw new PersistenceWriteError(error)
    }
  }
}
