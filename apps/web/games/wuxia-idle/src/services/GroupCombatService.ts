/**
 * 群体战斗服务
 * 支持玩家对多敌人的回合制战斗
 */

import type { Player } from '@/types/player';
import type { RuntimeEnemy } from '@/types/dungeon';
import type { CombatEvent, CombatEventType } from '@/types/narrative';
import type { Move } from '@/types/martial';
import { calculateDamage } from '@/utils/calculations';
import { martialService } from '@/services/martialService';

// ========== 类型定义 ==========

export interface GroupCombatOptions {
  maxEnemies?: number;
  delayMs?: number;
  playerCritChance?: number;
  playerCritMultiplier?: number;
  playerDodgeChance?: number;
  enemyCritChance?: number;
  enemyCritMultiplier?: number;
  enemyDodgeChance?: number;
  skillUseChance?: number;
  activeSkills?: string[];
}

export interface GroupCombatRoundLog {
  roundNumber: number;
  attacker: string;
  attackerName: string;
  action: 'attack' | 'skill' | 'dodge' | 'block';
  targets: Array<{
    instanceId: string;
    name: string;
    damage: number;
    isCrit: boolean;
    isDodged: boolean;
    remainingHp: number;
  }>;
  skillId?: string;
  skillName?: string;
  skillEmoji?: string;
  energyCost?: number;
  event: CombatEvent;
}

export interface GroupCombatResult {
  winner: 'player' | 'enemies';
  rounds: GroupCombatRoundLog[];
  totalDamageDealt: number;
  totalDamageTaken: number;
  enemiesDefeated: string[];
  enemySurvivors: string[];
}

type TargetStrategy = 'random' | 'lowest_hp' | 'highest_threat';

// ========== 服务实现 ==========

export class GroupCombatService {
  private static readonly DEFAULT_OPTIONS: Required<GroupCombatOptions> = {
    maxEnemies: 5,
    delayMs: 400,
    playerCritChance: 0.1,
    playerCritMultiplier: 1.5,
    playerDodgeChance: 0.05,
    enemyCritChance: 0.05,
    enemyCritMultiplier: 1.5,
    enemyDodgeChance: 0.02,
    skillUseChance: 0.5,
    activeSkills: []
  };

  /**
   * 开始群体战斗
   */
  async start(
    player: Player,
    enemies: RuntimeEnemy[],
    options?: GroupCombatOptions,
    onLog?: (log: GroupCombatRoundLog) => void,
    onHpUpdate?: (playerHp: number, enemiesHp: Map<string, number>, playerEnergy?: number) => void
  ): Promise<GroupCombatResult> {
    const cfg = { ...GroupCombatService.DEFAULT_OPTIONS, ...options };
    
    // 限制敌人数量
    const activeEnemies = enemies.slice(0, cfg.maxEnemies);
    
    // 初始化战斗状态
    const playerState = {
      hp: player.stats.hp,
      maxHp: player.stats.maxHp,
      attack: player.stats.attack,
      defense: player.stats.defense,
      energy: player.stats.energy ?? 0,
      maxEnergy: player.stats.maxEnergy ?? 100
    };

    const enemyStates = new Map<string, RuntimeEnemy>(
      activeEnemies.map(e => [e.instanceId, { ...e, stats: { ...e.stats } }])
    );

    const logs: GroupCombatRoundLog[] = [];
    let roundNumber = 0;
    let totalDamageDealt = 0;
    let totalDamageTaken = 0;
    const enemiesDefeated: string[] = [];

    // 加载玩家技能
    const slotMoves = await this.loadPlayerMoves(player, cfg.activeSkills);

    // 战斗主循环
    while (playerState.hp > 0 && this.hasAliveEnemies(enemyStates)) {
      roundNumber++;

      // 玩家回合
      const playerLog = await this.executePlayerTurn(
        player,
        playerState,
        enemyStates,
        slotMoves,
        cfg,
        roundNumber
      );
      
      logs.push(playerLog);
      totalDamageDealt += playerLog.targets.reduce((sum, t) => sum + t.damage, 0);
      
      if (onLog) onLog(playerLog);
      if (onHpUpdate) {
        onHpUpdate(
          playerState.hp,
          new Map([...enemyStates].map(([id, e]) => [id, e.stats.hp])),
          playerState.energy
        );
      }

      // 检查是否有敌人被击败
      for (const [id, enemy] of enemyStates) {
        if (enemy.stats.hp <= 0 && !enemiesDefeated.includes(id)) {
          enemiesDefeated.push(id);
        }
      }

      await this.delay(cfg.delayMs);

      // 敌人回合（存活敌人依次行动）
      for (const [instanceId, enemy] of enemyStates) {
        if (enemy.stats.hp <= 0 || playerState.hp <= 0) continue;

        const enemyLog = await this.executeEnemyTurn(
          player,
          playerState,
          enemy,
          cfg,
          roundNumber
        );

        logs.push(enemyLog);
        totalDamageTaken += enemyLog.targets[0]?.damage ?? 0;

        if (onLog) onLog(enemyLog);
        if (onHpUpdate) {
          onHpUpdate(
            playerState.hp,
            new Map([...enemyStates].map(([id, e]) => [id, e.stats.hp])),
            playerState.energy
          );
        }

        await this.delay(cfg.delayMs / 2);
      }
    }

    const winner = playerState.hp > 0 ? 'player' : 'enemies';
    const enemySurvivors = [...enemyStates]
      .filter(([_, e]) => e.stats.hp > 0)
      .map(([id]) => id);

    return {
      winner,
      rounds: logs,
      totalDamageDealt,
      totalDamageTaken,
      enemiesDefeated,
      enemySurvivors
    };
  }

