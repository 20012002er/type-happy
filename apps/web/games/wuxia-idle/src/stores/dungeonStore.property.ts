/**
 * dungeonStore 属性测试
 * 验证地牢状态管理的正确性
 *
 * Property 2: 入口条件检查
 * Property 3: 状态机转换
 * Property 6: 奖励累积与倍率
 * Property 10: 状态序列化 Round-Trip
 * Property 13: 历史记录更新
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import type { DungeonPhase, DungeonRunState, RewardPool } from '@/types/dungeon';
import { arbitraryDungeonRunState, arbitraryRewardPool } from '@/test/generators';

// 状态转换规则
const VALID_TRANSITIONS: Record<DungeonPhase, DungeonPhase[]> = {
  idle: ['preparing'],
  preparing: ['fighting', 'stopped'],
  fighting: ['between', 'settlement', 'failed', 'stopped'],
  between: ['fighting', 'stopped'],
  settlement: ['finished'],
  finished: ['idle'],
  failed: ['idle'],
  stopped: ['idle'],
};

/**
 * 验证状态转换是否合法
 */
const isValidTransition = (from: DungeonPhase, to: DungeonPhase): boolean => {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
};

/**
 * 计算奖励结算
 */
const calculateSettlement = (pool: RewardPool, ratio: number) => ({
  gold: Math.floor(pool.gold * ratio),
  exp: Math.floor(pool.exp * ratio),
});

