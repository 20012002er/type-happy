import { describe, expect, it } from 'vitest'
import { LEARNING_RULES } from '../../../src/learning/config/rules'
import { shiftLocalDateKey } from '../../../src/learning/date-key'
import { createEmptyLearningSnapshot } from '../../../src/learning/persistence/snapshot'
import { generateMathQuestion } from '../../../src/learning/practice/math-generator'
import { generateSpecialPaper } from '../../../src/learning/practice/paper'
import {
  abandonPracticeSession,
  advancePracticeSession,
  createPracticeSession,
  replacePracticeQuestion,
  submitPracticeAnswer,
  type PracticeSession,
} from '../../../src/learning/practice/practice-session'
import { ensureDailyTask, validateDailyGoal } from '../../../src/learning/tasks/daily-task'
import {
  settleLearningRecord,
  type LearningSettlementSummary,
} from '../../../src/learning/tasks/learning-settlement'
import {
  getPracticeSessionSummary,
  getTodayLearningSummary,
} from '../../../src/learning/tasks/learning-summary'
import {
  completeStreak,
  getNextStreakMilestone,
  getStreakMilestone,
} from '../../../src/learning/tasks/streak'
import type { QuestionSnapshot } from '../../../src/learning/types'

function at(day: number, hour = 12): number {
  return new Date(2026, 10, day, hour).getTime()
}

function makeSession(id: string, size = 1): PracticeSession {
  const paper = generateSpecialPaper({
    knowledgePointId: 'oral-multiplication-by-one-digit',
    difficulty: 'L1',
    seed: 81,
    idPrefix: `${id}-paper`,
    size,
  })
  return createPracticeSession({
    id,
    mode: 'special',
    questions: paper.questions,
    createdAt: at(19),
  })
}

function wrongAnswer(question: QuestionSnapshot) {
  if (question.standardAnswer.kind !== 'number') throw new Error('测试只使用数字答案')
  return { kind: 'number' as const, value: question.standardAnswer.value + 1 }
}

function completedSession(
  id: string,
  result: 'first-correct' | 'mastered-after-hint' | 'corrected-awaiting-retest',
  settledAt = at(19),
): PracticeSession {
  let session = makeSession(id)
  const question = session.questions[0].question
  if (result !== 'first-correct') {
    session = submitPracticeAnswer(session, wrongAnswer(question), settledAt - 2)
  }
  if (result === 'corrected-awaiting-retest') {
    session = submitPracticeAnswer(session, wrongAnswer(question), settledAt - 1)
  }
  return submitPracticeAnswer(session, question.standardAnswer, settledAt)
}

function answerAll(session: PracticeSession, firstSettledAt: number): PracticeSession {
  let next = session
  while (next.status === 'active') {
    const current = next.questions[next.currentIndex]
    next = submitPracticeAnswer(next, current.question.standardAnswer, firstSettledAt)
    next = advancePracticeSession(next, firstSettledAt)
    firstSettledAt += 1
  }
  return next
}

function settleAll(
  snapshot: ReturnType<typeof createEmptyLearningSnapshot>,
  session: PracticeSession,
  dailyGoal?: number,
): LearningSettlementSummary[] {
  return session.records.map((record) => settleLearningRecord(snapshot, session, record, dailyGoal))
}

