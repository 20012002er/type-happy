/**
 * 门派系统类型定义
 * 基于古典武侠游戏的门派体系
 */

import { SectType } from './reputation';
import type { ContributionLog, PlayerSectContribution } from './sectContribution';

/**
 * 门派基础配置
 */
export interface SectConfig {
  id: string;
  name: string;
  description: string;
  style: string;
  baseBonus: {
    attack?: number;
    defense?: number;
    hp?: number;
    energy?: number;
    energyRegen?: number;
    dodge?: number;
    crit?: number;
    speed?: number;
  };
  growthBonus: {
    attackPerLevel?: number;
    defensePerLevel?: number;
    hpPerLevel?: number;
  };
  lifeSkillBonus: {
    type: 'smithing' | 'alchemy' | 'gathering' | 'mining' | 'all';
    bonus: number;
  };
}

/**
 * 门派克制关系
 */
export interface SectCounterRelation {
  attacker: string;
  target: string;
  damageBonus: number;
}

/**
 * 单个门派的成长进度
 */
export interface SectProgressData {
  sectType: SectType;
  reputation: number;
  sectLevel: number;
  contribution: PlayerSectContribution;
  contributionLogs: ContributionLog[];
  unlockedMartials: string[];
  lastVictoryRewardClaimedAt?: number;
}

/**
 * 玩家门派数据
 */
export interface PlayerSectData {
  sectType: SectType | null;
  sectReputation: number;
  sectContribution: number;
  sectLevel: number;
  unlockedSkills: string[];
  lastTransferTime: number;
  sectProgress?: Record<string, SectProgressData>;
}

export { SectType };
