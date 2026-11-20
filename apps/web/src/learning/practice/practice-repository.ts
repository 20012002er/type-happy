import { LearningRepository } from '../persistence/repository'
import type { LearningSnapshot } from '../persistence/snapshot'
import { settleLearningRecord } from '../tasks/learning-settlement'
import {
  parsePracticeSession,
  resumePracticeSession,
  type PracticeSession,
} from './practice-session'
import { reconcileRetestPool } from './retest'

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

  save(session: PracticeSession, expectedRevision: number, dailyGoal?: number): LearningSnapshot {
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
      for (const record of parsed.records) {
        settleLearningRecord(snapshot, parsed, record, dailyGoal)
      }
      snapshot.practice.sessions = { ...snapshot.practice.sessions, [parsed.id]: parsed }
      snapshot.practice.retestPool = reconcileRetestPool(
        snapshot.practice.retestPool,
        parsed,
        parsed.updatedAt,
      )
    })
  }
}
