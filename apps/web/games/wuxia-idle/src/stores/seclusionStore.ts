/**
 * 闭关修炼状态管理 v2.0
 * 金庸武侠风格「点香修炼」系统
 */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type {
  SeclusionState,
  SeclusionSession,
  SeclusionSnapshot,
  SeclusionEventLog,
  AttributeGains,
  SeclusionType,
  StudyStats,
  DailyStudyStats,
  WeeklyStats,
  JianghuStoryEvent,
} from '@/types/seclusion';

const generateSessionId = (): string => {
  return `seclusion_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
};

const createEmptyAttributeGains = (): AttributeGains => ({
  strength: 0,
  agility: 0,
  vitality: 0,
  spirit: 0,
  maxHp: 0,
  maxEnergy: 0,
  attack: 0,
  defense: 0,
});

const createEmptyDailyStats = (date: string): DailyStudyStats => ({
  date,
  totalSessions: 0,
  totalMinutes: 0,
  practiceCount: 0,
  sparringCount: 0,
  readingCount: 0,
  interruptCount: 0,
  completedSessions: 0,
  collectiblesObtained: 0,
  expGained: 0,
  hpRecovered: 0,
  energyRecovered: 0,
});

const createEmptyWeeklyStats = (): WeeklyStats => ({
  dailyStats: [],
  weekStartDate: '',
  weekEndDate: '',
});

const createEmptyStudyStats = (): StudyStats => ({
  totalSessions: 0,
  totalMinutes: 0,
  totalInterruptions: 0,
  longestStreak: 0,
  currentStreak: 0,
  favoriteType: null,
  totalCollectibles: 0,
  weeklyStats: createEmptyWeeklyStats(),
});

const getTodayDateString = (): string => {
  return new Date().toISOString().split('T')[0];
};

export const useSeclusionStore = defineStore('seclusion', () => {
  const state = ref<SeclusionState>({
    isActive: false,
    isPaused: false,
    currentSession: null,
    accumulatedExp: 0,
    accumulatedHp: 0,
    accumulatedEnergy: 0,
    accumulatedAttributes: createEmptyAttributeGains(),
    eventHistory: [],
    studyStats: createEmptyStudyStats(),
    storyHistory: [],
  });

  const isActive = computed(() => state.value.isActive);
  const isPaused = computed(() => state.value.isPaused);
  const currentSession = computed(() => state.value.currentSession);
  const currentType = computed(
    (): SeclusionType | null => state.value.currentSession?.type ?? null
  );
  const elapsedMs = computed(() => state.value.currentSession?.elapsedMs ?? 0);
  const plannedDurationMs = computed(() => state.value.currentSession?.plannedDurationMs ?? 0);
  const progressPercent = computed(() => {
    if (!state.value.currentSession || plannedDurationMs.value === 0) return 0;
    return Math.min(1, elapsedMs.value / plannedDurationMs.value);
  });
  const remainingMs = computed(() => Math.max(0, plannedDurationMs.value - elapsedMs.value));
  const currentEfficiency = computed(() => state.value.currentSession?.efficiency ?? 1);
  const accumulatedExp = computed(() => state.value.accumulatedExp);
  const accumulatedHp = computed(() => state.value.accumulatedHp);
  const accumulatedEnergy = computed(() => state.value.accumulatedEnergy);
  const accumulatedAttributes = computed(() => state.value.accumulatedAttributes);
  const eventHistory = computed(() => state.value.eventHistory);
  const studyStats = computed(() => state.value.studyStats);
  const storyHistory = computed(() => state.value.storyHistory);
  const todaySessions = computed(() => {
    const today = getTodayDateString();
    const dailyStats = state.value.studyStats.weeklyStats.dailyStats;
    const todayData = dailyStats.find(d => d.date === today);
    return todayData?.totalSessions ?? 0;
  });
  const todayInterruptions = computed(() => {
    const today = getTodayDateString();
    const dailyStats = state.value.studyStats.weeklyStats.dailyStats;
    const todayData = dailyStats.find(d => d.date === today);
    return todayData?.interruptCount ?? 0;
  });

  const getOrCreateTodayStats = (): DailyStudyStats => {
    const today = getTodayDateString();
    const weeklyStats = state.value.studyStats.weeklyStats;

    if (!weeklyStats.weekStartDate) {
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      weeklyStats.weekStartDate = weekStart.toISOString().split('T')[0];
      weeklyStats.weekEndDate = new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0];
    }

    let todayData = weeklyStats.dailyStats.find(d => d.date === today);
    if (!todayData) {
      todayData = createEmptyDailyStats(today);
      weeklyStats.dailyStats.push(todayData);
      if (weeklyStats.dailyStats.length > 14) {
        weeklyStats.dailyStats.shift();
      }
    }

    return todayData;
  };

  const updateStreakStats = (): void => {
    const dailyStats = state.value.studyStats.weeklyStats.dailyStats.sort((a, b) =>
      a.date.localeCompare(b.date)
    );

    if (dailyStats.length === 0) {
      state.value.studyStats.currentStreak = 0;
      state.value.studyStats.longestStreak = 0;
      return;
    }

    let currentStreak = 0;
    let longestStreak = 0;
    let tempStreak = 0;
    let lastDate: string | null = null;

    for (const day of dailyStats) {
      if (day.totalSessions > 0) {
        if (lastDate) {
          const last = new Date(lastDate);
          const current = new Date(day.date);
          const diffDays = Math.floor((current.getTime() - last.getTime()) / (24 * 60 * 60 * 1000));
          if (diffDays === 1) {
            tempStreak++;
          } else {
            longestStreak = Math.max(longestStreak, tempStreak);
            tempStreak = 1;
          }
        } else {
          tempStreak = 1;
        }
        lastDate = day.date;
      }
    }

    longestStreak = Math.max(longestStreak, tempStreak);

    const today = getTodayDateString();
    const todayData = dailyStats.find(d => d.date === today);
    const hasTodaySessions = todayData && todayData.totalSessions > 0;

    if (!hasTodaySessions) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];
      const yesterdayData = dailyStats.find(d => d.date === yesterdayStr);
      if (yesterdayData && yesterdayData.totalSessions > 0) {
        currentStreak = tempStreak;
      } else {
        currentStreak = 0;
      }
    } else {
      currentStreak = tempStreak;
    }

    state.value.studyStats.currentStreak = currentStreak;
    state.value.studyStats.longestStreak = Math.max(
      state.value.studyStats.longestStreak,
      longestStreak
    );
  };

  const createSession = (
    type: SeclusionType,
    durationMinutes: number,
    efficiency: number,
    consumedResources: { itemId: string; quantity: number }[],
    doNotDisturb: boolean = false
  ): SeclusionSession => {
    const session: SeclusionSession = {
      id: generateSessionId(),
      type,
      startTime: Date.now(),
      plannedDurationMs: durationMinutes * 60 * 1000,
      elapsedMs: 0,
      consumedResources,
      efficiency,
      totalExpGained: 0,
      totalHpGained: 0,
      totalEnergyGained: 0,
      totalAttributeGains: createEmptyAttributeGains(),
      breakthroughAttempts: 0,
      breakthroughSuccesses: 0,
      temporaryEfficiencyModifier: 0,
      interruptCount: 0,
      lastInterruptTime: null,
      collectibleDrops: [],
      storyEvent: null,
    };

    state.value.currentSession = session;
    state.value.isActive = true;
    state.value.isPaused = false;
    state.value.accumulatedExp = 0;
    state.value.accumulatedHp = 0;
    state.value.accumulatedEnergy = 0;
    state.value.accumulatedAttributes = createEmptyAttributeGains();
    state.value.eventHistory = [];

    const todayStats = getOrCreateTodayStats();
    todayStats.totalSessions++;
    todayStats.totalMinutes += durationMinutes;
    if (type === 'practice') todayStats.practiceCount++;
    else if (type === 'sparring') todayStats.sparringCount++;
    else if (type === 'reading') todayStats.readingCount++;

    state.value.studyStats.totalSessions++;
    state.value.studyStats.totalMinutes += durationMinutes;

    return session;
  };

  const updateProgress = (deltaMs: number): void => {
    if (!state.value.currentSession || state.value.isPaused) return;
    state.value.currentSession.elapsedMs += deltaMs;
  };

  const addExp = (amount: number): void => {
    if (!state.value.currentSession) return;
    state.value.currentSession.totalExpGained += amount;
    state.value.accumulatedExp += amount;

    const todayStats = getOrCreateTodayStats();
    todayStats.expGained += amount;
  };

  const addHp = (amount: number): void => {
    if (!state.value.currentSession) return;
    state.value.currentSession.totalHpGained += amount;
    state.value.accumulatedHp += amount;

    const todayStats = getOrCreateTodayStats();
    todayStats.hpRecovered += amount;
  };

  const addEnergy = (amount: number): void => {
    if (!state.value.currentSession) return;
    state.value.currentSession.totalEnergyGained += amount;
    state.value.accumulatedEnergy += amount;

    const todayStats = getOrCreateTodayStats();
    todayStats.energyRecovered += amount;
  };

  const addAttributes = (gains: Partial<AttributeGains>): void => {
    if (!state.value.currentSession) return;

    const session = state.value.currentSession;
    const accumulated = state.value.accumulatedAttributes;

    for (const [key, value] of Object.entries(gains)) {
      if (typeof value === 'number') {
        const k = key as keyof AttributeGains;
        session.totalAttributeGains[k] = (session.totalAttributeGains[k] || 0) + value;
        accumulated[k] = (accumulated[k] || 0) + value;
      }
    }
  };

  const setTemporaryEfficiencyModifier = (modifier: number): void => {
    if (!state.value.currentSession) return;
    state.value.currentSession.temporaryEfficiencyModifier = modifier;
  };

  const recordBreakthroughAttempt = (success: boolean): void => {
    if (!state.value.currentSession) return;
    state.value.currentSession.breakthroughAttempts++;
    if (success) {
      state.value.currentSession.breakthroughSuccesses++;
    }
  };

  const recordInterrupt = (): void => {
    if (!state.value.currentSession) return;
    state.value.currentSession.interruptCount++;
    state.value.currentSession.lastInterruptTime = Date.now();

    const todayStats = getOrCreateTodayStats();
    todayStats.interruptCount++;

    state.value.studyStats.totalInterruptions++;
  };

  const addEventLog = (log: SeclusionEventLog): void => {
    state.value.eventHistory.push(log);
  };

  const recordCollectibleDrop = (drop: any): void => {
    if (!state.value.currentSession) return;
    state.value.currentSession.collectibleDrops.push(drop);

    const todayStats = getOrCreateTodayStats();
    todayStats.collectiblesObtained++;

    state.value.studyStats.totalCollectibles++;
  };

  const recordStoryEvent = (story: JianghuStoryEvent): void => {
    if (!state.value.currentSession) return;
    state.value.currentSession.storyEvent = story;
    state.value.storyHistory.unshift(story);

    if (state.value.storyHistory.length > 50) {
      state.value.storyHistory.pop();
    }
  };

  const recordCompletion = (completedWithoutInterrupt: boolean): void => {
    if (!state.value.currentSession) return;

    const todayStats = getOrCreateTodayStats();
    todayStats.completedSessions++;

    const currentStats = state.value.studyStats;
    const type = state.value.currentSession.type;

    if (!currentStats.favoriteType) {
      const counts = [
        { type: 'practice' as SeclusionType, count: todayStats.practiceCount },
        { type: 'sparring' as SeclusionType, count: todayStats.sparringCount },
        { type: 'reading' as SeclusionType, count: todayStats.readingCount },
      ].sort((a, b) => b.count - a.count);

      currentStats.favoriteType = counts[0].count > 0 ? counts[0].type : null;
    }

    updateStreakStats();
  };

  const pause = (): void => {
    state.value.isPaused = true;
  };

  const resume = (): void => {
    state.value.isPaused = false;
  };

  const endSession = (): SeclusionSession | null => {
    const session = state.value.currentSession;
    state.value.currentSession = null;
    state.value.isActive = false;
    state.value.isPaused = false;
    return session;
  };

  const snapshot = (): SeclusionSnapshot => ({
    isActive: state.value.isActive,
    currentSession: state.value.currentSession ? { ...state.value.currentSession } : null,
    eventHistory: [...state.value.eventHistory],
    studyStats: { ...state.value.studyStats },
    storyHistory: [...state.value.storyHistory],
  });

  const restore = (snap: Partial<SeclusionSnapshot>): void => {
    if (typeof snap.isActive === 'boolean') {
      state.value.isActive = snap.isActive;
    }
    if (snap.currentSession !== undefined) {
      state.value.currentSession = snap.currentSession;
      if (snap.currentSession) {
        state.value.accumulatedExp = snap.currentSession.totalExpGained;
        state.value.accumulatedHp = snap.currentSession.totalHpGained;
        state.value.accumulatedEnergy = snap.currentSession.totalEnergyGained;
        state.value.accumulatedAttributes = { ...snap.currentSession.totalAttributeGains };
      }
    }
    if (Array.isArray(snap.eventHistory)) {
      state.value.eventHistory = snap.eventHistory;
    }
    if (snap.studyStats) {
      state.value.studyStats = snap.studyStats;
    }
    if (Array.isArray(snap.storyHistory)) {
      state.value.storyHistory = snap.storyHistory;
    }
  };

  const reset = (): void => {
    state.value = {
      isActive: false,
      isPaused: false,
      currentSession: null,
      accumulatedExp: 0,
      accumulatedHp: 0,
      accumulatedEnergy: 0,
      accumulatedAttributes: createEmptyAttributeGains(),
      eventHistory: [],
      studyStats: createEmptyStudyStats(),
      storyHistory: [],
    };
  };

  return {
    state,
    isActive,
    isPaused,
    currentSession,
    currentType,
    elapsedMs,
    plannedDurationMs,
    progressPercent,
    remainingMs,
    currentEfficiency,
    accumulatedExp,
    accumulatedHp,
    accumulatedEnergy,
    accumulatedAttributes,
    eventHistory,
    studyStats,
    storyHistory,
    todaySessions,
    todayInterruptions,
    createSession,
    updateProgress,
    addExp,
    addHp,
    addEnergy,
    addAttributes,
    setTemporaryEfficiencyModifier,
    recordBreakthroughAttempt,
    recordInterrupt,
    addEventLog,
    recordCollectibleDrop,
    recordStoryEvent,
    recordCompletion,
    pause,
    resume,
    endSession,
    snapshot,
    restore,
    reset,
  };
});
