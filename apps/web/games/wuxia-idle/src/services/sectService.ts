/**
 * 门派业务服务
 * 提供门派相关的业务逻辑封装
 */

import { useSectStore } from '@/stores/sectStore';
import { sectConfigService } from '@/services/config/SectConfigService';
import { sectMartialConfigService } from '@/services/config/SectMartialConfigService';
import { economyService } from '@/services/economyService';
import type { SectType, SectConfig } from '@/types/sect';
import type { SectMartial } from '@/types/sectMartial';
import { usePlayerStore } from '@/stores/playerStore';

class SectService {
  /**
   * 获取门派配置
   */
  getSectConfig(sectType: SectType): SectConfig | null {
    return sectConfigService.getSectConfig(sectType);
  }

  /**
   * 获取所有门派配置
   */
  getAllSectConfigs(): SectConfig[] {
    return sectConfigService.getAllSects();
  }

  /**
   * 获取玩家当前门派加成
   */
  getPlayerBonus() {
    const sectStore = useSectStore();
    const currentSect = sectStore.currentSect;

    if (!currentSect) {
      return null;
    }

    return {
      sectType: sectStore.sectType,
      sectName: currentSect.name,
      sectLevel: sectStore.sectLevel,
      baseBonus: currentSect.baseBonus,
      lifeSkillBonus: currentSect.lifeSkillBonus,
      reputation: sectStore.sectReputation,
      contribution: sectStore.sectContribution,
    };
  }

  /**
   * 计算战斗伤害克制加成
   */
  getCounterBonus(attackerSect: SectType, targetSect: SectType): number {
    return sectConfigService.getDamageBonus(attackerSect, targetSect);
  }

  /**
   * 检查是否可以转投
   */
  canTransfer(): boolean {
    const sectStore = useSectStore();
    return sectStore.canTransfer;
  }

  /**
   * 获取转投冷却剩余天数
   */
  getTransferRemainingDays(): number {
    const sectStore = useSectStore();
    return sectStore.transferRemainingDays;
  }

  /**
   * 转投门派
   */
  async transferSect(
    newSect: SectType,
    useGold: boolean = true
  ): Promise<{ success: boolean; message: string }> {
    const sectStore = useSectStore();

    if (sectStore.sectType === newSect) {
      return { success: false, message: '请选择新的门派。' };
    }

    // 检查是否可以转投
    if (!sectStore.canTransfer) {
      console.warn('[SectService] 转投冷却中');
      return { success: false, message: '转投冷却尚未结束。' };
    }

    // 检查金币是否足够
    if (useGold) {
      const playerStore = usePlayerStore();
      const goldCost = sectConfigService.getTransferGoldCost();
      if (playerStore.player.resources.gold < goldCost) {
        console.warn(`[SectService] 金币不足，需要 ${goldCost} 金币`);
        return { success: false, message: `银两不足，需要 ${goldCost} 银两。` };
      }

      // 扣除金币
      await economyService.addGold('sect_transfer', -goldCost);
    }

    // 执行转投
    const success = sectStore.transferSect(newSect);
    return {
      success,
      message: success ? '转投完成，旧门派进度已清空。' : '转投失败。',
    };
  }

  /**
   * 获取门派名称
   */
  getSectName(sectType: SectType): string {
    const config = sectConfigService.getSectConfig(sectType);
    return config?.name ?? sectType;
  }

  async getCurrentSectMartials(): Promise<SectMartial[]> {
    const sectStore = useSectStore();
    if (!sectStore.sectType) return [];

    await sectMartialConfigService.load();
    return sectMartialConfigService.getMartialsBySect(sectStore.sectType);
  }

  async canUnlockMartial(martialId: string): Promise<{ canUnlock: boolean; reasons: string[] }> {
    const sectStore = useSectStore();
    if (!sectStore.sectType) {
      return { canUnlock: false, reasons: ['尚未加入门派'] };
    }

    await sectMartialConfigService.load();
    const martial = sectMartialConfigService.getMartialById(martialId);
    if (!martial) {
      return { canUnlock: false, reasons: ['未找到该门派武学'] };
    }

    return sectMartialConfigService.evaluateUnlock(martial, {
      currentSect: sectStore.sectType,
      reputation: sectStore.sectReputation,
      contribution: sectStore.sectContribution,
      sectLevel: sectStore.sectLevel,
      unlockedMartials: sectStore.unlockedSkills,
    });
  }

  async unlockMartial(
    martialId: string
  ): Promise<{ success: boolean; message: string; martial?: SectMartial }> {
    const sectStore = useSectStore();
    if (!sectStore.sectType) {
      return { success: false, message: '请先加入门派。' };
    }

    await sectMartialConfigService.load();
    const martial = sectMartialConfigService.getMartialById(martialId);
    if (!martial) {
      return { success: false, message: '未找到对应武学。' };
    }

    if (sectStore.unlockedSkills.includes(martialId)) {
      return { success: false, message: '该武学已经解锁。', martial };
    }

    const evaluation = await this.canUnlockMartial(martialId);
    if (!evaluation.canUnlock) {
      return { success: false, message: evaluation.reasons[0] || '条件未满足。', martial };
    }

    sectStore.unlockMartial(martialId, sectStore.sectType);
    return { success: true, message: `已解锁 ${martial.name}。`, martial };
  }
}

export const sectService = new SectService();
