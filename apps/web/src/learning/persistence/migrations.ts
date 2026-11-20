import { createEmptyFarmState } from '../farm/farm-state'
import {
  parseLearningSnapshot,
  UnsupportedSchemaVersionError,
  type LearningSnapshot,
} from './snapshot'

export function migrateLearningSnapshot(value: unknown): LearningSnapshot {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new UnsupportedSchemaVersionError(undefined)
  }
  const candidate = value as Record<string, unknown>
  if (candidate.schemaVersion === 3) return parseLearningSnapshot(candidate)
  if (candidate.schemaVersion === 2) {
    return migrateLearningSnapshot({
      ...candidate,
      schemaVersion: 3,
      farm: { ...createEmptyFarmState(), ...(candidate.farm as Record<string, unknown>) },
    })
  }
  if (candidate.schemaVersion === 1) {
    return migrateLearningSnapshot({
      ...candidate,
      schemaVersion: 2,
      practice: { sessions: {}, retestPool: [] },
    })
  }
  if (candidate.schemaVersion === 0) {
    return migrateLearningSnapshot({
      ...candidate,
      schemaVersion: 1,
      learning: { records: [] },
    })
  }
  throw new UnsupportedSchemaVersionError(candidate.schemaVersion)
}