describe('daily task goal snapshots and single-question settlement', () => {
  it('uses the default 30-question goal and freezes each day goal on first use', () => {
    const snapshot = createEmptyLearningSnapshot()
    expect(ensureDailyTask(snapshot, '2026-11-19').goal).toBe(30)
    expect(ensureDailyTask(snapshot, '2026-11-19', 15).goal).toBe(30)
    expect(ensureDailyTask(snapshot, '2026-11-20', 15).goal).toBe(15)
    expect(validateDailyGoal(10)).toBe(10)
    expect(validateDailyGoal(50)).toBe(50)
    for (const invalid of [0, 9, 11, 51, 10.5, Number.NaN]) {
      expect(() => validateDailyGoal(invalid)).toThrow('10–50')
    }
    expect(() => ensureDailyTask(snapshot, '2026-02-30')).toThrow('无效的本地日期键')
  })

  it.each([
    ['first-correct', 3, 2],
    ['mastered-after-hint', 1, 1],
    ['corrected-awaiting-retest', 0, 0],
  ] as const)('settles %s at the within-goal and extra-practice rates', (result, within, extra) => {
    const withinSnapshot = createEmptyLearningSnapshot()
    const withinSummary = settleAll(withinSnapshot, completedSession(`within-${result}`, result))[0]
    expect(withinSummary).toMatchObject({
      phase: 'within-goal',
      practiceReward: within,
      dailyCompleted: 1,
    })

    const extraSnapshot = createEmptyLearningSnapshot()
    extraSnapshot.tasks.daily = {
      ...extraSnapshot.tasks.daily,
      '2026-11-19': { goal: 1, completed: 1, rewarded: true },
    }
    const extraSummary = settleAll(extraSnapshot, completedSession(`extra-${result}`, result))[0]
    expect(extraSummary).toMatchObject({
      phase: 'extra-practice',
      practiceReward: extra,
      dailyCompleted: 1,
    })
  })

  it('switches a group at the exact daily goal and grants the daily reward once', () => {
    const snapshot = createEmptyLearningSnapshot()
    snapshot.tasks.daily = {
      ...snapshot.tasks.daily,
      '2026-11-19': { goal: 2, completed: 0, rewarded: false },
    }
    const session = answerAll(makeSession('cross-goal', 3), at(19))
    const summaries = settleAll(snapshot, session)

    expect(summaries.map((summary) => summary.phase)).toEqual([
      'within-goal',
      'within-goal',
      'extra-practice',
    ])
    expect(summaries.map((summary) => summary.practiceReward)).toEqual([3, 3, 2])
    expect(summaries[1]).toMatchObject({ dailyReward: 20, totalReward: 23, streakCurrent: 1 })
    expect(snapshot.tasks.daily['2026-11-19']).toEqual({ goal: 2, completed: 2, rewarded: true })
    expect(snapshot.wallet.balance).toBe(28)
    expect(snapshot.wallet.ledger.filter((entry) => entry.source === 'daily-task')).toHaveLength(1)

    const extra = completedSession('unlimited-extra', 'first-correct', at(19, 13))
    expect(settleAll(snapshot, extra)[0]).toMatchObject({
      phase: 'extra-practice',
      practiceReward: 2,
      dailyReward: 0,
      dailyCompleted: 2,
    })
    expect(snapshot.wallet.balance).toBe(30)
  })

  it('attributes a cross-midnight answer to its submission date without backfilling', () => {
    const snapshot = createEmptyLearningSnapshot()
    const beforeMidnight = completedSession(
      'before-midnight',
      'first-correct',
      new Date(2026, 10, 19, 23, 59, 59).getTime(),
    )
    const afterMidnight = completedSession(
      'after-midnight',
      'first-correct',
      new Date(2026, 10, 20, 0, 0, 1).getTime(),
    )
    settleAll(snapshot, beforeMidnight, 10)
    settleAll(snapshot, afterMidnight, 15)

    expect(snapshot.tasks.daily['2026-11-19']).toMatchObject({ goal: 10, completed: 1 })
    expect(snapshot.tasks.daily['2026-11-20']).toMatchObject({ goal: 15, completed: 1 })
  })

  it('deduplicates the same instance even when its reward is zero', () => {
    const snapshot = createEmptyLearningSnapshot()
    const session = completedSession('zero-reward', 'corrected-awaiting-retest')
    const first = settleAll(snapshot, session)[0]
    const before = structuredClone(snapshot)
    const repeated = settleLearningRecord(snapshot, session, session.records[0])

    expect(first.practiceReward).toBe(0)
    expect(repeated.alreadySettled).toBe(true)
    expect(snapshot).toEqual(before)
    const conflicting = { ...session.records[0], attempts: 99 }
    expect(() => settleLearningRecord(snapshot, session, conflicting)).toThrow('发生冲突')
  })

  it('keeps task participation and reward eligibility independent', () => {
    const noTask = makeSession('no-task')
    noTask.questions[0].question.participatesInTask = false
    const noTaskSession = submitPracticeAnswer(
      noTask,
      noTask.questions[0].question.standardAnswer,
      at(19),
    )
    const noTaskSnapshot = createEmptyLearningSnapshot()
    expect(settleAll(noTaskSnapshot, noTaskSession)[0]).toMatchObject({
      practiceReward: 3,
      dailyCompleted: 0,
    })

    const noReward = makeSession('no-reward')
    noReward.questions[0].question.rewardEligible = false
    const noRewardSession = submitPracticeAnswer(
      noReward,
      noReward.questions[0].question.standardAnswer,
      at(19),
    )
    const noRewardSnapshot = createEmptyLearningSnapshot()
    expect(settleAll(noRewardSnapshot, noRewardSession)[0]).toMatchObject({
      practiceReward: 0,
      dailyCompleted: 1,
    })
  })

  it('does not count abandoned questions and rejects malformed settlement references', () => {
    const snapshot = createEmptyLearningSnapshot()
    const abandoned = abandonPracticeSession(makeSession('abandoned'), at(19))
    expect(settleAll(snapshot, abandoned)[0]).toMatchObject({
      phase: 'not-applicable',
      totalReward: 0,
      dailyCompleted: 0,
    })
    expect(snapshot.learning.records).toHaveLength(1)
    expect(snapshot.tasks.daily).toEqual({})

    const session = completedSession('bad-reference', 'first-correct')
    expect(() =>
      settleLearningRecord(snapshot, session, { ...session.records[0], settledAt: undefined }),
    ).toThrow('缺少结算时间')
    expect(() =>
      settleLearningRecord(snapshot, session, {
        ...session.records[0],
        questionInstanceId: 'missing-instance',
      }),
    ).toThrow('没有对应的题目实例')
  })
})

