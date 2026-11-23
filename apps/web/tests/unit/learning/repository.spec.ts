import { describe, expect, it } from 'vitest'
import { migrateLearningSnapshot } from '../../../src/learning/persistence/migrations'
import {
  CorruptedSnapshotError,
  LearningRepository,
  PersistenceWriteError,
  RevisionConflictError,
} from '../../../src/learning/persistence/repository'
import {
  LEARNING_SCHEMA_VERSION,
  LEARNING_STORAGE_KEY,
  parseLearningSnapshot,
  SnapshotValidationError,
  UnsupportedSchemaVersionError,
} from '../../../src/learning/persistence/snapshot'
import { getProcessingPurchaseEligibility } from '../../../src/learning/processing/state'
import { settleWallet } from '../../../src/learning/wallet/wallet'
import { malformedJsonFixtures } from '../../fixtures/storage'
import {
  createLearningSnapshotFixture,
  createLegacyV0SnapshotFixture,
  createLegacyV1SnapshotFixture,
  createLegacyV2SnapshotFixture,
  createLegacyV3SnapshotFixture,
} from '../../fixtures/learning'
import { MemoryStorage } from '../../helpers/memory-storage'

const otherKeys = {
  'type-happy:progress:v1': 'typing-progress',
  'type-happy:games:v1': 'game-progress',
  'taoyuan:save': 'taoyuan-progress',
}

describe('learning repository', () => {
  it('initializes a first visit without reading or changing existing saves', () => {
    const storage = new MemoryStorage(otherKeys)
    const repository = new LearningRepository(storage)

    expect(repository.load()).toEqual(createLearningSnapshotFixture())
    expect(storage.getItem(LEARNING_STORAGE_KEY)).toBeNull()
    expect(storage.snapshot()).toMatchObject(otherKeys)
  })

  it('persists one versioned aggregate and increments revisions', () => {
    const storage = new MemoryStorage(otherKeys)
    const repository = new LearningRepository(storage)
    const initial = repository.load()
    const saved = repository.transact(0, (snapshot) => {
      snapshot.wallet = settleWallet(snapshot.wallet, {
        settlementId: 'earn-3',
        occurredAt: 100,
        source: 'practice',
        referenceId: 'question-1',
        direction: 'earn',
        amount: 3,
      })
    })

    expect(initial.wallet.balance).toBe(0)
    expect(saved.revision).toBe(1)
    expect(repository.load().wallet.balance).toBe(3)
    expect(storage.snapshot()).toMatchObject(otherKeys)
    expect(repository.transact(1, () => undefined)).toEqual(saved)
  })

  it('detects stale revisions instead of silently overwriting another tab', () => {
    const storage = new MemoryStorage()
    const first = new LearningRepository(storage)
    const second = new LearningRepository(storage)
    first.save(first.load(), 0)

    expect(() => second.save(second.load(), 0)).toThrow(RevisionConflictError)
    expect(() => second.transact(0, () => undefined)).toThrow(RevisionConflictError)
    expect(() => first.save({ ...first.load(), revision: 9 }, 1)).toThrow(RevisionConflictError)
  })

  it('does not corrupt the previous snapshot when storage writes fail', () => {
    const storage = new MemoryStorage()
    const repository = new LearningRepository(storage)
    const saved = repository.save(repository.load(), 0)
    const before = storage.getItem(LEARNING_STORAGE_KEY)
    storage.failNext('setItem', new DOMException('full', 'QuotaExceededError'))

    expect(() => repository.save(saved, 1)).toThrow(PersistenceWriteError)
    storage.failNext('setItem', new DOMException('full', 'QuotaExceededError'))
    expect(() => repository.save(saved, 1)).toThrow('本次进度暂未保存')
    expect(storage.getItem(LEARNING_STORAGE_KEY)).toBe(before)
  })

  it.each(malformedJsonFixtures)('identifies malformed JSON without replacing it: %s', (raw) => {
    const storage = new MemoryStorage({ [LEARNING_STORAGE_KEY]: raw })
    const repository = new LearningRepository(storage)
    expect(() => repository.load()).toThrow(CorruptedSnapshotError)
    expect(() => repository.save(createLearningSnapshotFixture(), 0)).toThrow(
      CorruptedSnapshotError,
    )
    expect(storage.getItem(LEARNING_STORAGE_KEY)).toBe(raw)
  })

  it('preserves an invalid legacy snapshot when migration fails', () => {
    const legacy = createLegacyV3SnapshotFixture()
    legacy.farm = { ...legacy.farm, inventory: { wheat: -1 } }
    const raw = JSON.stringify(legacy)
    const storage = new MemoryStorage({ [LEARNING_STORAGE_KEY]: raw })
    const repository = new LearningRepository(storage)

    expect(() => repository.load()).toThrow(CorruptedSnapshotError)
    expect(() => repository.transact(legacy.revision, () => undefined)).toThrow(
      CorruptedSnapshotError,
    )
    expect(storage.getItem(LEARNING_STORAGE_KEY)).toBe(raw)
  })

  it('refuses to overwrite unknown schema versions', () => {
    const raw = JSON.stringify({ schemaVersion: 99, revision: 4 })
    const storage = new MemoryStorage({ [LEARNING_STORAGE_KEY]: raw })
    const repository = new LearningRepository(storage)

    expect(() => repository.load()).toThrow(UnsupportedSchemaVersionError)
    expect(() => repository.save(createLearningSnapshotFixture(), 0)).toThrow(
      UnsupportedSchemaVersionError,
    )
    expect(storage.getItem(LEARNING_STORAGE_KEY)).toBe(raw)
  })

  it('clears only the learning namespace and reports removal failures', () => {
    const snapshot = createLearningSnapshotFixture()
    snapshot.processing = {
      workshop: { purchased: true, activeTask: null, pendingOutput: null },
      actions: { purchase: 'purchase-signature' },
    }
    const storage = new MemoryStorage({
      ...otherKeys,
      [LEARNING_STORAGE_KEY]: JSON.stringify(snapshot),
    })
    const repository = new LearningRepository(storage)
    repository.clear()
    expect(storage.getItem(LEARNING_STORAGE_KEY)).toBeNull()
    expect(repository.load().processing.workshop.purchased).toBe(false)
    expect(storage.snapshot()).toEqual(otherKeys)

    storage.failNext('removeItem')
    expect(() => repository.clear()).toThrow(PersistenceWriteError)
  })
})

