/**
 * 属性测试数据生成器
 * 用于 fast-check 属性测试
 */

import * as fc from 'fast-check';
import type { RuntimeEnemy } from '@/types/dungeon';
import type { CombatEvent, DungeonEvent, NarrativeLevel } from '@/types/narrative';

/**
 * 生成随机敌人
 */
export const arbitraryEnemy = (): fc.Arbitrary<RuntimeEnemy> =>
  fc.record({
    instanceId: fc.uuid(),
    configId: fc.string({ minLength: 1, maxLength: 20 }),
    name: fc.string({ minLength: 1, maxLength: 10 }),
    tier: fc.constantFrom('normal' as const, 'elite' as const, 'boss' as const),
    stats: fc.record({
      hp: fc.integer({ min: 1, max: 10000 }),
      maxHp: fc.integer({ min: 1, max: 10000 }),
      attack: fc.integer({ min: 1, max: 500 }),
      defense: fc.integer({ min: 0, max: 200 }),
      level: fc.integer({ min: 1, max: 100 }),
    }),
    modifiers: fc.option(
      fc.record({
        attackMul: fc.float({ min: 0.5, max: 2.0 }),
        defenseMul: fc.float({ min: 0.5, max: 2.0 }),
      }),
      { nil: undefined }
    ),
  });

/**
 * 生成 1-5 个敌人的数组
 */
export const arbitraryEnemyGroup = (): fc.Arbitrary<RuntimeEnemy[]> =>
  fc.array(arbitraryEnemy(), { minLength: 1, maxLength: 5 });

/**
 * 生成战斗事件
 */
export const arbitraryCombatEvent = (): fc.Arbitrary<CombatEvent> =>
  fc.record({
    type: fc.constantFrom(
      'combat.attack' as const,
      'combat.dodge' as const,
      'combat.crit' as const,
      'combat.skill' as const
    ),
    attacker: fc.constantFrom('player' as const, 'enemy' as const),
    attackerName: fc.string({ minLength: 1, maxLength: 10 }),
    defenderName: fc.string({ minLength: 1, maxLength: 10 }),
    damage: fc.option(fc.integer({ min: 0, max: 10000 }), { nil: undefined }),
    isCrit: fc.option(fc.boolean(), { nil: undefined }),
    isDodged: fc.option(fc.boolean(), { nil: undefined }),
    playerHp: fc.option(fc.integer({ min: 0, max: 10000 }), { nil: undefined }),
    defenderHp: fc.option(fc.integer({ min: 0, max: 10000 }), { nil: undefined }),
    move: fc.option(
      fc.record({
        id: fc.string({ minLength: 1, maxLength: 20 }),
        name: fc.string({ minLength: 1, maxLength: 10 }),
        emoji: fc.option(fc.string({ minLength: 1, maxLength: 2 }), { nil: undefined }),
        target: fc.constantFrom('single' as const, 'all' as const, 'lowest_hp' as const),
      }),
      { nil: undefined }
    ),
    context: fc.option(
      fc.record({
        waveIndex: fc.option(fc.integer({ min: 1, max: 10 }), { nil: undefined }),
        enemyCount: fc.option(fc.integer({ min: 1, max: 5 }), { nil: undefined }),
        isLastEnemy: fc.option(fc.boolean(), { nil: undefined }),
        isBossWave: fc.option(fc.boolean(), { nil: undefined }),
      }),
      { nil: undefined }
    ),
  });

/**
 * 生成地牢事件
 */
