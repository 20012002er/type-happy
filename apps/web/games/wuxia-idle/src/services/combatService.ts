import type { Player } from '@/types/player';
import type { Enemy } from '@/types/enemy';
import type { Move } from '@/types/martial';
import type { SectType } from '@/types/sect';
import { calculateDamage } from '@/utils/calculations';
import { martialService } from '@/services/martialService';
import { MoveConfigService } from '@/services/config/MartialConfigServices';
import { staminaService } from '@/services/staminaService';
import { economyService } from '@/services/economyService';
import { ReputationService } from '@/services/reputationService';
import { useMapStore } from '@/stores/mapStore';
import { useMaterialsStore } from '@/stores/materialsStore';
import { useGameLogStore } from '@/stores/gameLogStore';
import { useEquipmentStore } from '@/stores/equipmentStore';
import { useGameEventStore } from '@/stores/gameEventStore';
import { usePlayerStore } from '@/stores/playerStore';
import { useSectStore } from '@/stores/sectStore';
import { sectConfigService } from '@/services/config/SectConfigService';
import i18n from '@/locales';

const pickSkillEmoji = (move?: Move): string | undefined => {
  const list = move?.emojis?.filter(Boolean);
  if (!list || list.length === 0) return undefined;
  return list[Math.floor(Math.random() * list.length)];
};

export interface CombatRoundLog {
  attacker: string;
  defender: string;
  damage: number;
  attackerHp: number;
  defenderHp: number;
  message: string;
  skillId?: string;
  skillEmoji?: string;
}

export interface CombatResult {
  winner: 'player' | 'enemy';
  rounds: CombatRoundLog[];
}

export interface CombatOptions {
  playerCritChance?: number;
  playerCritMultiplier?: number;
  playerDodgeChance?: number;
  enemyCritChance?: number;
  enemyCritMultiplier?: number;
  enemyDodgeChance?: number;
  skillUseChance?: number; // 🆕 技能使用概率（默认0.25）
  activeSkills?: string[]; // 🆕 技能槽配置（从CombatSettings传入）
}

