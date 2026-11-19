import { parseLearningRecord } from '../contracts'
import type { LearningRecord } from '../types'
import { createEmptyWallet, parseWalletState, type WalletState } from '../wallet/wallet'

export const LEARNING_SCHEMA_VERSION = 1
export const LEARNING_STORAGE_KEY = 'type-happy:learning:snapshot'

export interface DailyTaskState {
  goal: number
  completed: number
  rewarded: boolean
}

export interface LearningSnapshot {
  schemaVersion: typeof LEARNING_SCHEMA_VERSION
  revision: number
  learning: { records: readonly LearningRecord[] }
  tasks: {
    daily: Readonly<Record<string, DailyTaskState>>
    streak: { current: number; longest: number; lastCompletedDateKey: string | null }
  }
  wallet: WalletState
  farm: {
    starterGiftClaimed: boolean
    inventory: Readonly<Record<string, number>>
  }
}

export class SnapshotValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SnapshotValidationError'
  }
}

export class UnsupportedSchemaVersionError extends Error {
  readonly version: unknown

  constructor(version: unknown) {
    super(`不支持的学习存档版本：${String(version)}`)
    this.name = 'UnsupportedSchemaVersionError'
    this.version = version
  }
}

function expectRecord(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new SnapshotValidationError(`${path} 必须是对象`)
  }
  return value as Record<string, unknown>
}

function expectInteger(value: unknown, path: string, minimum = 0): void {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < minimum) {
    throw new SnapshotValidationError(`${path} 必须是大于等于 ${minimum} 的安全整数`)
  }
}

function expectBoolean(value: unknown, path: string): void {
  if (typeof value !== 'boolean') throw new SnapshotValidationError(`${path} 必须是布尔值`)
}

export function createEmptyLearningSnapshot(): LearningSnapshot {
  return {
    schemaVersion: LEARNING_SCHEMA_VERSION,
    revision: 0,
    learning: { records: [] },
    tasks: {
      daily: {},
      streak: { current: 0, longest: 0, lastCompletedDateKey: null },
    },
    wallet: createEmptyWallet(),
    farm: { starterGiftClaimed: false, inventory: {} },
  }
}

export function parseLearningSnapshot(value: unknown): LearningSnapshot {
  const snapshot = expectRecord(value, 'snapshot')
  if (snapshot.schemaVersion !== LEARNING_SCHEMA_VERSION) {
    throw new SnapshotValidationError('snapshot.schemaVersion 版本不匹配')
  }
  expectInteger(snapshot.revision, 'snapshot.revision')

  const learning = expectRecord(snapshot.learning, 'snapshot.learning')
  if (!Array.isArray(learning.records))
    throw new SnapshotValidationError('learning.records 必须是数组')
  learning.records.forEach((record) => parseLearningRecord(record))

  const tasks = expectRecord(snapshot.tasks, 'snapshot.tasks')
  const daily = expectRecord(tasks.daily, 'snapshot.tasks.daily')
  Object.entries(daily).forEach(([dateKey, value]) => {
    if (dateKey.trim().length === 0) throw new SnapshotValidationError('每日任务日期键不能为空')
    const task = expectRecord(value, `snapshot.tasks.daily.${dateKey}`)
    expectInteger(task.goal, `snapshot.tasks.daily.${dateKey}.goal`, 1)
    expectInteger(task.completed, `snapshot.tasks.daily.${dateKey}.completed`)
    expectBoolean(task.rewarded, `snapshot.tasks.daily.${dateKey}.rewarded`)
  })
  const streak = expectRecord(tasks.streak, 'snapshot.tasks.streak')
  expectInteger(streak.current, 'snapshot.tasks.streak.current')
  expectInteger(streak.longest, 'snapshot.tasks.streak.longest')
  if (streak.lastCompletedDateKey !== null && typeof streak.lastCompletedDateKey !== 'string') {
    throw new SnapshotValidationError(
      'snapshot.tasks.streak.lastCompletedDateKey 必须是日期键或 null',
    )
  }
  if (Number(streak.longest) < Number(streak.current)) {
    throw new SnapshotValidationError('最长连续天数不能小于当前连续天数')
  }

  parseWalletState(snapshot.wallet)
  const farm = expectRecord(snapshot.farm, 'snapshot.farm')
  expectBoolean(farm.starterGiftClaimed, 'snapshot.farm.starterGiftClaimed')
  const inventory = expectRecord(farm.inventory, 'snapshot.farm.inventory')
  Object.entries(inventory).forEach(([itemId, quantity]) => {
    if (itemId.trim().length === 0) throw new SnapshotValidationError('物品 ID 不能为空')
    expectInteger(quantity, `snapshot.farm.inventory.${itemId}`)
  })
  return snapshot as unknown as LearningSnapshot
}
