import { configService, ConfigType } from '@/services/config';
import { useMaterialsStore } from '@/stores/materialsStore';
import { useEquipmentStore } from '@/stores/equipmentStore';
import { economyService } from '@/services/economyService';
import { LifeSkillConfigService } from '@/services/config/LifeSkillConfigService';
import { getBlueprint } from '@/services/config/EquipmentBlueprintService';
import type { Item } from '@/types/equipment';
import { requestImmediateSave } from '@/services/autoSave';
import { useMarketStore } from '@/stores/marketStore';

export interface SellResult { ok: boolean; gold?: number; reason?: string }
export interface BatchSellResult { ok: boolean; gold: number; soldIds: string[]; errors?: Record<string, string> }

export interface EquipmentSellInfo {
  sellable: boolean;
  price: number;
  reason?: string;
  basePrice?: number;
  dynamicMultiplier?: number; // 行情系数
  blackBonus?: number; // 黑市溢价
}
export interface MaterialSellInfo {
  sellable: boolean;
  unitPrice: number;
  reason?: string;
  baseUnitPrice?: number;
  dynamicMultiplier?: number;
  blackBonus?: number;
}

async function getMarketConfig() {
  const econ = await configService.loadConfig<any>(ConfigType.ECONOMY);
  return econ?.market || { equipment: { baseByRarity: {}, slotMultiplier: {} }, materials: { baseByQuality: {} } };
}

