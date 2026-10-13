import { configService, ConfigType } from '@/services/config';
import { usePlayerStore } from '@/stores/playerStore';
import { useGameLogStore } from '@/stores/gameLogStore';
import { useMaterialsStore } from '@/stores/materialsStore';
import { staminaService } from '@/services/staminaService';

export type ConsumableCategory = 'potion' | 'food' | 'cooked_food';
export type ConsumableEffectType = 
  | 'restoreHp' 
  | 'restoreStamina'
  | 'restoreEnergy'   // 🆕 回复内力
  | 'buffAttack'      // 临时增加攻击力
  | 'buffDefense'     // 临时增加防御力
  | 'buffSpeed'       // 临时增加速度
  | 'buffCritRate'    // 临时增加暴击率
  | 'buffExpGain';    // 临时增加经验获取

interface ConsumableEffect { 
  type: ConsumableEffectType; 
  amount: number;
  duration?: number; // buff持续时间（秒），如果有的话
}

interface ConsumableItem { 
  id: string; 
  name: string; 
  description?: string;
  category: ConsumableCategory; 
  cooldownSec?: number; 
  effects: ConsumableEffect[];
  quality?: 'common' | 'fine' | 'rare' | 'epic' | 'legendary';
}

interface ConsumablesFile { version: string; lastUpdated: string; items: Record<string, ConsumableItem> }

class ConsumableServiceImpl {
  private cfg: ConsumablesFile | null = null;
  private lastUseAt: Record<string, number> = {};

  private async ensureLoaded() {
    if (!this.cfg) this.cfg = await configService.loadConfig<ConsumablesFile>(ConfigType.CONSUMABLES);
  }

  /**
   * 获取所有能回复生命值的消耗品列表
   */
  async getHealingConsumables(): Promise<ConsumableItem[]> {
    await this.ensureLoaded();
    const items: ConsumableItem[] = [];
    
    for (const item of Object.values(this.cfg!.items)) {
      // 检查是否有restoreHp效果
      const hasHealingEffect = item.effects.some(eff => eff.type === 'restoreHp');
      if (hasHealingEffect) {
        items.push(item);
      }
    }
    
    return items;
  }

  /**
   * 获取消耗品的回血量
   */
  async getHealAmount(id: string): Promise<number> {
    await this.ensureLoaded();
    const item = this.cfg!.items[id];
    if (!item) return 0;
    
    const healEffect = item.effects.find(eff => eff.type === 'restoreHp');
    return healEffect?.amount || 0;
  }

  /**
   * 获取所有能回体的消耗品
   */
  async getStaminaConsumables(): Promise<ConsumableItem[]> {
    await this.ensureLoaded();
    const items: ConsumableItem[] = [];
    
    for (const id in this.cfg!.items) {
      const item = this.cfg!.items[id];
      const hasStaminaEffect = item.effects.some(e => e.type === 'restoreStamina');
      if (hasStaminaEffect) {
        items.push(item);
      }
    }
    
    return items;
  }

  /**
   * 获取消耗品的回体量
   */
  async getStaminaAmount(id: string): Promise<number> {
    await this.ensureLoaded();
    const item = this.cfg!.items[id];
    if (!item) return 0;
    
    const staminaEffect = item.effects.find(eff => eff.type === 'restoreStamina');
    return staminaEffect?.amount || 0;
  }

  /**
   * 🆕 获取所有回复内力的消耗品
   */
  async getEnergyConsumables(): Promise<ConsumableItem[]> {
    await this.ensureLoaded();
    if (!this.cfg) return [];
    return Object.values(this.cfg.items).filter(item => 
      item.effects.some(eff => eff.type === 'restoreEnergy')
    );
  }

  /**
   * 🆕 获取消耗品的回内力量
   */
  async getEnergyAmount(id: string): Promise<number> {
    await this.ensureLoaded();
    const item = this.cfg!.items[id];
    if (!item) return 0;
    
    const energyEffect = item.effects.find(eff => eff.type === 'restoreEnergy');
    return energyEffect?.amount || 0;
  }

  async useById(id: string, silent = false, options?: { ignoreCooldown?: boolean }) {
    await this.ensureLoaded();
    const item = this.cfg!.items[id];
    if (!item) return { ok: false, reason: 'not_found' } as const;

    // 检查库存
    const materialsStore = useMaterialsStore();
    if (!materialsStore.has(id, 1)) {
      if (!silent) {
        console.warn(`[ConsumableService] 库存不足: ${id}`);
      }
      return { ok: false, reason: 'insufficient' } as const;
    }

    // 冷却检查（战斗自动回血时可忽略）
    const now = Date.now();
    
    if (item.cooldownSec && !options?.ignoreCooldown) {
      const last = this.lastUseAt[id] || 0;
      if (now - last < item.cooldownSec * 1000) {
        if (!silent) {
          console.warn(`[ConsumableService] ${item.name} 冷却中，剩余 ${Math.ceil((item.cooldownSec * 1000 - (now - last)) / 1000)}秒`);
        }
        return { ok: false, reason: 'cooldown' } as const;
      }
    }

    // 消耗库存
    if (!materialsStore.consume(id, 1)) {
      return { ok: false, reason: 'insufficient' } as const;
    }

    const ps = usePlayerStore();
    const logs = useGameLogStore();
    let hpRestored = 0;
    let staminaRestored = 0;
    let energyRestored = 0;

    for (const eff of item.effects) {
      if (eff.type === 'restoreHp') {
        const s = ps.player.stats;
        const before = s.hp;
        const after = Math.min(s.maxHp, s.hp + Math.max(0, eff.amount));
        hpRestored = after - before;
        ps.updateStats({ hp: after });
        if (!silent) {
          logs.addRewardLog(`${item.name} 生效：生命 +${hpRestored}`);
        }
      } else if (eff.type === 'restoreStamina') {
        await staminaService.initGaugesIfNeeded();
        const p: any = ps.player as any;
        const before = p.stamina.current;
        const after = Math.min(p.stamina.max, p.stamina.current + Math.max(0, eff.amount));
        staminaRestored = after - before;
        p.stamina.current = after;
        if (!silent) {
          logs.addRewardLog(`${item.name} 生效：体力 +${staminaRestored}`);
        }
      } else if (eff.type === 'restoreEnergy') {
        // 🆕 回复内力
        const s = ps.player.stats;
        const before = s.energy || 0;
        const maxEnergy = s.maxEnergy || 100;
        const after = Math.min(maxEnergy, before + Math.max(0, eff.amount));
        energyRestored = after - before;
        ps.updateStats({ energy: after });
        if (!silent) {
          logs.addRewardLog(`${item.name} 生效：内力 +${energyRestored}`);
        }
      }
    }

    this.lastUseAt[id] = now;
    return { 
      ok: true, 
      hpRestored, 
      staminaRestored,
      energyRestored,
      itemName: item.name
    } as const;
  }
}

export const ConsumableService = new ConsumableServiceImpl();

