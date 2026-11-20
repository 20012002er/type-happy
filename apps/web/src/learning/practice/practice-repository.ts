import type { LearningRecord } from '../types'
import { LearningRepository } from '../persistence/repository'
import type { LearningSnapshot } from '../persistence/snapshot'
import {
  parsePracticeSession,
  resumePracticeSession,
  type PracticeSession,
} from './practice-session'
import { reconcileRetestPool } from './retest'

function sameRecord(left: LearningRecord, right: LearningRecord): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

export class PracticeSessionRepository {
  constructor(private readonly repository: LearningRepository) {}

  load(sessionId: string): PracticeSession | undefined {
    const session = this.repository.load().practice.sessions[sessionId]
    return session === undefined ? undefined : parsePracticeSession(session)
  }

  resume(sessionId: string, resumedAt: number): PracticeSession | undefined {
    const session = this.load(sessionId)
    return session === undefined ? undefined : resumePracticeSession(session, resumedAt)
  }

  save(session: PracticeSession, expectedRevision: number): LearningSnapshot {
    const parsed = parsePracticeSession(session)
    return this.repository.transact(expectedRevision, (snapshot) => {
      const existing = snapshot.practice.sessions[parsed.id]
      if (
        existing &&
        existing.status !== 'active' &&
        JSON.stringify(existing) !== JSON.stringify(parsed)
      ) {
        throw new Error('已完成或已放弃的练习组为只读状态')
      }
      const records = [...snapshot.learning.records]
      for (const record of parsed.records) {
        const duplicate = records.find(
          (item) => item.id === record.id || item.questionInstanceId === record.questionInstanceId,
        )
        if (duplicate) {
          if (!sameRecord(duplicate, record)) throw new Error('题目实例的学习记录发生冲突')
          continue
        }
        records.push(record)
      }
      snapshot.learning.records = records
      snapshot.practice.sessions = { ...snapshot.practice.sessions, [parsed.id]: parsed }
      snapshot.practice.retestPool = reconcileRetestPool(
        snapshot.practice.retestPool,
        parsed,
        parsed.updatedAt,
      )
    })
  }
}