  /**
   * 执行玩家回合
   */
  private async executePlayerTurn(
    player: Player,
    playerState: { hp: number; attack: number; defense: number; energy: number },
    enemyStates: Map<string, RuntimeEnemy>,
    slotMoves: Move[],
    cfg: Required<GroupCombatOptions>,
    roundNumber: number
  ): Promise<GroupCombatRoundLog> {
    // 选择目标
    const target = this.selectTarget([...enemyStates.values()].filter(e => e.stats.hp > 0), 'lowest_hp');
    
    if (!target) {
      // 没有存活敌人，返回空日志
      return this.createEmptyLog(roundNumber, player.name, 'player');
    }

    // 决定使用技能还是普攻
    const { move, useSkill } = this.selectMove(slotMoves, playerState.energy, cfg.skillUseChance);
    
    // 计算伤害
    const baseDamage = calculateDamage(playerState.attack, target.stats.defense);
    let damage = baseDamage;
    let isCrit = false;
    let energyCost = 0;

    if (useSkill && move) {
      damage = Math.floor(baseDamage * (move.damageMultiplier ?? 1));
      if (move.damageFlat) damage += move.damageFlat;
      energyCost = move.energyCost ?? 0;
      
      const critChance = Math.min(1, cfg.playerCritChance + (move.extraCritChance ?? 0));
      if (Math.random() < critChance) {
        damage = Math.floor(damage * cfg.playerCritMultiplier);
        isCrit = true;
      }
      
      // 保证技能伤害不低于普攻
      damage = Math.max(baseDamage + 1, damage);
      playerState.energy = Math.max(0, playerState.energy - energyCost);
    } else {
      if (Math.random() < cfg.playerCritChance) {
        damage = Math.floor(damage * cfg.playerCritMultiplier);
        isCrit = true;
      }
    }

    // 检查闪避
    const isDodged = Math.random() < cfg.enemyDodgeChance;
    const finalDamage = isDodged ? 0 : damage;

    // 应用伤害
    target.stats.hp = Math.max(0, target.stats.hp - finalDamage);

    // 生成事件
    const eventType: CombatEventType = isCrit ? 'combat.crit' : (useSkill ? 'combat.skill' : 'combat.attack');
    const event: CombatEvent = {
      type: eventType,
      attacker: 'player',
      attackerName: player.name,
      defenderName: target.name,
      damage: finalDamage,
      isCrit,
      isDodged,
      move: useSkill && move ? {
        id: move.id,
        name: move.name,
        emoji: this.pickSkillEmoji(move),
        target: 'single'
      } : undefined,
      playerHp: playerState.hp,
      defenderHp: target.stats.hp,
      context: {
        enemyCount: [...enemyStates.values()].filter(e => e.stats.hp > 0).length,
        isLastEnemy: [...enemyStates.values()].filter(e => e.stats.hp > 0).length === 1
      }
    };

    return {
      roundNumber,
      attacker: 'player',
      attackerName: player.name,
      action: useSkill ? 'skill' : 'attack',
      targets: [{
        instanceId: target.instanceId,
        name: target.name,
        damage: finalDamage,
        isCrit,
        isDodged,
        remainingHp: target.stats.hp
      }],
      skillId: useSkill ? move?.id : undefined,
      skillName: useSkill ? move?.name : undefined,
      skillEmoji: useSkill ? this.pickSkillEmoji(move) : undefined,
      energyCost: useSkill ? energyCost : undefined,
      event
    };
  }