export const arbitraryDungeonEvent = (): fc.Arbitrary<DungeonEvent> =>
  fc.oneof(
    fc.record({
      type: fc.constant('dungeon.enter' as const),
      dungeonName: fc.string({ minLength: 1, maxLength: 20 }),
      totalWaves: fc.integer({ min: 1, max: 10 }),
    }),
    fc.record({
      type: fc.constant('dungeon.wave_start' as const),
      dungeonName: fc.string({ minLength: 1, maxLength: 20 }),
      waveIndex: fc.integer({ min: 1, max: 10 }),
      totalWaves: fc.integer({ min: 1, max: 10 }),
      waveTitle: fc.option(fc.string({ minLength: 1, maxLength: 20 }), { nil: undefined }),
      enemyCount: fc.integer({ min: 1, max: 5 }),
    }),
    fc.record({
      type: fc.constant('dungeon.wave_clear' as const),
      dungeonName: fc.string({ minLength: 1, maxLength: 20 }),
      waveIndex: fc.integer({ min: 1, max: 10 }),
      totalWaves: fc.integer({ min: 1, max: 10 }),
    }),
    fc.record({
      type: fc.constant('dungeon.finish' as const),
      dungeonName: fc.string({ minLength: 1, maxLength: 20 }),
      rewardPool: fc.option(
        fc.record({
          gold: fc.integer({ min: 0, max: 100000 }),
          exp: fc.integer({ min: 0, max: 100000 }),
          drops: fc.array(
            fc.record({
              name: fc.string({ minLength: 1, maxLength: 10 }),
              qty: fc.integer({ min: 1, max: 99 }),
            }),
            { maxLength: 5 }
          ),
        }),
        { nil: undefined }
      ),
    }),
    fc.record({
      type: fc.constant('dungeon.fail' as const),
      dungeonName: fc.string({ minLength: 1, maxLength: 20 }),
    }),
    fc.record({
      type: fc.constant('dungeon.abort' as const),
      dungeonName: fc.string({ minLength: 1, maxLength: 20 }),
    })
  );

/**
 * 生成叙事级别
 */
export const arbitraryNarrativeLevel = (): fc.Arbitrary<NarrativeLevel> =>
  fc.constantFrom('off' as const, 'brief' as const, 'normal' as const, 'drama' as const);

/**
 * 生成奖励池
 */
export const arbitraryRewardPool = () =>
  fc.record({
    gold: fc.integer({ min: 0, max: 100000 }),
    exp: fc.integer({ min: 0, max: 100000 }),
    drops: fc.array(
      fc.record({
        itemId: fc.string({ minLength: 1, maxLength: 20 }),
        name: fc.string({ minLength: 1, maxLength: 10 }),
        qty: fc.integer({ min: 1, max: 99 }),
        rarity: fc.option(fc.string({ minLength: 1, maxLength: 10 }), { nil: undefined }),
      }),
      { maxLength: 10 }
    ),
  });

/**
 * 生成地牢运行状态
 */
export const arbitraryDungeonRunState = () =>
  fc.record({
    dungeonId: fc.string({ minLength: 1, maxLength: 20 }),
    dungeonName: fc.string({ minLength: 1, maxLength: 20 }),
    waveIndex: fc.integer({ min: 0, max: 9 }),
    totalWaves: fc.integer({ min: 1, max: 10 }),
    enemies: fc.array(arbitraryEnemy(), { maxLength: 5 }),
    rewardPool: arbitraryRewardPool(),
    phase: fc.constantFrom(
      'idle' as const,
      'preparing' as const,
      'fighting' as const,
      'between' as const,
      'settlement' as const,
      'finished' as const,
      'failed' as const,
      'stopped' as const
    ),
    startTime: fc.integer({ min: 0, max: Date.now() }),
    battleCount: fc.integer({ min: 0, max: 100 }),
    wins: fc.integer({ min: 0, max: 100 }),
    losses: fc.integer({ min: 0, max: 100 }),
  });

/**
 * 生成玩家基础属性
 */
export const arbitraryPlayerStats = () =>
  fc.record({
    hp: fc.integer({ min: 1, max: 10000 }),
    maxHp: fc.integer({ min: 1, max: 10000 }),
    attack: fc.integer({ min: 1, max: 1000 }),
    defense: fc.integer({ min: 0, max: 500 }),
    level: fc.integer({ min: 1, max: 100 }),
    energy: fc.integer({ min: 0, max: 100 }),
    maxEnergy: fc.integer({ min: 100, max: 100 }),
  });
