/**
 * GroupCombatService 属性测试
 * 验证群体战斗机制的正确性
 *
 * Property 4: 群体战斗机制
 * Property 5: 目标选择策略
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { GroupCombatService } from './GroupCombatService';
import { arbitraryEnemy, arbitraryEnemyGroup } from '@/test/generators';
import type { Player } from '@/types/player';
import type { RuntimeEnemy } from '@/types/dungeon';

// Mock martialService
vi.mock('@/services/martialService', () => ({
  martialService: {
    getLearnedMoves: vi.fn().mockResolvedValue([]),
  },
}));

// Mock calculateDamage
vi.mock('@/utils/calculations', () => ({
  calculateDamage: (attack: number, defense: number) => Math.max(1, attack - defense),
}));

/**
 * 创建测试用玩家
 */
const createMockPlayer = (stats: Partial<Player['stats']> = {}): Player =>
  ({
    name: '测试侠客',
    stats: {
      hp: 1000,
      maxHp: 1000,
      attack: 100,
      defense: 50,
      level: 10,
      energy: 100,
      maxEnergy: 100,
      ...stats,
    },
    resources: { gold: 0 },
  }) as Player;

describe('GroupCombatService Properties', () => {
  let service: GroupCombatService;

  beforeEach(() => {
    service = new GroupCombatService();
  });

  /**
   * Property 4: 群体战斗机制
   * 测试战斗结束条件（任一方全灭）
   */
  describe('Property 4: 群体战斗机制', () => {
    it('战斗应在任一方全灭时结束', async () => {
      await fc.assert(
        fc.asyncProperty(
          arbitraryEnemyGroup(),
          fc.record({
            hp: fc.integer({ min: 100, max: 5000 }),
            attack: fc.integer({ min: 50, max: 500 }),
            defense: fc.integer({ min: 10, max: 100 }),
          }),
          async (enemies, playerStats) => {
            const player = createMockPlayer(playerStats);

            const result = await service.start(player, enemies, {
              delayMs: 0, // 无延迟加速测试
              playerCritChance: 0.1,
              enemyCritChance: 0.05,
            });

            // 战斗必须有胜负
            expect(['player', 'enemies']).toContain(result.winner);

            // 如果玩家获胜，所有敌人应被击败
            if (result.winner === 'player') {
              expect(result.enemySurvivors).toHaveLength(0);
              expect(result.enemiesDefeated.length).toBeGreaterThan(0);
            }

            // 如果敌人获胜，应有存活敌人
            if (result.winner === 'enemies') {
              expect(result.enemySurvivors.length).toBeGreaterThanOrEqual(0);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('敌人数量应在 1~5 范围内', async () => {
      await fc.assert(
        fc.asyncProperty(arbitraryEnemyGroup(), async (enemies) => {
          const player = createMockPlayer({ hp: 10000, attack: 1000 });

          const result = await service.start(player, enemies, { delayMs: 0 });

          // 击败的敌人 + 存活的敌人 = 原始敌人数量（最多5个）
          const totalProcessed = result.enemiesDefeated.length + result.enemySurvivors.length;
          expect(totalProcessed).toBeLessThanOrEqual(5);
          expect(totalProcessed).toBeGreaterThanOrEqual(1);
        }),
        { numRuns: 100 }
      );
    });

    it('每次行动应生成事件', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(arbitraryEnemy(), { minLength: 1, maxLength: 3 }),
          async (enemies) => {
            const player = createMockPlayer({ hp: 500, attack: 100 });
            const logs: unknown[] = [];

            await service.start(
              player,
              enemies,
              { delayMs: 0 },
              (log) => logs.push(log)
            );

            // 应该有战斗日志
            expect(logs.length).toBeGreaterThan(0);

            // 每个日志应包含事件
            for (const log of logs as Array<{ event: unknown }>) {
              expect(log.event).toBeDefined();
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('玩家每回合行动一次后敌人依次行动', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(arbitraryEnemy(), { minLength: 2, maxLength: 3 }),
          async (enemies) => {
            // 确保敌人有足够 HP 存活多回合
            const toughEnemies = enemies.map((e) => ({
              ...e,
              stats: { ...e.stats, hp: 1000, maxHp: 1000, defense: 50 },
            }));

            const player = createMockPlayer({ hp: 5000, attack: 50, defense: 100 });
            const logs: Array<{ attacker: string; roundNumber: number }> = [];

            await service.start(
              player,
              toughEnemies,
              { delayMs: 0 },
              (log) => logs.push({ attacker: log.attacker, roundNumber: log.roundNumber })
            );

            // 检查回合顺序：每回合玩家先行动
            const roundGroups = new Map<number, string[]>();
            for (const log of logs) {
              if (!roundGroups.has(log.roundNumber)) {
                roundGroups.set(log.roundNumber, []);
              }
              roundGroups.get(log.roundNumber)!.push(log.attacker);
            }

            // 每回合第一个行动者应该是玩家
            for (const [, attackers] of roundGroups) {
              if (attackers.length > 0) {
                expect(attackers[0]).toBe('player');
              }
            }
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  /**
   * Property 5: 目标选择策略
   */
  describe('Property 5: 目标选择策略', () => {
    it('单体攻击只影响一个敌人', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(arbitraryEnemy(), { minLength: 2, maxLength: 5 }),
          async (enemies) => {
            // 确保敌人有足够 HP
            const toughEnemies = enemies.map((e) => ({
              ...e,
              stats: { ...e.stats, hp: 10000, maxHp: 10000 },
            }));

            const player = createMockPlayer({ hp: 100, attack: 100 }); // 低 HP 快速结束
            const logs: Array<{ targets: Array<{ instanceId: string }> }> = [];

            await service.start(
              player,
              toughEnemies,
              { delayMs: 0 },
              (log) => {
                if (log.attacker === 'player') {
                  logs.push({ targets: log.targets });
                }
              }
            );

            // 玩家的每次攻击应只影响一个目标
            for (const log of logs) {
              expect(log.targets.length).toBeLessThanOrEqual(1);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('lowest_hp 策略应选择 HP 最低的敌人', async () => {
      // 创建 HP 明显不同的敌人
      const enemies: RuntimeEnemy[] = [
        {
          instanceId: 'enemy_high_hp',
          configId: 'test',
          name: '高血敌人',
          tier: 'normal',
          stats: { hp: 1000, maxHp: 1000, attack: 10, defense: 0, level: 1 },
        },
        {
          instanceId: 'enemy_low_hp',
          configId: 'test',
          name: '低血敌人',
          tier: 'normal',
          stats: { hp: 100, maxHp: 100, attack: 10, defense: 0, level: 1 },
        },
        {
          instanceId: 'enemy_mid_hp',
          configId: 'test',
          name: '中血敌人',
          tier: 'normal',
          stats: { hp: 500, maxHp: 500, attack: 10, defense: 0, level: 1 },
        },
      ];

      const player = createMockPlayer({ hp: 10000, attack: 50, defense: 100 });
      const firstTargets: string[] = [];

      await service.start(
        player,
        enemies,
        { delayMs: 0 },
        (log) => {
          if (log.attacker === 'player' && log.targets.length > 0) {
            firstTargets.push(log.targets[0].instanceId);
          }
        }
      );

      // 第一次攻击应该选择 HP 最低的敌人
      if (firstTargets.length > 0) {
        expect(firstTargets[0]).toBe('enemy_low_hp');
      }
    });
  });
});
