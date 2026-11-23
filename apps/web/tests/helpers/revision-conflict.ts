import { LearningRepository } from '../../src/learning/persistence/repository'
import {
  LEARNING_STORAGE_KEY,
  type LearningSnapshot,
} from '../../src/learning/persistence/snapshot'
import { createLearningSnapshotFixture } from '../fixtures/learning'
import { MemoryStorage } from './memory-storage'

export function createRevisionConflictScenario(
  initialSnapshot: LearningSnapshot = createLearningSnapshotFixture(),
) {
  const storage = new MemoryStorage({
    [LEARNING_STORAGE_KEY]: JSON.stringify(initialSnapshot),
  })
  const first = new LearningRepository(storage)
  const second = new LearningRepository(storage)
  const firstSnapshot = first.load()
  const secondSnapshot = second.load()

  return {
    storage,
    first,
    second,
    firstSnapshot,
    secondSnapshot,
    saveFirst: () => first.save(firstSnapshot, firstSnapshot.revision),
    saveStaleSecond: () => second.save(secondSnapshot, secondSnapshot.revision),
    transactStaleSecond: () => second.transact(secondSnapshot.revision, () => undefined),
  }
}
