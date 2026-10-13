/**
 * 生活技能配置服务
 * 负责加载和管理生活技能资源配置
 */

import type { ResourceConfig, LifeSkillType } from '@/types/lifeSkill';
import JSON5 from 'json5';
import LIFE_SKILLS_RAW from '@/assets/configs/life-skills.json5?raw';

interface LifeSkillConfigData {
  version: string;
  herbGathering: Record<string, Omit<ResourceConfig, 'skillType'>>;
  fishing: Record<string, Omit<ResourceConfig, 'skillType'>>;
  hunting: Record<string, Omit<ResourceConfig, 'skillType'>>;
  woodcutting: Record<string, Omit<ResourceConfig, 'skillType'>>;
  mining: Record<string, Omit<ResourceConfig, 'skillType'>>;
}

export class LifeSkillConfigService {
  private static configs: Map<LifeSkillType, Map<string, ResourceConfig>> = new Map();
  private static initialized = false;

  /**
   * 初始化配置服务
   */
  static async init(): Promise<void> {
    if (this.initialized) return;

    try {
      const data: LifeSkillConfigData = JSON5.parse(LIFE_SKILLS_RAW);
      
      // 初始化采药资源
      const herbMap = new Map<string, ResourceConfig>();
      Object.values(data.herbGathering).forEach(resource => {
        herbMap.set(resource.id, {
          ...resource,
          skillType: 'herb_gathering' as LifeSkillType
        });
      });
      this.configs.set('herb_gathering' as LifeSkillType, herbMap);

      // 初始化钓鱼资源
      const fishMap = new Map<string, ResourceConfig>();
      Object.values(data.fishing).forEach(resource => {
        fishMap.set(resource.id, {
          ...resource,
          skillType: 'fishing' as LifeSkillType
        });
      });
      this.configs.set('fishing' as LifeSkillType, fishMap);

      // 初始化狩猎资源
      const huntMap = new Map<string, ResourceConfig>();
      Object.values(data.hunting).forEach(resource => {
        huntMap.set(resource.id, {
          ...resource,
          skillType: 'hunting' as LifeSkillType
        });
      });
      this.configs.set('hunting' as LifeSkillType, huntMap);

      // 初始化伐木资源
      const woodMap = new Map<string, ResourceConfig>();
      Object.values(data.woodcutting).forEach(resource => {
        woodMap.set(resource.id, {
          ...resource,
          skillType: 'woodcutting' as LifeSkillType
        });
      });
      this.configs.set('woodcutting' as LifeSkillType, woodMap);

      // 初始化采矿资源
      const miningMap = new Map<string, ResourceConfig>();
      Object.values(data.mining).forEach(resource => {
        miningMap.set(resource.id, {
          ...resource,
          skillType: 'mining' as LifeSkillType
        });
      });
      this.configs.set('mining' as LifeSkillType, miningMap);

      this.initialized = true;
      console.log(
        '[LifeSkillConfigService] 配置加载成功:',
        `采药资源 ${herbMap.size} 种,`,
        `钓鱼资源 ${fishMap.size} 种,`,
        `狩猎资源 ${huntMap.size} 种,`,
        `伐木资源 ${woodMap.size} 种,`,
        `采矿资源 ${miningMap.size} 种`
      );
    } catch (error) {
      console.error('[LifeSkillConfigService] 配置加载失败:', error);
      this.configs = new Map();
      this.initialized = true;
    }
  }

  /**
   * 获取指定技能的所有资源
   */
  static getResourcesBySkill(skillType: LifeSkillType): ResourceConfig[] {
    const resourceMap = this.configs.get(skillType);
    if (!resourceMap) return [];
    return Array.from(resourceMap.values()).sort((a, b) => a.requiredLevel - b.requiredLevel);
  }

  /**
   * 获取指定资源配置
   */
  static getResource(resourceId: string, skillType: LifeSkillType): ResourceConfig | null {
    const resourceMap = this.configs.get(skillType);
    return resourceMap?.get(resourceId) || null;
  }

  /**
   * 获取玩家当前等级可采集的资源
   */
  static getAvailableResources(skillType: LifeSkillType, playerLevel: number): ResourceConfig[] {
    return this.getResourcesBySkill(skillType).filter(
      resource => resource.requiredLevel <= playerLevel
    );
  }

  /**
   * 获取下一级解锁的资源
   */
  static getNextUnlockResource(skillType: LifeSkillType, playerLevel: number): ResourceConfig | null {
    const resources = this.getResourcesBySkill(skillType);
    return resources.find(resource => resource.requiredLevel > playerLevel) || null;
  }

  /**
   * 通过资源ID查找资源（搜索所有技能类型）
   * 用于烹饪等需要跨技能类型查找材料的场景
   */
  static findResourceById(resourceId: string): ResourceConfig | null {
    for (const [, resourceMap] of this.configs) {
      const resource = resourceMap.get(resourceId);
      if (resource) {
        return resource;
      }
    }
    return null;
  }

  /**
   * 通过资源ID获取资源名称
   * 如果找不到资源，返回资源ID本身
   */
  static getResourceName(resourceId: string): string {
    const resource = this.findResourceById(resourceId);
    return resource?.name || resourceId;
  }
}