describe('streak milestones', () => {
  it('grants fixed and recurring milestones at 3/7/14/30/37/44/51 days', () => {
    const snapshot = createEmptyLearningSnapshot()
    const rewards = new Map<number, number>()
    for (let day = 1; day <= 51; day += 1) {
      const dateKey = shiftLocalDateKey('2026-01-01', day - 1)
      const occurredAt = new Date(`${dateKey}T12:00:00`).getTime()
      const completion = completeStreak(snapshot, dateKey, occurredAt)
      expect(completion.current).toBe(day)
      if (completion.reward > 0) rewards.set(day, completion.reward)
    }
    expect(Object.fromEntries(rewards)).toEqual({
      3: 10,
      7: 30,
      14: 60,
      30: 120,
      37: 70,
      44: 70,
      51: 70,
    })
    expect(snapshot.wallet.balance).toBe(430)
    expect(snapshot.tasks.streak).toMatchObject({ current: 51, longest: 51 })
  })

  it('grants the same milestone again in a new segment with a distinct settlement ID', () => {
    const snapshot = createEmptyLearningSnapshot()
    completeStreak(snapshot, '2026-11-01', at(1))
    completeStreak(snapshot, '2026-11-02', at(2))
    expect(completeStreak(snapshot, '2026-11-03', at(3)).reward).toBe(10)
    completeStreak(snapshot, '2026-11-05', at(5))
    completeStreak(snapshot, '2026-11-06', at(6))
    expect(completeStreak(snapshot, '2026-11-07', at(7))).toMatchObject({
      current: 3,
      longest: 3,
      reward: 10,
    })
    expect(snapshot.wallet.ledger.map((entry) => entry.settlementId)).toEqual([
      'streak:2026-11-01:3',
      'streak:2026-11-05:3',
    ])
  })

  it('resets after a gap, preserves the longest record and deduplicates a completed date', () => {
    const snapshot = createEmptyLearningSnapshot()
    completeStreak(snapshot, '2026-11-18', at(18))
    completeStreak(snapshot, '2026-11-19', at(19))
    expect(completeStreak(snapshot, '2026-11-19', at(19, 18))).toMatchObject({
      current: 2,
      reward: 0,
    })
    expect(completeStreak(snapshot, '2026-11-21', at(21))).toMatchObject({
      current: 1,
      longest: 2,
      milestone: null,
    })
    expect(snapshot.tasks.streak.lastCompletedDateKey).toBe('2026-11-21')
  })

  it('projects the next fixed or recurring milestone', () => {
    expect(getStreakMilestone(2)).toBeNull()
    expect(getStreakMilestone(37)).toEqual({ days: 37, reward: 70 })
    expect(getNextStreakMilestone(0)).toEqual({ days: 3, reward: 10 })
    expect(getNextStreakMilestone(3)).toEqual({ days: 7, reward: 30 })
    expect(getNextStreakMilestone(30)).toEqual({ days: 37, reward: 70 })
    expect(getNextStreakMilestone(37)).toEqual({ days: 44, reward: 70 })
  })
})

