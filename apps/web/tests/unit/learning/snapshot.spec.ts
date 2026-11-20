import { describe, expect, it } from 'vitest'
import { generateMathQuestion } from '../../../src/learning/practice/math-generator'
import { createPracticeSession } from '../../../src/learning/practice/practice-session'
import {
  createEmptyLearningSnapshot,
  parseLearningSnapshot,
  SnapshotValidationError,
  type LearningSnapshot,
} from '../../../src/learning/persistence/snapshot'

function richSnapshot(): LearningSnapshot {
  const snapshot = createEmptyLearningSnapshot()
  snapshot.revision = 2
  snapshot.learning.records = [
    {
      id: 'record-1',
      questionInstanceId: 'question-1',
      templateId: 'template-1',
      templateVersion: 1,
      courseId: 'course-1',
      knowledgePointId: 'kp-1',
      result: 'first-correct',
      attempts: 1,
      highestHintLevel: 0,
      explanationViewed: false,
      startedAt: 100,
      settledAt: 200,
    },
  ]
  snapshot.tasks.daily = { '2026-11-19': { goal: 30, completed: 4, rewarded: false } }
  snapshot.tasks.streak = { current: 2, longest: 5, lastCompletedDateKey: '2026-11-18' }
  snapshot.farm = { starterGiftClaimed: true, inventory: { 'radish-seed': 2, egg: 0 } }
  return snapshot
}

describe('learning aggregate snapshot validation', () => {
  it('accepts learning, task, wallet and farm state in one aggregate', () => {
    const snapshot = richSnapshot()
    expect(parseLearningSnapshot(snapshot)).toEqual(snapshot)
    expect(createEmptyLearningSnapshot()).not.toBe(createEmptyLearningSnapshot())
  })

  it('rejects malformed roots, revisions and learning records', () => {
    expect(() => parseLearningSnapshot(null)).toThrow(SnapshotValidationError)
    expect(() => parseLearningSnapshot({ ...richSnapshot(), revision: -1 })).toThrow('revision')
    expect(() => parseLearningSnapshot({ ...richSnapshot(), learning: { records: {} } })).toThrow(
      'records 必须是数组',
    )
    expect(() => parseLearningSnapshot({ ...richSnapshot(), learning: { records: [{}] } })).toThrow(
      'learningRecord.id',
    )
  })

  it('rejects invalid daily task values and empty date keys', () => {
    const snapshot = richSnapshot()
    expect(() =>
      parseLearningSnapshot({ ...snapshot, tasks: { ...snapshot.tasks, daily: [] } }),
    ).toThrow('tasks.daily')
    expect(() =>
      parseLearningSnapshot({
        ...snapshot,
        tasks: { ...snapshot.tasks, daily: { '': snapshot.tasks.daily['2026-11-19'] } },
      }),
    ).toThrow('日期键不能为空')
    expect(() =>
      parseLearningSnapshot({
        ...snapshot,
        tasks: {
          ...snapshot.tasks,
          daily: { '2026-02-30': { goal: 30, completed: 0, rewarded: false } },
        },
      }),
    ).toThrow('无效的本地日期键')
    expect(() =>
      parseLearningSnapshot({
        ...snapshot,
        tasks: {
          ...snapshot.tasks,
          daily: { '2026-11-19': { goal: 0, completed: 0, rewarded: false } },
        },
      }),
    ).toThrow('goal')
    expect(() =>
      parseLearningSnapshot({
        ...snapshot,
        tasks: {
          ...snapshot.tasks,
          daily: { '2026-11-19': { goal: 30, completed: -1, rewarded: false } },
        },
      }),
    ).toThrow('completed')
    expect(() =>
      parseLearningSnapshot({
        ...snapshot,
        tasks: {
          ...snapshot.tasks,
          daily: { '2026-11-19': { goal: 30, completed: 0, rewarded: 'no' } },
        },
      }),
    ).toThrow('rewarded')
  })

  it('enforces streak and last-completed-date invariants', () => {
    const snapshot = richSnapshot()
    expect(() =>
      parseLearningSnapshot({
        ...snapshot,
        tasks: {
          ...snapshot.tasks,
          streak: { current: 6, longest: 5, lastCompletedDateKey: null },
        },
      }),
    ).toThrow('最长连续天数')
    expect(() =>
      parseLearningSnapshot({
        ...snapshot,
        tasks: { ...snapshot.tasks, streak: { current: 0, longest: 5, lastCompletedDateKey: 123 } },
      }),
    ).toThrow('lastCompletedDateKey')
    expect(() =>
      parseLearningSnapshot({
        ...snapshot,
        tasks: {
          ...snapshot.tasks,
          streak: { current: 1, longest: 5, lastCompletedDateKey: '2026-02-30' },
        },
      }),
    ).toThrow('无效的本地日期键')
    expect(() =>
      parseLearningSnapshot({
        ...snapshot,
        tasks: {
          ...snapshot.tasks,
          streak: { current: -1, longest: 5, lastCompletedDateKey: null },
        },
      }),
    ).toThrow('streak.current')
  })

  it('validates practice sessions and retest pool uniqueness', () => {
    const question = generateMathQuestion('oral-mul-one-v1', 1, 'practice-question')
    const session = createPracticeSession({
      id: 'practice-session',
      mode: 'special',
      questions: [{ question }],
      createdAt: 100,
    })
    const retest = {
      id: 'retest-1',
      originalQuestion: question,
      originSessionId: session.id,
      seed: 2,
      createdAt: 100,
      status: 'pending',
    }
    const valid = {
      ...richSnapshot(),
      practice: { sessions: { [session.id]: session }, retestPool: [retest] },
    }
    expect(parseLearningSnapshot(valid)).toEqual(valid)
    expect(() =>
      parseLearningSnapshot({ ...valid, practice: { ...valid.practice, sessions: [] } }),
    ).toThrow('practice.sessions')
    expect(() =>
      parseLearningSnapshot({
        ...valid,
        practice: { ...valid.practice, sessions: { '': session } },
      }),
    ).toThrow('练习组 ID 不能为空')
    expect(() =>
      parseLearningSnapshot({
        ...valid,
        practice: { ...valid.practice, sessions: { other: session } },
      }),
    ).toThrow('键与 ID 不一致')
    expect(() =>
      parseLearningSnapshot({ ...valid, practice: { ...valid.practice, retestPool: {} } }),
    ).toThrow('复测池必须是数组')
    expect(() =>
      parseLearningSnapshot({
        ...valid,
        practice: { ...valid.practice, retestPool: [retest, retest] },
      }),
    ).toThrow('ID 重复')
  })

  it('rejects negative or malformed farm inventory', () => {
    const snapshot = richSnapshot()
    expect(() =>
      parseLearningSnapshot({ ...snapshot, farm: { ...snapshot.farm, starterGiftClaimed: 'yes' } }),
    ).toThrow('starterGiftClaimed')
    expect(() =>
      parseLearningSnapshot({ ...snapshot, farm: { ...snapshot.farm, inventory: [] } }),
    ).toThrow('farm.inventory')
    expect(() =>
      parseLearningSnapshot({ ...snapshot, farm: { ...snapshot.farm, inventory: { '': 1 } } }),
    ).toThrow('物品 ID 不能为空')
    expect(() =>
      parseLearningSnapshot({ ...snapshot, farm: { ...snapshot.farm, inventory: { egg: -1 } } }),
    ).toThrow('inventory.egg')
  })
})