  /**
   * 执行敌人回合
   */
  private async executeEnemyTurn(
    player: Player,
    playerState: { hp: number; attack: number; defense: number },
    enemy: RuntimeEnemy,
    cfg: Required<GroupCombatOptions>,
    roundNumber: number
  ): Promise<GroupCombatRoundLog> {
    // 计算伤害
    const attackMul = enemy.modifiers?.attackMul ?? 1;
    const effectiveAttack = Math.floor(enemy.stats.attack * attackMul);
    const baseDamage = calculateDamage(effectiveAttack, playerState.defense);
    
    let damage = baseDamage;
    let isCrit = false;

    if (Math.random() < cfg.enemyCritChance) {
      damage = Math.floor(damage * cfg.enemyCritMultiplier);
      isCrit = true;
    }

    // 检查玩家闪避
    const isDodged = Math.random() < cfg.playerDodgeChance;
    const finalDamage = isDodged ? 0 : damage;

    // 应用伤害
    playerState.hp = Math.max(0, playerState.hp - finalDamage);

    // 生成事件
    const eventType: CombatEventType = isDodged ? 'combat.dodge' : (isCrit ? 'combat.crit' : 'combat.attack');
    const event: CombatEvent = {
      type: eventType,
      attacker: 'enemy',
      attackerName: enemy.name,
      defenderName: player.name,
      damage: finalDamage,
      isCrit,
      isDodged,
      playerHp: playerState.hp
    };

    return {
      roundNumber,
      attacker: enemy.instanceId,
      attackerName: enemy.name,
      action: isDodged ? 'dodge' : 'attack',
      targets: [{
        instanceId: 'player',
        name: player.name,
        damage: finalDamage,
        isCrit,
        isDodged,
        remainingHp: playerState.hp
      }],
      event
    };
  }

  /**
   * 选择目标
   */
  private selectTarget(
    enemies: RuntimeEnemy[],
    strategy: TargetStrategy
  ): RuntimeEnemy | null {
    const alive = enemies.filter(e => e.stats.hp > 0);
    if (alive.length === 0) return null;

    switch (strategy) {
      case 'lowest_hp':
        return alive.reduce((min, e) => e.stats.hp < min.stats.hp ? e : min);
      case 'highest_threat':
        return alive.reduce((max, e) => e.stats.attack > max.stats.attack ? e : max);
      case 'random':
      default:
        return alive[Math.floor(Math.random() * alive.length)];
    }
  }

  /**
   * 选择技能
   */
  private selectMove(
    moves: Move[],
    currentEnergy: number,
    skillUseChance: number
  ): { move: Move | null; useSkill: boolean } {
    if (moves.length === 0 || Math.random() >= skillUseChance) {
      return { move: null, useSkill: false };
    }

    const usable = moves.filter(m => (m.energyCost ?? 0) <= currentEnergy);
    if (usable.length === 0) {
      return { move: null, useSkill: false };
    }

    const move = usable[Math.floor(Math.random() * usable.length)];
    return { move, useSkill: true };
  }

  /**
   * 加载玩家技能
   */
  private async loadPlayerMoves(player: Player, activeSkills: string[]): Promise<Move[]> {
    if (activeSkills.length === 0) return [];

    try {
      const learned = await martialService.getLearnedMoves(player);
      const learnedMap = new Map(learned.map(m => [m.id, m]));
      return activeSkills
        .map(id => learnedMap.get(id))
        .filter((m): m is Move => m !== undefined);
    } catch (error) {
      console.error('[GroupCombatService] 加载技能失败:', error);
      return [];
    }
  }

  /**
   * 检查是否有存活敌人
   */
  private hasAliveEnemies(enemies: Map<string, RuntimeEnemy>): boolean {
    return [...enemies.values()].some(e => e.stats.hp > 0);
  }

  /**
   * 随机选择技能表情
   */
  private pickSkillEmoji(move?: Move | null): string | undefined {
    const list = move?.emojis?.filter(Boolean);
    if (!list || list.length === 0) return undefined;
    return list[Math.floor(Math.random() * list.length)];
  }

  /**
   * 创建空日志
   */
  private createEmptyLog(roundNumber: number, attackerName: string, attacker: 'player' | 'enemy'): GroupCombatRoundLog {
    return {
      roundNumber,
      attacker,
      attackerName,
      action: 'attack',
      targets: [],
      event: {
        type: 'combat.attack',
        attacker,
        attackerName,
        defenderName: ''
      }
    };
  }

  /**
   * 延迟
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export const groupCombatService = new GroupCombatService();