describe('learning projections', () => {
  it('separates effective completion, correction and mastery in today and group summaries', () => {
    const snapshot = createEmptyLearningSnapshot()
    snapshot.tasks.daily = {
      ...snapshot.tasks.daily,
      '2026-11-19': { goal: 2, completed: 0, rewarded: false },
    }
    const session = answerAll(makeSession('summary', 3), at(19))
    settleAll(snapshot, session)
    snapshot.practice.sessions = { ...snapshot.practice.sessions, [session.id]: session }
    snapshot.practice.retestPool = [
      {
        id: 'pending-retest',
        originalQuestion: generateMathQuestion('oral-mul-one-v1', 1, 'retest-original'),
        originSessionId: 'origin',
        seed: 2,
        createdAt: at(19),
        status: 'pending',
      },
    ]

    expect(getTodayLearningSummary(snapshot, at(19))).toMatchObject({
      dateKey: '2026-11-19',
      goal: 2,
      taskCompleted: 2,
      taskRemaining: 0,
      dailyRewarded: true,
      effectiveCompleted: 3,
      firstCorrect: 3,
      corrected: 0,
      mastered: 3,
      currentStreak: 1,
      longestStreak: 1,
      nextMilestone: { days: 3, reward: 10 },
      pendingRetest: 1,
      walletBalance: 28,
      practiceReward: 8,
      dailyReward: 20,
      streakReward: 0,
    })
    expect(getPracticeSessionSummary(snapshot, session.id)).toMatchObject({
      sessionId: session.id,
      status: 'completed',
      totalQuestions: 3,
      currentIndex: 2,
      effectiveCompleted: 3,
      mastered: 3,
      pendingRetest: 0,
      practiceReward: 8,
    })
    expect(getPracticeSessionSummary(snapshot, 'missing')).toBeNull()
    expect(getTodayLearningSummary(snapshot, at(20), 15)).toMatchObject({
      goal: 15,
      taskCompleted: 0,
      effectiveCompleted: 0,
    })
  })

  it('counts hint correction, explanation correction, abandonment and content errors distinctly', () => {
    const snapshot = createEmptyLearningSnapshot()
    const contentError = replacePracticeQuestion(
      makeSession('summary-content-error'),
      generateMathQuestion('oral-mul-one-v1', 999, 'content-error-replacement'),
      at(19),
    )
    const sessions = [
      completedSession('summary-hint', 'mastered-after-hint'),
      completedSession('summary-explanation', 'corrected-awaiting-retest'),
      abandonPracticeSession(makeSession('summary-abandoned'), at(19)),
      contentError,
    ]
    sessions.forEach((session) => {
      settleAll(snapshot, session)
      snapshot.practice.sessions = { ...snapshot.practice.sessions, [session.id]: session }
    })
    const explanationSession = sessions[1]
    snapshot.practice.retestPool = [
      {
        id: 'summary-retest',
        originalQuestion: explanationSession.questions[0].question,
        originSessionId: explanationSession.id,
        seed: 3,
        createdAt: at(19),
        status: 'pending',
      },
    ]
    const hint = getPracticeSessionSummary(snapshot, 'summary-hint')
    const explanation = getPracticeSessionSummary(snapshot, 'summary-explanation')
    const abandoned = getPracticeSessionSummary(snapshot, 'summary-abandoned')
    const content = getPracticeSessionSummary(snapshot, 'summary-content-error')
    expect(hint).toMatchObject({ effectiveCompleted: 1, corrected: 1, mastered: 1 })
    expect(explanation).toMatchObject({
      effectiveCompleted: 1,
      correctedAfterExplanation: 1,
      corrected: 1,
      mastered: 0,
      pendingRetest: 1,
    })
    expect(abandoned).toMatchObject({ effectiveCompleted: 0, abandoned: 1, mastered: 0 })
    expect(content).toMatchObject({ effectiveCompleted: 0, contentError: 1, mastered: 0 })
  })
})

describe('PRD fixed economic examples', () => {
  it('matches the configured 30-question all-first-correct daily income example', () => {
    expect(
      LEARNING_RULES.practiceRewards.withinGoal.firstCorrect * 30 +
        LEARNING_RULES.dailyTask.completionReward,
    ).toBe(110)
  })
})
