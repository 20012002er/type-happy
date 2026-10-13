/**
 * 生活技能 Store
 * 管理玩家的生活技能等级和经验
 */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { LifeSkillType, SkillProgress, PlayerSkillData } from '@/types/lifeSkill';

/**
 * 技能等级经验表（参考 MilkyWayIdle）
 * 使用指数增长公式：EXP = 100 * (level ^ 1.5)
 */
function getRequiredExp(level: number): number {
  if (level >= 99) return 999999999; // 最大等级99
  return Math.floor(100 * Math.pow(level + 1, 1.5));
}

export const useLifeSkillStore = defineStore('lifeSkill', () => {
  // ========== 状态 ==========
  
  /**
   * 玩家技能数据
   * key: LifeSkillType
   */
  const skills = ref<PlayerSkillData>({
    herb_gathering: { level: 1, currentExp: 0, totalExp: 0 },
    woodcutting: { level: 1, currentExp: 0, totalExp: 0 },
    fishing: { level: 1, currentExp: 0, totalExp: 0 },
    mining: { level: 1, currentExp: 0, totalExp: 0 },
    hunting: { level: 1, currentExp: 0, totalExp: 0 },
    alchemy: { level: 1, currentExp: 0, totalExp: 0 },
    cooking: { level: 1, currentExp: 0, totalExp: 0 },
    smithing: { level: 1, currentExp: 0, totalExp: 0 },
    leatherworking: { level: 1, currentExp: 0, totalExp: 0 },
    artifact_crafting: { level: 1, currentExp: 0, totalExp: 0 },
    talisman_making: { level: 1, currentExp: 0, totalExp: 0 },
    mechanism: { level: 1, currentExp: 0, totalExp: 0 },
    incense_making: { level: 1, currentExp: 0, totalExp: 0 }
  });

  /**
   * 当前正在进行的技能（用于UI展示）
   */
  const activeSkill = ref<LifeSkillType | null>(null);

  /**
   * 当前正在采集的资源ID
   */
  const activeResourceId = ref<string | null>(null);

  // ========== 计算属性 ==========

  /**
   * 获取技能进度信息
   */
  const getSkillProgress = computed(() => {
    return (skillType: LifeSkillType): SkillProgress => {
      const skill = skills.value[skillType];
      if (!skill) {
        return {
          skillType,
          level: 1,
          currentExp: 0,
          requiredExp: getRequiredExp(1),
          totalExp: 0
        };
      }

      return {
        skillType,
        level: skill.level,
        currentExp: skill.currentExp,
        requiredExp: getRequiredExp(skill.level),
        totalExp: skill.totalExp
      };
    };
  });

  /**
   * 获取技能等级
   */
  const getSkillLevel = computed(() => {
    return (skillType: LifeSkillType): number => {
      return skills.value[skillType]?.level || 1;
    };
  });

  /**
   * 获取总技能等级（所有技能等级之和）
   */
  const totalSkillLevel = computed(() => {
    return Object.values(skills.value).reduce((sum, skill) => sum + skill.level, 0);
  });

  // ========== 方法 ==========

  /**
   * 增加技能经验
   * @param skillType 技能类型
   * @param exp 经验值
   * @returns 是否升级
   */
  function addExp(skillType: LifeSkillType, exp: number): { levelUp: boolean; newLevel?: number } {
    const skill = skills.value[skillType];
    if (!skill) {
      console.error('[LifeSkillStore] 技能不存在:', skillType);
      return { levelUp: false };
    }

    skill.currentExp += exp;
    skill.totalExp += exp;

    // 检查是否升级
    const requiredExp = getRequiredExp(skill.level);
    if (skill.currentExp >= requiredExp && skill.level < 99) {
      skill.level += 1;
      skill.currentExp -= requiredExp;
      
      console.log(`[LifeSkillStore] 🎉 技能升级! ${skillType} -> Lv.${skill.level}`);
      
      return { levelUp: true, newLevel: skill.level };
    }

    return { levelUp: false };
  }

  /**
   * 设置当前活动技能
   */
  function setActiveSkill(skillType: LifeSkillType | null, resourceId: string | null = null): void {
    activeSkill.value = skillType;
    activeResourceId.value = resourceId;
  }

  /**
   * 重置技能数据（用于测试或重置游戏）
   */
  function resetSkills(): void {
    Object.keys(skills.value).forEach(key => {
      skills.value[key as LifeSkillType] = { level: 1, currentExp: 0, totalExp: 0 };
    });
    activeSkill.value = null;
    activeResourceId.value = null;
    console.log('[LifeSkillStore] 技能数据已重置');
  }

  /**
   * 从存档加载数据
   */
  function loadFromSave(saveData: PlayerSkillData): void {
    Object.assign(skills.value, saveData);
    console.log('[LifeSkillStore] 生活技能数据已加载');
  }

  /**
   * 获取存档数据
   */
  function getSaveData(): PlayerSkillData {
    return { ...skills.value };
  }

  return {
    // 状态
    skills,
    activeSkill,
    activeResourceId,
    
    // 计算属性
    getSkillProgress,
    getSkillLevel,
    totalSkillLevel,
    
    // 方法
    addExp,
    setActiveSkill,
    resetSkills,
    loadFromSave,
    getSaveData
  };
});