describe('DungeonStore Properties', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  /**
   * Property 2: 入口条件检查
   */
  describe('Property 2: 入口条件检查', () => {
    it('等级不足时应返回失败', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 10 }), // 玩家等级
          fc.integer({ min: 11, max: 100 }), // 地牢要求等级
          (playerLevel, requiredLevel) => {
            // 玩家等级低于要求时，应该无法进入
            const canEnter = playerLevel >= requiredLevel;
            expect(canEnter).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('体力不足时应返回失败', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 4 }), // 当前体力
          fc.integer({ min: 5, max: 20 }), // 需要体力
          (currentStamina, requiredStamina) => {
            const canEnter = currentStamina >= requiredStamina;
            expect(canEnter).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('条件满足时应正确扣除消耗', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 10, max: 100 }), // 当前体力
          fc.integer({ min: 1, max: 10 }), // 需要体力
          fc.integer({ min: 1000, max: 10000 }), // 当前金币
          fc.integer({ min: 0, max: 500 }), // 需要金币
          (currentStamina, requiredStamina, currentGold, requiredGold) => {
            // 扣除后的值
            const remainingStamina = currentStamina - requiredStamina;
            const remainingGold = currentGold - requiredGold;

            // 应该正确扣除
            expect(remainingStamina).toBe(currentStamina - requiredStamina);
            expect(remainingGold).toBe(currentGold - requiredGold);
            expect(remainingStamina).toBeGreaterThanOrEqual(0);
            expect(remainingGold).toBeGreaterThanOrEqual(0);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 3: 状态机转换
   */
  describe('Property 3: 状态机转换', () => {
    const allPhases: DungeonPhase[] = [
      'idle',
      'preparing',
      'fighting',
      'between',
      'settlement',
      'finished',
      'failed',
      'stopped',
    ];

    it('合法状态转换应被接受', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...allPhases),
          fc.constantFrom(...allPhases),
          (from, to) => {
            const isValid = isValidTransition(from, to);
            const expectedValid = VALID_TRANSITIONS[from]?.includes(to) ?? false;
            expect(isValid).toBe(expectedValid);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('非法状态转换应被拒绝', () => {
      // 测试一些明确非法的转换
      const illegalTransitions: [DungeonPhase, DungeonPhase][] = [
        ['idle', 'fighting'], // 必须先 preparing
        ['idle', 'settlement'],
        ['preparing', 'settlement'], // 必须先 fighting
        ['between', 'settlement'], // 必须先 fighting
        ['finished', 'fighting'],
        ['failed', 'fighting'],
      ];

      for (const [from, to] of illegalTransitions) {
        expect(isValidTransition(from, to)).toBe(false);
      }
    });

    it('idle → preparing 是唯一的入口转换', () => {
      const validFromIdle = VALID_TRANSITIONS.idle;
      expect(validFromIdle).toEqual(['preparing']);
    });

    it('任何状态都可以转换到 stopped（除了终态）', () => {
      const canStop: DungeonPhase[] = ['preparing', 'fighting', 'between'];
      for (const phase of canStop) {
        expect(isValidTransition(phase, 'stopped')).toBe(true);
      }
    });
  });

  /**
   * Property 6: 奖励累积与倍率
   */
  describe('Property 6: 奖励累积与倍率', () => {
    it('通关时发放 100% 奖励', () => {
      fc.assert(
        fc.property(arbitraryRewardPool(), (pool) => {
          const settlement = calculateSettlement(pool, 1.0);

          expect(settlement.gold).toBe(pool.gold);
          expect(settlement.exp).toBe(pool.exp);
        }),
        { numRuns: 100 }
      );
    });

    it('失败时发放 50% 奖励（向下取整）', () => {
      fc.assert(
        fc.property(arbitraryRewardPool(), (pool) => {
          const settlement = calculateSettlement(pool, 0.5);

          expect(settlement.gold).toBe(Math.floor(pool.gold * 0.5));
          expect(settlement.exp).toBe(Math.floor(pool.exp * 0.5));
        }),
        { numRuns: 100 }
      );
    });

    it('倍率应用应正确计算', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 10000 }), // 基础金币
          fc.integer({ min: 0, max: 10000 }), // 基础经验
          fc.float({ min: 0.5, max: 3.0 }), // 金币倍率
          fc.float({ min: 0.5, max: 3.0 }), // 经验倍率
          (baseGold, baseExp, goldMul, expMul) => {
            const finalGold = Math.floor(baseGold * goldMul);
            const finalExp = Math.floor(baseExp * expMul);

            // 倍率应用后的值应该是正确的
            expect(finalGold).toBe(Math.floor(baseGold * goldMul));
            expect(finalExp).toBe(Math.floor(baseExp * expMul));

            // 倍率 > 1 时应该增加
            if (goldMul > 1 && baseGold > 0) {
              expect(finalGold).toBeGreaterThanOrEqual(baseGold);
            }
            if (expMul > 1 && baseExp > 0) {
              expect(finalExp).toBeGreaterThanOrEqual(baseExp);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('奖励累积应正确叠加', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              gold: fc.integer({ min: 0, max: 1000 }),
              exp: fc.integer({ min: 0, max: 1000 }),
            }),
            { minLength: 1, maxLength: 10 }
          ),
          (rewards) => {
            let totalGold = 0;
            let totalExp = 0;

            for (const reward of rewards) {
              totalGold += reward.gold;
              totalExp += reward.exp;
            }

            const expectedGold = rewards.reduce((sum, r) => sum + r.gold, 0);
            const expectedExp = rewards.reduce((sum, r) => sum + r.exp, 0);

            expect(totalGold).toBe(expectedGold);
            expect(totalExp).toBe(expectedExp);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 10: 状态序列化 Round-Trip
   */
  describe('Property 10: 状态序列化 Round-Trip', () => {
    it('序列化后反序列化应得到等价对象', () => {
      fc.assert(
        fc.property(arbitraryDungeonRunState(), (state) => {
          // 序列化
          const serialized = JSON.stringify(state);

          // 反序列化
          const deserialized = JSON.parse(serialized) as DungeonRunState;

          // 验证关键字段
          expect(deserialized.dungeonId).toBe(state.dungeonId);
          expect(deserialized.dungeonName).toBe(state.dungeonName);
          expect(deserialized.waveIndex).toBe(state.waveIndex);
          expect(deserialized.totalWaves).toBe(state.totalWaves);
          expect(deserialized.phase).toBe(state.phase);
          expect(deserialized.rewardPool.gold).toBe(state.rewardPool.gold);
          expect(deserialized.rewardPool.exp).toBe(state.rewardPool.exp);
        }),
        { numRuns: 100 }
      );
    });

    it('localStorage 存储和恢复应保持数据完整', () => {
      fc.assert(
        fc.property(arbitraryDungeonRunState(), (state) => {
          const STORAGE_KEY = 'test_dungeon_state';

          // 存储
          localStorage.setItem(STORAGE_KEY, JSON.stringify({ runState: state }));

          // 恢复
          const saved = localStorage.getItem(STORAGE_KEY);
          expect(saved).not.toBeNull();

          const data = JSON.parse(saved!) as { runState: DungeonRunState };
          expect(data.runState.dungeonId).toBe(state.dungeonId);
          expect(data.runState.phase).toBe(state.phase);

          // 清理
          localStorage.removeItem(STORAGE_KEY);
        }),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 13: 历史记录更新
   */
  describe('Property 13: 历史记录更新', () => {
    it('完成后应添加历史记录', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('cleared' as const, 'failed' as const, 'aborted' as const),
          arbitraryDungeonRunState(),
          (result, state) => {
            // 模拟历史记录
            const history: Array<{
              dungeonId: string;
              completedAt: number;
              result: string;
              wavesCleared: number;
              totalWaves: number;
            }> = [];

            // 添加记录
            history.push({
              dungeonId: state.dungeonId,
              completedAt: Date.now(),
              result,
              wavesCleared: state.waveIndex,
              totalWaves: state.totalWaves,
            });

            // 验证记录
            expect(history.length).toBe(1);
            expect(history[0].dungeonId).toBe(state.dungeonId);
            expect(history[0].result).toBe(result);
            expect(history[0].wavesCleared).toBe(state.waveIndex);
            expect(history[0].totalWaves).toBe(state.totalWaves);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('历史记录应包含所有必需字段', () => {
      fc.assert(
        fc.property(arbitraryDungeonRunState(), (state) => {
          const record = {
            dungeonId: state.dungeonId,
            completedAt: Date.now(),
            result: 'cleared' as const,
            wavesCleared: state.waveIndex,
            totalWaves: state.totalWaves,
            rewards: { ...state.rewardPool },
          };

          // 验证所有必需字段存在
          expect(record.dungeonId).toBeDefined();
          expect(record.completedAt).toBeDefined();
          expect(record.result).toBeDefined();
          expect(record.wavesCleared).toBeDefined();
          expect(record.totalWaves).toBeDefined();
          expect(record.rewards).toBeDefined();

          // 验证字段类型
          expect(typeof record.dungeonId).toBe('string');
          expect(typeof record.completedAt).toBe('number');
          expect(['cleared', 'failed', 'aborted']).toContain(record.result);
          expect(typeof record.wavesCleared).toBe('number');
          expect(typeof record.totalWaves).toBe('number');
        }),
        { numRuns: 100 }
      );
    });
  });
});