export const marketService = new (class MarketService {
  private static readonly BUYBACK_TTL_SEC = 600; // 10分钟
  private static readonly BUYBACK_LIMIT = 12;
  private hash(s: string): number {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  // 简单动态行情：按时间桶和ID产生[1-v,1+v]的波动
  private dynamicMultiplier(key: string, volatility = 0.15, periodHours = 6): number {
    const bucket = Math.floor(Date.now() / (periodHours * 3600_000));
    const n = (this.hash(`DY:${key}:${bucket}`) % 1000) / 1000; // [0,1)
    return 1 + (n * 2 - 1) * volatility;
  }

  // 黑市溢价：小概率命中（限时），给予固定加价
  private blackMarketBonus(key: string, chance = 0.15, bonus = 0.2, windowHours = 8): number {
    const bucket = Math.floor(Date.now() / (windowHours * 3600_000));
    const hit = (this.hash(`BM:${key}:${bucket}`) % 1000) / 1000 < chance;
    return hit ? 1 + bonus : 1;
  }

  async getEquipmentSellInfo(item: Item): Promise<EquipmentSellInfo> {
    const bp = item.blueprintId ? await getBlueprint(item.blueprintId) : null;
    // 明确禁止时不可售
    if (bp?.sellable === false) return { sellable: false, price: 0, reason: 'not_sellable' };

    // 优先使用配置价
    const priceFromConfig = typeof bp?.sellPrice === 'number' ? Math.max(0, Math.floor(bp!.sellPrice!)) : null;
    if (typeof priceFromConfig === 'number') {
      const key = String(bp?.id || item.blueprintId || item.id);
      const mul = this.dynamicMultiplier(key);
      const bm = this.blackMarketBonus(String(`eq:${bp?.slot || item.slot || 'weapon'}`));
      const final = Math.max(1, Math.floor(priceFromConfig * mul * bm));
      return { sellable: true, price: final, basePrice: priceFromConfig, dynamicMultiplier: mul, blackBonus: bm };
    }

    // 回退默认价
    const market = await getMarketConfig();
    const rarity = (bp?.rarity || item.rarity || 'common') as keyof typeof market.equipment.baseByRarity;
    const slot = (bp?.slot || item.slot || 'weapon') as keyof typeof market.equipment.slotMultiplier;
    const base = Number(market.equipment.baseByRarity[rarity] ?? 1);
    const mul = Number(market.equipment.slotMultiplier[slot] ?? 1);
    const basePrice = Math.max(1, Math.floor(base * mul));
    const dm = this.dynamicMultiplier(String(bp?.id || item.blueprintId || item.id));
    const bm = this.blackMarketBonus(String(`eq:${slot as any}`));
    const price = Math.max(1, Math.floor(basePrice * dm * bm));
    return { sellable: true, price, basePrice, dynamicMultiplier: dm, blackBonus: bm };
  }

  async getMaterialSellInfo(materialId: string): Promise<MaterialSellInfo> {
    await LifeSkillConfigService.init();
    const res = LifeSkillConfigService.findResourceById(materialId);
    if (res && res.sellable === false) return { sellable: false, unitPrice: 0, reason: 'not_sellable' };

    if (res && typeof res.sellPrice === 'number') {
      const dm = this.dynamicMultiplier(String(`mat:${materialId}`));
      const bm = this.blackMarketBonus(String(`mat:${res.quality || 'common'}`));
      const base = Math.max(0, Math.floor(res.sellPrice));
      const unitPrice = Math.max(1, Math.floor(base * dm * bm));
      return { sellable: true, unitPrice, baseUnitPrice: base, dynamicMultiplier: dm, blackBonus: bm };
    }

    const market = await getMarketConfig();
    const quality = (res?.quality || 'common') as keyof typeof market.materials.baseByQuality;
    const base = Number(market.materials.baseByQuality[quality] ?? 1);
    const dm = this.dynamicMultiplier(String(`mat:${materialId}`));
    const bm = this.blackMarketBonus(String(`mat:${quality as any}`));
    const baseUnitPrice = Math.max(1, Math.floor(base));
    const unitPrice = Math.max(1, Math.floor(baseUnitPrice * dm * bm));
    return { sellable: true, unitPrice, baseUnitPrice, dynamicMultiplier: dm, blackBonus: bm };
  }

  async sellEquipment(itemId: string): Promise<SellResult> {
    const eq = useEquipmentStore();
    const item = eq.inventory.find(i => i.id === itemId);
    if (!item) return { ok: false, reason: 'not_found' };
    // 禁止出售已装备物品
    if (eq.isEquipped(item)) return { ok: false, reason: 'equipped' };
    if (item.locked) return { ok: false, reason: 'locked' };

    const info = await this.getEquipmentSellInfo(item);
    if (!info.sellable || info.price <= 0) return { ok: false, reason: info.reason || 'not_sellable' };

    const removed = eq.removeItem(itemId);
    if (!removed) return { ok: false, reason: 'remove_failed' };

    await economyService.addGold('出售装备', info.price);
    // 记录回购
    const mk = useMarketStore();
    mk.addEquipment(item, info.price, MarketService.BUYBACK_TTL_SEC, MarketService.BUYBACK_LIMIT);
    requestImmediateSave('sell_equipment');
    return { ok: true, gold: info.price };
  }

  async sellMaterial(materialId: string, qty: number): Promise<SellResult> {
    const ms = useMaterialsStore();
    qty = Math.max(1, Math.floor(qty));
    if (!ms.has(materialId, qty)) return { ok: false, reason: 'insufficient' };

    const info = await this.getMaterialSellInfo(materialId);
    if (!info.sellable || info.unitPrice <= 0) return { ok: false, reason: info.reason || 'not_sellable' };

    const success = ms.consume(materialId, qty);
    if (!success) return { ok: false, reason: 'consume_failed' };

    const gold = info.unitPrice * qty;
    await economyService.addGold('出售材料', gold);
    // 记录回购
    await LifeSkillConfigService.init();
    const cfg = LifeSkillConfigService.findResourceById(materialId);
    const mk = useMarketStore();
    mk.addMaterial(materialId, cfg?.name, qty, info.unitPrice, MarketService.BUYBACK_TTL_SEC, MarketService.BUYBACK_LIMIT);
    requestImmediateSave('sell_material');
    return { ok: true, gold };
  }

  async buyback(recordId: string): Promise<{ ok: boolean; reason?: string }> {
    const mk = useMarketStore();
    const rec = mk.find(recordId) as any;
    if (!rec) return { ok: false, reason: 'not_found' };
    const now = Date.now();
    if (rec.expireAt <= now) {
      mk.remove(recordId);
      return { ok: false, reason: 'expired' };
    }

    if (rec.type === 'equipment') {
      const price = Math.max(1, Math.floor(rec.price));
      const spend = await economyService.spend({ gold: price }, '回购装备');
      if (!spend.ok) return { ok: false, reason: 'not_enough_gold' };
      const eq = useEquipmentStore();
      const restored = { ...rec.item } as Item;
      restored.id = `${restored.blueprintId || 'it'}-${Date.now()}-${Math.floor(Math.random()*1e6)}`;
      eq.inventory.push(restored);
      requestImmediateSave('buyback_equipment');
      mk.remove(recordId);
      return { ok: true };
    } else if (rec.type === 'material') {
      const price = Math.max(1, Math.floor(rec.totalGold));
      const spend = await economyService.spend({ gold: price }, '回购买料');
      if (!spend.ok) return { ok: false, reason: 'not_enough_gold' };
      const ms = useMaterialsStore();
      ms.add(rec.materialId, rec.qty, rec.name);
      requestImmediateSave('buyback_material');
      mk.remove(recordId);
      return { ok: true };
    }

    return { ok: false, reason: 'unknown_type' };
  }

  async batchSellEquipment(ids: string[], priceMap?: Record<string, number>): Promise<BatchSellResult> {
    const eq = useEquipmentStore();
    const mk = useMarketStore();
    const errors: Record<string, string> = {};
    const candidates: { item: Item; price: number }[] = [];

    for (const id of ids) {
      const it = eq.inventory.find(x => x.id === id);
      if (!it) { errors[id] = 'not_found'; continue; }
      if (eq.isEquipped(it)) { errors[id] = 'equipped'; continue; }
      if (it.locked) { errors[id] = 'locked'; continue; }
      const cached = priceMap?.[id];
      if (typeof cached === 'number' && cached > 0) {
        candidates.push({ item: it, price: Math.floor(cached) });
        continue;
      }
      const info = await this.getEquipmentSellInfo(it);
      if (!info.sellable || info.price <= 0) { errors[id] = info.reason || 'not_sellable'; continue; }
      candidates.push({ item: it, price: info.price });
    }

    if (candidates.length === 0) return { ok: true, gold: 0, soldIds: [], errors };

    const soldIds = candidates.map(x => x.item.id);
    // 批量移除
    eq.removeItems(soldIds);
    // 统一加金币
    const totalGold = candidates.reduce((a, b) => a + b.price, 0);
    await economyService.addGold('批量出售装备', totalGold);
    // 批量写入回购
    mk.addEquipments(candidates, MarketService.BUYBACK_TTL_SEC, MarketService.BUYBACK_LIMIT);
    requestImmediateSave('batch_sell_equipment');
    return { ok: true, gold: totalGold, soldIds, errors };
  }
})();