describe('schema fixtures and migrations', () => {
  it('adds only course selection and processing state when upgrading a rich v3 snapshot', () => {
    const legacy = createLegacyV3SnapshotFixture()
    const migrated = migrateLearningSnapshot(legacy)
    const { course, processing, ...preserved } = migrated

    expect(preserved).toEqual({ ...legacy, schemaVersion: LEARNING_SCHEMA_VERSION })
    expect(course).toEqual({ grade: 4, semester: 'autumn' })
    expect(processing).toEqual({
      workshop: { purchased: false, activeTask: null, pendingOutput: null },
      actions: {},
    })
    expect(migrateLearningSnapshot(migrated)).toEqual(migrated)
  })

  it('derives purchase eligibility only from traceable harvests without granting assets', () => {
    const legacy = createLegacyV3SnapshotFixture()
    expect(getProcessingPurchaseEligibility(migrateLearningSnapshot(legacy).farm)).toMatchObject({
      eligible: false,
      manualHarvestQuantity: 0,
    })
    legacy.farm = {
      ...legacy.farm,
      actions: {
        'harvest-1': JSON.stringify({ type: 'harvest-crop', now: 400, plotId: 'plot-1' }),
        'harvest-2': JSON.stringify({ type: 'harvest-crop', now: 500, plotId: 'plot-2' }),
        'collect-milk': JSON.stringify({
          type: 'collect-animal-product',
          now: 600,
          animalId: 'cow-1',
        }),
      },
    }

    const migrated = migrateLearningSnapshot(legacy)
    expect(getProcessingPurchaseEligibility(migrated.farm)).toEqual({
      eligible: true,
      manualHarvestQuantity: 3,
      requiredManualHarvestQuantity: 3,
    })
    expect(migrated.processing.workshop).toEqual({
      purchased: false,
      activeTask: null,
      pendingOutput: null,
    })
    expect(migrated.wallet).toEqual(legacy.wallet)
    expect(migrated.farm.inventory).toEqual(legacy.farm.inventory)
  })

  it('upgrades the legacy fixture and migrates idempotently', () => {
    const legacy = createLegacyV0SnapshotFixture()
    const migrated = migrateLearningSnapshot(legacy)

    expect(migrated.schemaVersion).toBe(LEARNING_SCHEMA_VERSION)
    expect(migrated.revision).toBe(3)
    expect(migrated.wallet.balance).toBe(10)
    expect(migrated.learning.records).toEqual([])
    expect(migrateLearningSnapshot(migrated)).toEqual(migrated)
  })

  it('preserves the legacy farm inventory while adding v3 farm state', () => {
    const migrated = migrateLearningSnapshot(createLegacyV2SnapshotFixture())
    expect(migrated.schemaVersion).toBe(LEARNING_SCHEMA_VERSION)
    expect(migrated.farm).toMatchObject({
      starterGiftClaimed: true,
      inventory: { 'radish-seed': 2 },
      plots: [],
      animals: [],
      saleIncomeByDate: {},
      recoveryClaimDates: [],
      lastAdvancedAt: null,
    })
    expect(migrateLearningSnapshot(migrated)).toEqual(migrated)
  })

  it('adds empty practice state when upgrading schema v1 and remains idempotent', () => {
    const migrated = migrateLearningSnapshot(createLegacyV1SnapshotFixture())
    expect(migrated.schemaVersion).toBe(LEARNING_SCHEMA_VERSION)
    expect(migrated.practice).toEqual({ sessions: {}, retestPool: [] })
    expect(migrateLearningSnapshot(migrated)).toEqual(migrated)
  })

  it('loads and saves a migrated snapshot without losing its ledger', () => {
    const storage = new MemoryStorage({
      [LEARNING_STORAGE_KEY]: JSON.stringify(createLegacyV0SnapshotFixture()),
    })
    const repository = new LearningRepository(storage)
    const loaded = repository.load()
    const saved = repository.save(loaded, 3)

    expect(saved.schemaVersion).toBe(LEARNING_SCHEMA_VERSION)
    expect(saved.revision).toBe(4)
    expect(repository.load().wallet.ledger[0].settlementId).toBe('legacy-seed')
  })

  it('rejects invalid roots and direct schema mismatches', () => {
    expect(() => migrateLearningSnapshot(null)).toThrow(UnsupportedSchemaVersionError)
    expect(() => parseLearningSnapshot({ schemaVersion: 2 })).toThrow(SnapshotValidationError)
  })
})
