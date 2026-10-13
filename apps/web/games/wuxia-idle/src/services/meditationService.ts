import { useMeditationStore } from '@/stores/meditationStore';
import { usePlayerStore } from '@/stores/playerStore';
import { useGameLogStore } from '@/stores/gameLogStore';
import { getCurrentLevelExp } from '@/config/levelExpConfig';
import { AutoRunner } from '@/services/auto/AutoRunner';
import { MeditationEventService } from '@/services/MeditationEventService';
import { StatusEffectService } from '@/services/StatusEffectService';
import i18n from '@/locales';

class MeditationService {
  private runner: AutoRunner | null = null;

  startAuto() {
    const m = useMeditationStore();
    if (this.runner?.isRunning()) return;
    m.state.isAuto = true;
    m.state.isRunning = true;
    this.runner = new AutoRunner({
      shouldRun: async () => m.state.isAuto,
      onTick: async (ctx) => this.tick(ctx.dtSeconds),
      onStart: () => useGameLogStore().addActionLog('开始自动打坐'),
      onStop: () => useGameLogStore().addActionLog('停止自动打坐'),
      options: { tickMinSeconds: m.state.tickMinSeconds || 3, tickMaxSeconds: m.state.tickMaxSeconds || 8 }
    });
    this.runner.start();
  }

  stopAuto() {
    const m = useMeditationStore();
    if (this.runner) {
      this.runner.stop();
      this.runner = null;
    }
    m.state.isRunning = false;
    m.state.isAuto = false;
  }

  manualOnce() {
    this.tick(1);
  }

  upgradeEfficiency(): { success: boolean; message: string } {
    const m = useMeditationStore();
    const p = usePlayerStore();
    const log = useGameLogStore();
    const nextLevel = m.state.upgradeLevel + 1;
    const cost = this.getUpgradeCost(nextLevel);
    if (p.player.resources.gold < cost) {
      log.addErrorLog('金币不足，无法升级打坐效率');
      return { success: false, message: '金币不足' };
    }
    p.updateResources({ gold: p.player.resources.gold - cost });
    m.state.upgradeLevel = nextLevel;
    log.addRewardLog(`打坐效率提升至 Lv.${m.state.upgradeLevel}`);
    return { success: true, message: '升级成功' };
  }

  private getUpgradeCost(level: number): number {
    // 简单线性成本：50 * level
    return 50 * level;
  }

  /**
   * tick
   * - 每个聚合的时间片（dtSeconds，通常为1秒）结算一次：
   *   1) 计算当秒经验（含小数累积，向下取整发放）
   *   2) 发放经验与升级动画由 playerStore 处理
   *   3) 按当前地点与全局权重，抽取一次“冥想机缘事件”并执行
   *   4) 清理过期状态效果
   */
  tick(dtSeconds: number) {
    const m = useMeditationStore();
    const p = usePlayerStore();
    const log = useGameLogStore();

    if (p.isDead) {
      if (m.state.isAuto) this.stopAuto();
      return;
    }

    // 清理过期效果
    m.clearExpiredEffects();

    // 计算经验增量（含小数累积）
    const eps = m.experiencePerSecond;
    const gainFloat = eps * dtSeconds + m.state.accumulator;
    const gainInt = Math.floor(gainFloat);
    m.state.accumulator = gainFloat - gainInt;

    if (gainInt <= 0) {
      // 仍有概率触发事件（较低频率）
      this.handleRandomEvent();
      return;
    }

    // 正常加经验并由 playerStore 处理升级与动画
    const levelUp = p.gainExperience(gainInt);
    if (gainInt > 0) {
      log.addRewardLog((i18n as any).global.t('game.rewards.experience_gained', { exp: gainInt }));
    }
    if (levelUp) {
      log.addLevelUpLog(`突破成功，升至${levelUp.newLevel}级（攻+${levelUp.attackIncrease}，防+${levelUp.defenseIncrease}，血+${levelUp.hpIncrease}）`);
    }

    // 随机奇遇（表驱动）
    this.handleRandomEvent();
  }

  private async handleRandomEvent() {
    const log = useGameLogStore();
    const p = usePlayerStore();
    const rolled = await MeditationEventService.roll();
    if (!rolled) return;

    const { def, payload } = rolled;
    switch (def.type) {
      case 'exp': {
        const amount = payload?.exp ?? 0;
        if (amount > 0) {
          p.gainExperience(amount);
          log.addRewardLog((i18n as any).global.t('game.meditate.event.bonusExp', { amount }));
        }
        break;
      }
      case 'gold': {
        const gold = payload?.gold ?? 0;
        if (gold > 0) {
          p.updateResources({ gold: p.player.resources.gold + gold });
          log.addRewardLog((i18n as any).global.t('game.meditate.event.bonusGold', { amount: gold }));
        }
        break;
      }
      case 'applyEffect': {
        // 走火入魔等：扣血/扣本级经验 + 应用效果
        const hpLossPercent = payload?.hpLoss ?? 0;
        const expLossPercent = payload?.expLoss ?? 0;
        if (hpLossPercent > 0) {
          const hpLoss = Math.max(1, Math.floor(p.player.stats.maxHp * hpLossPercent));
          p.updateStats({ hp: Math.max(1, p.player.stats.hp - hpLoss) });
        }
        if (expLossPercent > 0) {
          const curLevel = p.player.stats.level;
          const curLevelExp = getCurrentLevelExp(curLevel, p.player.stats.totalExp);
          const expLoss = Math.floor(curLevelExp * expLossPercent);
          const newTotal = p.player.stats.totalExp - expLoss;
          p.updateStats({ totalExp: newTotal, currentExp: getCurrentLevelExp(curLevel, newTotal) });
        }
        if (payload?.effectId) await StatusEffectService.applyEffect(payload.effectId);
        if (payload?.effectIds && payload.effectIds.length) {
          for (const eid of payload.effectIds) {
            await StatusEffectService.applyEffect(eid);
          }
        }
        if (typeof payload?.setCurrentLevelExpTo === 'number') {
          const curLevel = p.player.stats.level;
          const levelStartTotalExp = p.player.stats.totalExp - getCurrentLevelExp(curLevel, p.player.stats.totalExp);
          const newTotal = levelStartTotalExp + Math.max(0, payload.setCurrentLevelExpTo);
          p.updateStats({ totalExp: newTotal, currentExp: getCurrentLevelExp(curLevel, newTotal) });
        }
        // 仅当存在百分比扣减时使用 demonicMinor 模板，否则按事件自带 i18nKey 做提示
        if ((payload?.hpLoss ?? 0) > 0 || (payload?.expLoss ?? 0) > 0) {
          log.addErrorLog((i18n as any).global.t('game.meditate.event.demonicMinor', {
            hpPercent: Math.floor((payload?.hpLoss ?? 0) * 100),
            expPercent: Math.floor((payload?.expLoss ?? 0) * 100),
          }));
        } else if (def.i18nKey) {
          log.addInfoLog((i18n as any).global.t(def.i18nKey));
        } else {
          log.addInfoLog('打坐发生了变化。');
        }
        break;
      }
      case 'rewardTag': {
        log.addRewardLog((i18n as any).global.t('game.meditate.event.easter'));
        break;
      }
    }
  }
}

export const meditationService = new MeditationService();


