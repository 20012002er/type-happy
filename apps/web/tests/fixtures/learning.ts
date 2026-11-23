import {
  createEmptyLearningSnapshot,
  type LearningSnapshot,
} from '../../src/learning/persistence/snapshot'
import { defineFixture } from '../helpers/fixtures'

export const createLearningSnapshotFixture = defineFixture(() => createEmptyLearningSnapshot())

const legacyTasks = {
  daily: { '2026-11-18': { goal: 30, completed: 30, rewarded: true } },
  streak: { current: 1, longest: 4, lastCompletedDateKey: '2026-11-18' },
}

const legacyWallet = {
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
} as const

const legacyFarm = {
  starterGiftClaimed: true,
  inventory: { 'radish-seed': 2 },
  plots: [{ id: 'plot-1', crop: null }],
  animals: [],
  buildings: { chickenCoop: { level: 1 }, cowshed: { level: 0 } },
  saleIncomeByDate: {},
  recoveryClaimDates: [],
  lastAdvancedAt: 100,
  actions: {},
}

export const createRichLearningSnapshotFixture = defineFixture((): LearningSnapshot => ({
  schemaVersion: 3,
  revision: 7,
  learning: {
    records: [
      {
        id: 'record-legacy-1',
        questionInstanceId: 'golden',
        templateId: 'written-mul-three-v1',
        templateVersion: 1,
        courseId: 'pep-grade4-autumn-integrated-math',
        knowledgePointId: 'written-multiplication-three-by-two',
        result: 'first-correct',
        answer: { kind: 'number', value: 34000 },
        attempts: 1,
        highestHintLevel: 0,
        explanationViewed: false,
        startedAt: 100,
        settledAt: 200,
      },
    ],
  },
  practice: { sessions: {}, retestPool: [] },
  tasks: {
    daily: { '2026-11-19': { goal: 30, completed: 4, rewarded: false } },
    streak: { current: 2, longest: 5, lastCompletedDateKey: '2026-11-18' },
  },
  wallet: {
    balance: 18,
    ledger: [
      {
        settlementId: 'legacy-practice',
        occurredAt: 100,
        source: 'practice',
        referenceId: 'golden',
        direction: 'earn',
        amount: 3,
        balanceAfter: 3,
      },
      {
        settlementId: 'legacy-daily',
        occurredAt: 200,
        source: 'daily-task',
        referenceId: '2026-11-18',
        direction: 'earn',
        amount: 20,
        balanceAfter: 23,
      },
      {
        settlementId: 'legacy-feed',
        occurredAt: 300,
        source: 'farm-purchase',
        referenceId: 'chicken-feed',
        direction: 'spend',
        amount: 5,
        balanceAfter: 18,
      },
    ],
  },
  farm: {
    starterGiftClaimed: true,
    inventory: { 'radish-seed': 2, wheat: 2, egg: 1 },
    plots: [
      {
        id: 'plot-1',
        crop: { cropId: 'wheat', plantedAt: 100, readyAt: 1_800_100, fertilized: false },
      },
      { id: 'plot-2', crop: null },
    ],
    animals: [
      { id: 'chicken-1', kind: 'chicken', production: null, productPending: true },
      {
        id: 'cow-1',
        kind: 'cow',
        production: { startedAt: 100, readyAt: 7_200_100 },
        productPending: false,
      },
    ],
    buildings: { chickenCoop: { level: 1 }, cowshed: { level: 1 } },
    saleIncomeByDate: { '2026-11-18': 20 },
    recoveryClaimDates: ['2026-11-17'],
    lastAdvancedAt: 300,
    actions: { 'legacy-harvest': 'harvest:plot-1' },
  },
}))

export const createLegacyV2SnapshotFixture = defineFixture(() => ({
  schemaVersion: 2,
  revision: 5,
  learning: { records: [] },
  practice: { sessions: {}, retestPool: [] },
  tasks: legacyTasks,
  wallet: legacyWallet,
  farm: { starterGiftClaimed: true, inventory: { 'radish-seed': 2 } },
}))

export const createLegacyV1SnapshotFixture = defineFixture(() => ({
  schemaVersion: 1,
  revision: 4,
  learning: { records: [] },
  tasks: legacyTasks,
  wallet: legacyWallet,
  farm: legacyFarm,
}))

export const createLegacyV0SnapshotFixture = defineFixture(() => ({
  schemaVersion: 0,
  revision: 3,
  tasks: legacyTasks,
  wallet: legacyWallet,
  farm: legacyFarm,
}))
