/**
 * 门派配置服务
 * 提供门派配置读取、克制关系查询等功能
 */

import JSON5 from 'json5';
import SECTS_RAW from '@/assets/configs/sects.json5?raw';
import type { SectConfig, SectCounterRelation } from '@/types/sect';
import { SectType } from '@/types/sect';

interface SectsJsonConfig {
  sects: {
    [key: string]: {
      name: string;
      description: string;
      bonuses: Record<string, number>;
      primaryAttribute: string;
      icon: string;
    };
  };
  counters: {
    [key: string]: {
      counters: string;
      bonus: number;
    };
  };
  transferConfig: {
    cooldownDays: number;
    goldCost: number;
  };
}

class SectConfigService {
  private config: SectsJsonConfig = JSON5.parse(SECTS_RAW);

  /**
   * 获取单个门派配置
   */
  getSectConfig(sectType: SectType): SectConfig | null {
    const sectData = this.config.sects[sectType];
    if (!sectData) return null;

    return this.convertToSectConfig(sectType, sectData);
  }

  /**
   * 获取所有门派配置
   */
  getAllSects(): SectConfig[] {
    return Object.keys(this.config.sects)
      .map(key => {
        const sectType = key as SectType;
        return this.getSectConfig(sectType)!;
      })
      .filter(Boolean);
  }

  /**
   * 根据ID获取门派配置
   */
  getSectById(id: string): SectConfig | null {
    if (id in SectType) {
      return this.getSectConfig(id as SectType);
    }
    return null;
  }

  /**
   * 获取门派克制伤害加成
   */
  getDamageBonus(attackerSect: SectType, targetSect: SectType): number {
    const counter = this.config.counters[attackerSect];
    if (!counter) return 0;

    if (counter.counters === targetSect) {
      return counter.bonus;
    }
    return 0;
  }

  /**
   * 获取转投冷却天数
   */
  getTransferCooldownDays(): number {
    return this.config.transferConfig.cooldownDays;
  }

  /**
   * 获取转投金币消耗
   */
  getTransferGoldCost(): number {
    return this.config.transferConfig.goldCost;
  }

  /**
   * 检查是否存在克制关系
   */
  canCounter(attackerSect: SectType, targetSect: SectType): boolean {
    const counter = this.config.counters[attackerSect];
    return counter?.counters === targetSect;
  }

  /**
   * 转换为 SectConfig 类型
   */
  private convertToSectConfig(
    sectType: SectType,
    data: SectsJsonConfig['sects'][string]
  ): SectConfig {
    const bonuses = data.bonuses;
    const baseBonus: SectConfig['baseBonus'] = {};
    const lifeSkillBonus: SectConfig['lifeSkillBonus'] = { type: 'all', bonus: 0 };

    // 映射属性加成
    if (bonuses.defense !== undefined) baseBonus.defense = bonuses.defense;
    if (bonuses.hp !== undefined) baseBonus.hp = bonuses.hp;
    if (bonuses.mp !== undefined) baseBonus.energy = bonuses.mp;
    if (bonuses.recovery !== undefined) baseBonus.energyRegen = bonuses.recovery;
    if (bonuses.dodge !== undefined) baseBonus.dodge = bonuses.dodge;
    if (bonuses.crit !== undefined) baseBonus.crit = bonuses.crit;
    if (bonuses.speed !== undefined) baseBonus.speed = bonuses.speed;
    if (bonuses.attack !== undefined) baseBonus.attack = bonuses.attack;

    // 映射生活技能加成
    if (bonuses.smithing !== undefined) {
      lifeSkillBonus.type = 'smithing';
      lifeSkillBonus.bonus = bonuses.smithing;
    } else if (bonuses.alchemy !== undefined) {
      lifeSkillBonus.type = 'alchemy';
      lifeSkillBonus.bonus = bonuses.alchemy;
    } else if (bonuses.gathering !== undefined) {
      lifeSkillBonus.type = 'gathering';
      lifeSkillBonus.bonus = bonuses.gathering;
    } else if (bonuses.mining !== undefined) {
      lifeSkillBonus.type = 'mining';
      lifeSkillBonus.bonus = bonuses.mining;
    } else if (bonuses.resources !== undefined) {
      lifeSkillBonus.type = 'all';
      lifeSkillBonus.bonus = bonuses.resources;
    }

    const styleNames: Record<SectType, string> = {
      [SectType.少林]: '刚猛肉盾',
      [SectType.武当]: '柔韧续航',
      [SectType.峨眉]: '灵动爆发',
      [SectType.华山]: '极限输出',
      [SectType.丐帮]: '均衡辅助',
    };

    return {
      id: sectType,
      name: data.name,
      description: data.description,
      style: styleNames[sectType] || data.primaryAttribute,
      baseBonus,
      growthBonus: {},
      lifeSkillBonus,
    };
  }
}

export const sectConfigService = new SectConfigService();
