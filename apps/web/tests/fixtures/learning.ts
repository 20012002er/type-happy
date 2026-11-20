import { createEmptyLearningSnapshot } from '../../src/learning/persistence/snapshot'
import { defineFixture } from '../helpers/fixtures'

export const createLearningSnapshotFixture = defineFixture(() => createEmptyLearningSnapshot())

export const createLegacyV1SnapshotFixture = defineFixture(() => {
  const current = createEmptyLearningSnapshot()
  return {
    schemaVersion: 1,
    revision: current.revision,
    learning: current.learning,
    tasks: current.tasks,
    wallet: current.wallet,
    farm: current.farm,
  }
})

export const createLegacyV0SnapshotFixture = defineFixture(() => {
  const current = createEmptyLearningSnapshot()
  return {
    schemaVersion: 0,
    revision: 3,
    tasks: current.tasks,
    wallet: {
      balance: 10,
      ledger: [
        {
          settlementId: 'legacy-seed',
          occurredAt: 100,
          source: 'activity',
          referenceId: 'legacy',
          direction: 'earn',
          amount: 10,
          balanceAfter: 10,
        },
      ],
    },
    farm: current.farm,
  }
})
