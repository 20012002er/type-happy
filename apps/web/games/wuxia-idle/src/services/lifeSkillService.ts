/**
 * 生活技能服务
 * 处理资源采集、技能升级等业务逻辑
 */

import type { LifeSkillType, ResourceConfig, GatherResult } from '@/types/lifeSkill';
import { LifeSkillConfigService } from './config/LifeSkillConfigService';
import { useLifeSkillStore } from '@/stores/lifeSkillStore';
import { usePlayerStore } from '@/stores/playerStore';
import { useGameLogStore } from '@/stores/gameLogStore';
import { useMaterialsStore } from '@/stores/materialsStore';
import { LogType } from '@/types/gameLog';

export class LifeSkillService {
  /**
   * 计算采集成功率
   * @param resource 资源配置
   * @param playerLevel 玩家技能等级
   */
  static calculateSuccessRate(resource: ResourceConfig, playerLevel: number): number {
    if (playerLevel < resource.requiredLevel) {
      return 0; // 等级不足，无法采集
    }

    // 基础成功率 + 等级加成
    // 每超过要求等级1级，成功率提升2%
    const levelBonus = (playerLevel - resource.requiredLevel) * 0.02;
    const successRate = Math.min(resource.baseSuccessRate + levelBonus, 1.0);

    return successRate;
  }

  /**
   * 执行资源采集
   * @param skillType 技能类型
   * @param resourceId 资源ID
   */
  static async gatherResource(skillType: LifeSkillType, resourceId: string): Promise<GatherResult> {
    const lifeSkillStore = useLifeSkillStore();
    const playerStore = usePlayerStore();
    const gameLogStore = useGameLogStore();

    // 获取资源配置
    const resource = LifeSkillConfigService.getResource(resourceId, skillType);
    if (!resource) {
      return {
        success: false,
        resourceId,
        quantity: 0,
        experience: 0,
        message: '未找到该资源',
      };
    }

    // 检查技能等级
    const playerLevel = lifeSkillStore.getSkillLevel(skillType);
    if (playerLevel < resource.requiredLevel) {
      return {
        success: false,
        resourceId,
        quantity: 0,
        experience: 0,
        message: `技能等级不足！需要 Lv.${resource.requiredLevel}，当前 Lv.${playerLevel}`,
      };
    }

    // 计算成功率
    const successRate = this.calculateSuccessRate(resource, playerLevel);
    const isSuccess = Math.random() < successRate;

    if (!isSuccess) {
      // 采集失败，但仍获得部分经验
      const failExp = Math.floor(resource.experience * 0.2);
      const levelUpResult = lifeSkillStore.addExp(skillType, failExp);

      gameLogStore.addLog(LogType.INFO, `采集 ${resource.name} 失败...（获得 ${failExp} 经验）`);

      return {
        success: false,
        resourceId,
        quantity: 0,
        experience: failExp,
        message: `采集失败...（获得 ${failExp} 经验）`,
        levelUp: levelUpResult.levelUp,
        newLevel: levelUpResult.newLevel,
      };
    }

    // 采集成功
    const quantity = 1; // 基础获得1个
    const levelUpResult = lifeSkillStore.addExp(skillType, resource.experience);

    // 将资源添加到背包
    const materialsStore = useMaterialsStore();
    materialsStore.add(resourceId, quantity, resource.name);

    gameLogStore.addLog(
      LogType.INFO,
      `成功采集 ${resource.name} x${quantity}！（获得 ${resource.experience} 经验）${
        levelUpResult.levelUp ? ` ✨ 技能升级至 Lv.${levelUpResult.newLevel}!` : ''
      }`
    );

    return {
      success: true,
      resourceId,
      quantity,
      experience: resource.experience,
      message: `成功采集 ${resource.name} x${quantity}！`,
      levelUp: levelUpResult.levelUp,
      newLevel: levelUpResult.newLevel,
    };
  }

