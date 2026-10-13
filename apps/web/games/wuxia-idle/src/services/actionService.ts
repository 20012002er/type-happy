import type { Player } from '@/types/player';
import { ActionType, PlayerState } from '@/types/player';
import {
  calculateMeditationRewards,
  calculatePracticeRewards,
  calculateRestRewards
} from '@/utils/calculations';

export interface IActionService {
  performAction(player: Player, type: ActionType): Promise<{
    success: boolean;
    message: string;
    duration: number;
    changes: Partial<Player>;
    actionType: ActionType;
  }>;
}

export class LocalActionService implements IActionService {
  async performAction(player: Player, type: ActionType) {
    switch (type) {
      case ActionType.MEDITATE: {
        const rewards = calculateMeditationRewards(player.stats.level);
        return {
          success: true,
          message: `打坐完成，恢复${rewards.hpRestore}生命，获得${rewards.expGain}经验。`,
          duration: rewards.duration,
          actionType: type,
          changes: {
            stats: {
              ...player.stats,
              hp: Math.min(player.stats.maxHp, player.stats.hp + rewards.hpRestore)
            } as any
          }
        };
      }
      case ActionType.PRACTICE: {
        const rewards = calculatePracticeRewards(player.stats.level);
        return {
          success: true,
          message: `练功完成，获得${rewards.expGain}经验${rewards.attackIncrease > 0 ? '，攻击+1' : ''}。`,
          duration: rewards.duration,
          actionType: type,
          changes: rewards.attackIncrease > 0 ? {
            stats: {
              ...player.stats,
              attack: player.stats.attack + rewards.attackIncrease
            } as any
          } : {}
        };
      }
      case ActionType.REST: {
        const rewards = calculateRestRewards(player.stats.level, player.stats.maxHp);
        return {
          success: true,
          message: `休息完成，恢复${rewards.hpRestore}生命。`,
          duration: rewards.duration,
          actionType: type,
          changes: {
            stats: {
              ...player.stats,
              hp: Math.min(player.stats.maxHp, player.stats.hp + rewards.hpRestore)
            } as any
          }
        };
      }
      case ActionType.EXPLORE: {
        // 先占位：探索耗时与提示
        const duration = 4000;
        return {
          success: true,
          message: '你在四处打听消息，观察江湖动向。',
          duration,
          actionType: type,
          changes: {}
        };
      }
      case ActionType.RESTORE_HP: {
        // 恢复生命值（打坐/休息合并，不获得经验）
        const hpRestore = Math.floor(15 + player.stats.level * 2);
        const duration = 3000;
        return {
          success: true,
          message: `调息完成，恢复${hpRestore}点生命值。`,
          duration,
          actionType: type,
          changes: {
            stats: {
              ...player.stats,
              hp: Math.min(player.stats.maxHp, player.stats.hp + hpRestore)
            } as any
          }
        };
      }
      case ActionType.RESTORE_STAMINA: {
        // 恢复体力
        const staminaRestore = Math.floor(20 + player.stats.level);
        const duration = 2000;
        const runtimePlayer = player as any;
        const currentStamina = Math.floor(runtimePlayer.stamina?.current || 0);
        const maxStamina = runtimePlayer.stamina?.max || 100;
        const actualRestore = Math.min(staminaRestore, maxStamina - currentStamina);
        return {
          success: true,
          message: `调息完成，恢复${actualRestore}点体力。`,
          duration,
          actionType: type,
          changes: {
            stamina: {
              current: Math.min(maxStamina, currentStamina + actualRestore),
              max: maxStamina
            }
          } as any
        };
      }
      case ActionType.RESTORE_ENERGY: {
        // 恢复内力
        const energyRestore = Math.floor(25 + player.stats.level * 1.5);
        const duration = 2000;
        const currentEnergy = Math.floor(player.stats.energy || 0);
        const maxEnergy = player.stats.maxEnergy || 100;
        const actualRestore = Math.min(energyRestore, maxEnergy - currentEnergy);
        return {
          success: true,
          message: `调息完成，恢复${actualRestore}点内力。`,
          duration,
          actionType: type,
          changes: {
            stats: {
              ...player.stats,
              energy: Math.min(maxEnergy, currentEnergy + actualRestore)
            } as any
          }
        };
      }
      default:
        return { success: false, message: '未知动作', duration: 0, changes: {}, actionType: type };
    }
  }
}

// 预留远程实现占位
export class RemoteActionService implements IActionService {
  async performAction(player: Player, type: ActionType) {
    // 未来对接后端API
    const local = new LocalActionService();
    return local.performAction(player, type);
  }
}

export const actionService: IActionService = new LocalActionService();