export class AutoCombatService {
  async start(
    player: Player,
    enemy: Enemy,
    delayMs = 600,
    onLog?: (round: CombatRoundLog) => void,
    onHpUpdate?: (playerHp: number, enemyHp: number, playerEnergy?: number) => void,
    options?: CombatOptions
  ): Promise<CombatResult> {
    const { t } = (i18n as any).global;

    const playerStore = usePlayerStore();
    await staminaService.initGaugesIfNeeded();

    // 战斗开始时扣减1点体力（无论胜负）
    const runtimePlayer: any = playerStore.player as any;
    if (runtimePlayer?.stamina) {
      const currentStamina = Math.floor(runtimePlayer.stamina.current || 0);
      if (currentStamina < 1) {
        // 体力不足，无法发起战斗
        return {
          winner: 'enemy',
          rounds: [
            {
              attacker: enemy.name,
              defender: player.name,
              damage: 0,
              attackerHp: enemy.stats.hp,
              defenderHp: player.stats.hp,
              message: '体力不足，无法发起战斗。',
            },
          ],
        };
      }
      runtimePlayer.stamina.current = currentStamina - 1;
    }
    const logs: CombatRoundLog[] = [];
    const p = { ...player.stats } as any;
    const e = { ...enemy.stats } as any;
    const cfg = {
      playerCritChance: options?.playerCritChance ?? 0.1,
      playerCritMultiplier: options?.playerCritMultiplier ?? 1.5,
      playerDodgeChance: options?.playerDodgeChance ?? 0.05,
      enemyCritChance: options?.enemyCritChance ?? 0.05,
      enemyCritMultiplier: options?.enemyCritMultiplier ?? 1.5,
      enemyDodgeChance: options?.enemyDodgeChance ?? 0.02,
      skillUseChance: Math.min(Math.max(options?.skillUseChance ?? 0.5, 0), 1),
      activeSkills: (options?.activeSkills ?? []).filter(Boolean), // 🆕 技能槽配置
    };

    const slotMoves: Move[] = [];

    if (cfg.activeSkills.length > 0) {
      try {
        const learned = await martialService.getLearnedMoves(player);
        const learnedMap = new Map<string, Move>();
        for (const mv of learned) learnedMap.set(mv.id, mv);
        for (const id of cfg.activeSkills) {
          const mv = learnedMap.get(id);
          if (mv) slotMoves.push(mv);
        }
      } catch (error) {
        console.error('[CombatService] 读取技能列表失败，将仅使用普攻', error);
        slotMoves.length = 0;
      }
    }

    while (p.hp > 0 && e.hp > 0) {
      const storeStats = playerStore.player.stats;
      const storeHp = typeof storeStats.hp === 'number' ? storeStats.hp : undefined;
      const storeMaxHp = typeof storeStats.maxHp === 'number' ? storeStats.maxHp : undefined;
      if (storeHp !== undefined && storeHp > p.hp) {
        const limit = typeof p.maxHp === 'number' ? p.maxHp : (storeMaxHp ?? storeHp);
        p.hp = Math.min(storeHp, limit);
      }

      const storeEnergy = typeof storeStats.energy === 'number' ? storeStats.energy : undefined;
      const storeMaxEnergy =
        typeof storeStats.maxEnergy === 'number' ? storeStats.maxEnergy : undefined;
      if (storeEnergy !== undefined && (typeof p.energy !== 'number' || storeEnergy > p.energy)) {
        const limitEnergy =
          typeof p.maxEnergy === 'number' ? p.maxEnergy : (storeMaxEnergy ?? storeEnergy);
        p.energy = Math.min(storeEnergy, limitEnergy);
      }

      if (Math.random() >= cfg.enemyDodgeChance) {
        const baseDamage = calculateDamage(p.attack, e.defense);
        const baseCritChance = player.stats.critChance ?? cfg.playerCritChance;
        const baseCritMultiplier = player.stats.critMultiplier ?? cfg.playerCritMultiplier;
        let chosenName = '普攻';
        let dmg = baseDamage;
        let energyCost = 0;
        let skillUsed = false;
        let chosenSkillId: string | undefined;
        let skillEmoji: string | undefined;

        try {
          if (slotMoves.length > 0) {
            const usableMoves = slotMoves.filter(mv => {
              const levelOk =
                typeof mv.minLevel === 'number' ? player.stats.level >= mv.minLevel : true;
              if (!levelOk) return false;
              const cost = mv.energyCost ?? 0;
              return (p.energy ?? 0) >= cost;
            });

            if (usableMoves.length > 0 && Math.random() < cfg.skillUseChance) {
              const mv = usableMoves[Math.floor(Math.random() * usableMoves.length)];
              chosenName = mv.name;
              energyCost = mv.energyCost ?? 0;
              skillUsed = true;
              chosenSkillId = mv.id;
              skillEmoji = pickSkillEmoji(mv);

              let skillDamage = Math.floor(baseDamage * (mv.damageMultiplier ?? 1));
              if (mv.damageFlat) skillDamage += mv.damageFlat;

              const critChance = Math.min(
                1,
                Math.max(0, baseCritChance + (mv.extraCritChance ?? 0))
              );
              if (Math.random() < critChance) {
                const critMultiplier = player.stats.critMultiplier ?? cfg.playerCritMultiplier;
                skillDamage = Math.floor(skillDamage * critMultiplier);
              }

              const guaranteedBonus = Math.max(1, Math.floor(baseDamage * 0.1));
              dmg = Math.max(baseDamage + guaranteedBonus, skillDamage);
            }
          }

          // 如果没有使用技能，使用普攻
          if (!skillUsed) {
            if (Math.random() < baseCritChance) {
              dmg = Math.floor(baseDamage * baseCritMultiplier);
            }
          }
        } catch (error) {
          // 发生错误时回退到普攻
          console.error('[CombatService] 技能选择失败，回退到普攻:', error);
          if (Math.random() < baseCritChance) {
            dmg = Math.floor(baseDamage * baseCritMultiplier);
          }
        }

        if (energyCost > 0) {
          p.energy = Math.max(0, (p.energy ?? 0) - energyCost);
        }

        // 门派克制加成
        let sectCounterBonus = 1.0;
        const sectStore = useSectStore();
        const playerSectType = sectStore.sectType;
        const enemySectType = (enemy as any).sectType as string | null;
        if (playerSectType && enemySectType) {
          const bonus = sectConfigService.getDamageBonus(playerSectType, enemySectType as SectType);
          if (bonus > 0) {
            sectCounterBonus = 1 + bonus;
            dmg = Math.floor(dmg * sectCounterBonus);
            console.log(`[Combat] 门派克制伤害加成: +${Math.round(bonus * 100)}%`);
          }
        }

        const skillEmojiText = skillEmoji ? `${skillEmoji} ` : '';
        e.hp = Math.max(0, e.hp - dmg);
        const plog: CombatRoundLog = {
          attacker: player.name,
          defender: enemy.name,
          damage: dmg,
          attackerHp: p.hp,
          defenderHp: e.hp,
          message:
            `${player.name} 施展 ${skillEmojiText}【${chosenName}】造成 ${dmg} 伤害${skillUsed && energyCost > 0 ? `（消耗${energyCost}内力）` : ''}。`.replace(
              /\s{2,}/g,
              ' '
            ),
          skillId: chosenSkillId,
          skillEmoji,
        };
        logs.push(plog);
        if (onLog) onLog(plog);
        if (onHpUpdate) onHpUpdate(p.hp, e.hp, p.energy as any);
        if (e.hp <= 0) break;
      } else {
        const plog: CombatRoundLog = {
          attacker: player.name,
          defender: enemy.name,
          damage: 0,
          attackerHp: p.hp,
          defenderHp: e.hp,
          message: `${enemy.name} 灵巧闪避，未受伤害。`,
        };
        logs.push(plog);
        if (onLog) onLog(plog);
      }

      await this.delay(delayMs);

      if (p.hp > 0) {
        // 敌人行动：支持 AI 技能
        {
          let usedSkill = false;
          let enemyMove: Move | null = null;
          let skillEmoji: string | undefined;
          let dodgeChance = cfg.playerDodgeChance;

          try {
            const ai = (enemy as any).ai as
              | { skillUseChance?: number; skills?: string[] }
              | undefined;
            const skillIds = ai?.skills || [];
            const useChance =
              typeof ai?.skillUseChance === 'number'
                ? Math.min(Math.max(ai.skillUseChance, 0), 1)
                : 0;
            if (skillIds.length > 0 && Math.random() < useChance) {
              const chosenId = skillIds[Math.floor(Math.random() * skillIds.length)];
              enemyMove = await MoveConfigService.getMove(chosenId);
              if (enemyMove) {
                usedSkill = true;
                skillEmoji = pickSkillEmoji(enemyMove);
                if (typeof enemyMove.extraHitChance === 'number') {
                  dodgeChance = Math.max(0, dodgeChance - enemyMove.extraHitChance);
                }
              }
            }
          } catch (err) {
            enemyMove = null;
            usedSkill = false;
          }

          if (Math.random() >= dodgeChance) {
            let edmg = calculateDamage(e.attack, p.defense);

            if (usedSkill && enemyMove) {
              let skillDamage = Math.floor(edmg * (enemyMove.damageMultiplier ?? 1));
              if (enemyMove.damageFlat) skillDamage += enemyMove.damageFlat;
              const critChance = Math.min(
                1,
                Math.max(0, (cfg.enemyCritChance ?? 0.05) + (enemyMove.extraCritChance ?? 0))
              );
              if (Math.random() < critChance) {
                skillDamage = Math.floor(skillDamage * (cfg.enemyCritMultiplier ?? 1.5));
              }
              edmg = Math.max(edmg + Math.max(1, Math.floor(edmg * 0.1)), skillDamage);
            } else {
              if (Math.random() < cfg.enemyCritChance) {
                edmg = Math.floor(edmg * cfg.enemyCritMultiplier);
              }
            }

            p.hp = Math.max(0, p.hp - edmg);
            const skillEmojiText = usedSkill && skillEmoji ? `${skillEmoji} ` : '';
            const elog: CombatRoundLog =
              usedSkill && enemyMove
                ? {
                    attacker: enemy.name,
                    defender: player.name,
                    damage: edmg,
                    attackerHp: e.hp,
                    defenderHp: p.hp,
                    message:
                      `${enemy.name} 施展 ${skillEmojiText}【${enemyMove.name}】造成 ${edmg} 伤害。`.replace(
                        /\s{2,}/g,
                        ' '
                      ),
                    skillId: enemyMove.id,
                    skillEmoji,
                  }
                : {
                    attacker: enemy.name,
                    defender: player.name,
                    damage: edmg,
                    attackerHp: e.hp,
                    defenderHp: p.hp,
                    message: `${enemy.name} 反击，造成 ${edmg} 伤害。`,
                  };
            logs.push(elog);
            if (onLog) onLog(elog);
            if (onHpUpdate) onHpUpdate(p.hp, e.hp, p.energy as any);
          } else {
            const elog: CombatRoundLog = {
              attacker: enemy.name,
              defender: player.name,
              damage: 0,
              attackerHp: e.hp,
              defenderHp: p.hp,
              message: `${player.name} 身形一晃，躲开了攻击。`,
            };
            logs.push(elog);
            if (onLog) onLog(elog);
          }
        }
      }

      await this.delay(delayMs);
    }

    const winner = e.hp <= 0 ? 'player' : 'enemy';

    if (winner === 'player') {
      // 获取敌人类型（Boss/Elite）
      const enemyTier = (enemy as any).tier || 'normal';
      const isBoss = enemyTier === 'boss';
      const isElite = enemyTier === 'elite';

      // 触发游戏事件：击败敌人
      const gameEventStore = useGameEventStore();
      gameEventStore.onEnemyDefeated(enemy.id, { tier: enemyTier });

      // 声望奖励
      const enemyLevel = enemy.stats.level || 1;
      ReputationService.onCombatVictory(enemyLevel, isBoss, isElite);

      const map = useMapStore();
      const loc = map.getCurrentLocationSnapshot();
      if (loc && loc.idle) {
        const baseGoldPerSec = loc.idle.baseGoldPerSec || 0;
        const seconds =
          loc.idle.victorySeconds ?? Math.max(8, Math.floor(10 * (loc.idle.difficulty || 1)));
        const goldGain = Math.max(0, Math.floor(baseGoldPerSec * seconds));
        if (goldGain > 0) await economyService.addGold('combat', goldGain);
        // 随机材料掉落（寒水/乌炭）
        const ms = useMaterialsStore();
        if (Math.random() < 0.25) {
          ms.add('cold_water', 1, '寒水');
          useGameLogStore().addRewardLog('获得 寒水 ×1');
        }
        if (Math.random() < 0.2) {
          ms.add('black_charcoal', 1, '乌炭');
          useGameLogStore().addRewardLog('获得 乌炭 ×1');
        }
      }
    } else {
      // 敌人获胜：必定丢失未锁定物品
      const es = useEquipmentStore();
      const note = '可前往「破庙后院」赎回。字迹张狂，末尾一笔陡转，似含轻笑。';
      const lost = es.dropRandomCarryItem(note);
      if (lost) {
        useGameLogStore().addSystemLog(t('ui.equipment.defeatLost', { item: lost.name, note }));
      } else {
        useGameLogStore().addInfoLog(t('ui.equipment.defeatNoLoss'));
      }
    }

    return { winner, rounds: logs };
  }

  private delay(ms: number) {
    return new Promise(res => setTimeout(res, ms));
  }
}

export const combatService = new AutoCombatService();