  /**
   * 自动采集（不消耗体力，用于队列采集）
   * @param skillType 技能类型
   * @param resourceId 资源ID
   */
  static async gatherResourceAuto(
    skillType: LifeSkillType,
    resourceId: string
  ): Promise<GatherResult> {
    const lifeSkillStore = useLifeSkillStore();
    const playerStore = usePlayerStore();
    const gameLogStore = useGameLogStore();

    // 获取资源配置
    const resource = LifeSkillConfigService.getResource(resourceId, skillType);
    if (!resource) {
      return {
        success: false,
        resourceId,
        quantity: 0,
        experience: 0,
        message: '未找到该资源',
      };
    }

    // 检查技能等级
    const playerLevel = lifeSkillStore.getSkillLevel(skillType);
    if (playerLevel < resource.requiredLevel) {
      return {
        success: false,
        resourceId,
        quantity: 0,
        experience: 0,
        message: `技能等级不足！需要 Lv.${resource.requiredLevel}，当前 Lv.${playerLevel}`,
      };
    }

    // 计算成功率
    const successRate = this.calculateSuccessRate(resource, playerLevel);
    const isSuccess = Math.random() < successRate;

    // 【自动采集不消耗体力】

    if (!isSuccess) {
      // 采集失败，但仍获得部分经验
      const failSkillExp = Math.floor(resource.experience * 0.2);
      const skillLevelUpResult = lifeSkillStore.addExp(skillType, failSkillExp);

      // 失败时也给少量角色经验（技能经验的30%）
      const failCharacterExp = Math.floor(failSkillExp * 0.3);
      const characterLevelUpResult = playerStore.gainExperience(failCharacterExp);

      let logMessage = `[自动] 采集 ${resource.name} 失败（获得 ${failSkillExp} 技能经验`;
      if (failCharacterExp > 0) {
        logMessage += `，${failCharacterExp} 角色经验`;
      }
      logMessage += '）';

      gameLogStore.addLog(LogType.INFO, logMessage);

      return {
        success: false,
        resourceId,
        quantity: 0,
        experience: failSkillExp,
        message: `采集失败（获得 ${failSkillExp} 经验）`,
        levelUp: skillLevelUpResult.levelUp,
        newLevel: skillLevelUpResult.newLevel,
      };
    }

    // 采集成功
    const quantity = 1; // 基础获得1个

    // 🎯 增加技能经验
    const skillLevelUpResult = lifeSkillStore.addExp(skillType, resource.experience);

    // 🎯 增加角色总经验（技能经验的30%转化为角色经验）
    // 参考 MilkyWay Idle 的设计，技能经验和角色经验分开计算
    const characterExp = Math.floor(resource.experience * 0.3);
    const characterLevelUpResult = playerStore.gainExperience(characterExp);

    // 将资源添加到背包
    const materialsStore = useMaterialsStore();
    materialsStore.add(resourceId, quantity, resource.name);

    // 构建日志信息
    let logMessage = `[自动] 采集 ${resource.name} x${quantity}（+${resource.experience} 技能经验`;
    if (characterExp > 0) {
      logMessage += `，+${characterExp} 角色经验`;
    }
    logMessage += '）';

    // 添加技能升级提示
    if (skillLevelUpResult.levelUp) {
      logMessage += ` ✨ ${this.getSkillName(skillType)}技能升级至 Lv.${skillLevelUpResult.newLevel}!`;
    }

    // 添加角色升级提示
    if (characterLevelUpResult) {
      logMessage += ` ⭐ 角色升级至 Lv.${characterLevelUpResult.newLevel}!`;
    }

    gameLogStore.addLog(LogType.INFO, logMessage);

    return {
      success: true,
      resourceId,
      quantity,
      experience: resource.experience,
      message: `成功采集 ${resource.name} x${quantity}！`,
      levelUp: skillLevelUpResult.levelUp,
      newLevel: skillLevelUpResult.newLevel,
    };
  }

  /**
   * 获取技能名称（用于UI显示）
   */
  static getSkillName(skillType: LifeSkillType): string {
    const nameMap: Record<LifeSkillType, string> = {
      herb_gathering: '采药',
      woodcutting: '伐木',
      fishing: '钓鱼',
      mining: '采矿',
      hunting: '狩猎',
      alchemy: '炼丹',
      cooking: '烹饪',
      smithing: '铸造',
      leatherworking: '制皮',
      artifact_crafting: '炼器',
      talisman_making: '符箓',
      mechanism: '机关',
      incense_making: '调香',
    };
    return nameMap[skillType] || skillType;
  }

  /**
   * 获取资源品质颜色
   */
  static getQualityColor(quality: string): string {
    const colorMap: Record<string, string> = {
      common: '#999', // 灰色
      fine: '#2ecc71', // 绿色
      rare: '#3498db', // 蓝色
      epic: '#9b59b6', // 紫色
      legendary: '#e67e22', // 橙色
      mythic: '#f39c12', // 金色
    };
    return colorMap[quality] || '#999';
  }

  /**
   * 获取资源品质名称
   */
  static getQualityName(quality: string): string {
    const nameMap: Record<string, string> = {
      common: '普通',
      fine: '精良',
      rare: '稀有',
      epic: '史诗',
      legendary: '传说',
      mythic: '神话',
    };
    return nameMap[quality] || quality;
  }
}
