import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { Item, EquippedSet, EquipmentSlot } from '@/types/equipment';
import { usePlayerStore } from '@/stores/playerStore';
import { economyService } from '@/services/economyService';
import { getBlueprint } from '@/services/config/EquipmentBlueprintService';
import { requestImmediateSave } from '@/services/autoSave';
import { SynthesisService } from '@/services/loot/SynthesisService';
import { useGameEventStore } from '@/stores/gameEventStore';

export const useEquipmentStore = defineStore('equipment', () => {
  const inventory = ref<Item[]>([]);
  const equipped = ref<EquippedSet>({});
  const lostRecords = ref<{ id: string; name: string; timestamp: number; note: string; item: Item }[]>([]);

  const addItemById = async (id: string) => {
    // 优先按蓝图生成成品（基础属性→直接作为bonus），暂不生成词缀与强化
    const bp = await getBlueprint(id);
    if (bp) {
      const bonuses: any = {};
      if (typeof bp.base.hp === 'number') bonuses.hp = bp.base.hp;
      if (typeof bp.base.attack === 'number') bonuses.attack = bp.base.attack;
      if (typeof bp.base.defense === 'number') bonuses.defense = bp.base.defense;
      const instanceId = `${bp.id}-${Date.now()}-${Math.floor(Math.random()*1e6)}`;
      const item: Item = {
        id: instanceId,
        blueprintId: bp.id,
        name: bp.name,
        slot: (bp.slot as any),
        bonuses,
        rarity: bp.rarity as any,
        comment: (bp as any).comment
      };
      inventory.value.push(item);
      requestImmediateSave('addItemById');
      return;
    }
    // 兼容：若未来存在成品清单，可在此回退
  };

  const equip = (item: Item) => {
    if (!item.slot) return false;
    const slot = item.slot as EquipmentSlot;
    const player = usePlayerStore();

    // 脱下旧的
    if (equipped.value[slot]) {
      const old = equipped.value[slot]!;
      if (old.bonuses) removeBonuses(player, old.bonuses);
    }

    // 穿戴新的
    // 若已是同一件，则不重复应用
    if (equipped.value[slot]?.id === item.id) {
      return true;
    }
    equipped.value[slot] = item;
    if (item.bonuses) applyBonuses(player, item.bonuses);
    
    // 触发游戏事件：装备物品
    const gameEventStore = useGameEventStore();
    gameEventStore.onEquipItem(item.blueprintId || item.id, slot);
    
    requestImmediateSave('equip');
    return true;
  };

  const unequip = (slot: EquipmentSlot) => {
    const player = usePlayerStore();
    const it = equipped.value[slot];
    if (!it) return false;
    if (it.bonuses) removeBonuses(player, it.bonuses);
    delete equipped.value[slot];
    requestImmediateSave('unequip');
    return true;
  };

  const isEquipped = (item: Item): boolean => {
    if (!item.slot) return false;
    return equipped.value[item.slot]?.id === item.id;
  };

  const setState = (nextInventory: Item[], nextEquipped: EquippedSet) => {
    inventory.value = nextInventory || [];
    equipped.value = nextEquipped || {};
  };

  // 从背包移除指定物品（不处理装备状态与加成撤销，调用方需自查）
  const removeItem = (itemId: string) => {
    const idx = inventory.value.findIndex(i => i.id === itemId);
    if (idx < 0) return null as Item | null;
    const [removed] = inventory.value.splice(idx, 1);
    requestImmediateSave('removeItem');
    return removed;
  };

  // 批量移除：一次性过滤并仅保存一次
  const removeItems = (ids: string[]) => {
    const idSet = new Set(ids);
    if (idSet.size === 0) return [] as Item[];
    const removed: Item[] = [];
    const next: Item[] = [];
    for (const it of inventory.value) {
      if (idSet.has(it.id)) removed.push(it); else next.push(it);
    }
    if (removed.length > 0) {
      inventory.value = next;
      requestImmediateSave('removeItems');
    }
    return removed;
  };

  const lockItem = async (itemId: string, costGold?: number) => {
    const p = usePlayerStore();
    const it = inventory.value.find(i => i.id === itemId);
    if (!it) return { ok: false, reason: 'not_found' } as const;
    if (it.locked) return { ok: true } as const;
    const prices = await economyService.getStandardPrices();
    const price = Number(prices?.prices?.lock_item ?? 5);
    if (p.player.resources.gold < price) return { ok: false, reason: 'not_enough_gold' } as const;
    p.updateResources({ gold: p.player.resources.gold - price });
    it.locked = true;
    requestImmediateSave('lockItem');
    return { ok: true } as const;
  };

  const unlockItem = (itemId: string) => {
    const it = inventory.value.find(i => i.id === itemId);
    if (!it) return false;
    it.locked = false;
    requestImmediateSave('unlockItem');
    return true;
  };

  // 战败掉落：从背包中随机选取未锁定且未装备的一个物品，移除并记录
  const dropRandomCarryItem = (note: string) => {
    const candidates = inventory.value.filter(i => !i.locked && !isEquipped(i));
    if (candidates.length === 0) return null as Item | null;
    const pick = candidates[Math.floor(Math.random() * candidates.length)];
    inventory.value = inventory.value.filter(i => i.id !== pick.id);
    lostRecords.value.unshift({ id: pick.id, name: pick.name, timestamp: Date.now(), note, item: pick });
    requestImmediateSave('dropRandomCarryItem');
    return pick;
  };

  const listLostRecords = () => lostRecords.value;

  const setLostRecords = (records: { id: string; name: string; timestamp: number; note: string; item: Item }[]) => {
    lostRecords.value = Array.isArray(records) ? records : [];
  };

  const redeemLost = async (itemId: string, costGold?: number) => {
    const p = usePlayerStore();
    const idx = lostRecords.value.findIndex(r => r.id === itemId);
    if (idx < 0) return { ok: false, reason: 'not_found' } as const;
    const prices = await economyService.getStandardPrices();
    const price = Number(prices?.prices?.redeem_item ?? 10);
    if (p.player.resources.gold < price) return { ok: false, reason: 'not_enough_gold' } as const;
    p.updateResources({ gold: p.player.resources.gold - price });
    // 赎回：恢复原始物品（含蓝图/加成/词缀等）
    const record = lostRecords.value[idx];
    const restored = { ...record.item } as Item;
    restored.id = `${restored.blueprintId || 'it'}-${Date.now()}-${Math.floor(Math.random()*1e6)}`;
    inventory.value.push(restored as any);
    lostRecords.value.splice(idx, 1);
    requestImmediateSave('redeemLost');
    return { ok: true } as const;
  };

  const canSynthesize = async (a: Item, b: Item) => {
    return await SynthesisService.preview(a, b);
  };

  const synthesize = async (a: Item, b: Item) => {
    const res = await SynthesisService.synthesize(a, b);
    if (res.success) {
      requestImmediateSave('synthesize');
    }
    return res;
  };

  /**
   * 应用装备加成到玩家属性
   * 
   * 支持：
   * - 基础四维加成（力量、敏捷、体质、悟性）
   * - 派生属性加成（HP、攻击、防御、内力等）
   * - 战斗属性加成（命中、闪避、暴击、格挡等）
   * - 武侠特色加成（轻功、内功、内力恢复）
   * 
   * 注意：
   * - HP加成：同时增加maxHp和当前hp
   * - 百分比属性：直接累加（如critChance +0.05）
   * - 所有属性都会应用上下限约束
   */
  const applyBonuses = (player: ReturnType<typeof usePlayerStore>, bonuses: any) => {
    const s = player.player.stats;
    const updates: any = {};
    
    // ========== 基础四维加成 ==========
    if (bonuses.strength) updates.strength = s.strength + bonuses.strength;
    if (bonuses.agility) updates.agility = s.agility + bonuses.agility;
    if (bonuses.vitality) updates.vitality = s.vitality + bonuses.vitality;
    if (bonuses.spirit) updates.spirit = s.spirit + bonuses.spirit;
    
    // ========== 派生属性加成 ==========
    // HP加成：同时增加最大值和当前值
    if (bonuses.hp || bonuses.maxHp) {
      const hpBonus = (bonuses.hp || 0) + (bonuses.maxHp || 0);
      updates.maxHp = s.maxHp + hpBonus;
      updates.hp = s.hp + hpBonus; // 保持当前HP比例
    }
    if (bonuses.attack) updates.attack = s.attack + bonuses.attack;
    if (bonuses.defense) updates.defense = s.defense + bonuses.defense;
    
    // 内力加成
    if (bonuses.energy || bonuses.maxEnergy) {
      const energyBonus = (bonuses.energy || 0) + (bonuses.maxEnergy || 0);
      updates.maxEnergy = s.maxEnergy + energyBonus;
      updates.energy = s.energy + energyBonus;
    }
    
    // ========== 战斗属性加成（百分比） ==========
    if (bonuses.accuracy) updates.accuracy = Math.min(1.40, s.accuracy + bonuses.accuracy);
    if (bonuses.dodgeChance) updates.dodgeChance = Math.min(0.50, s.dodgeChance + bonuses.dodgeChance);
    if (bonuses.critChance) updates.critChance = Math.min(0.35, s.critChance + bonuses.critChance);
    if (bonuses.critMultiplier) updates.critMultiplier = Math.min(2.5, s.critMultiplier + bonuses.critMultiplier);
    if (bonuses.blockChance) updates.blockChance = Math.min(0.30, s.blockChance + bonuses.blockChance);
    if (bonuses.tenacity) updates.tenacity = s.tenacity + bonuses.tenacity;
    if (bonuses.armorPenetration) updates.armorPenetration = s.armorPenetration + bonuses.armorPenetration;
    if (bonuses.speed) updates.speed = s.speed + bonuses.speed;
    
    // ========== 武侠特色加成 ==========
    if (bonuses.qinggongLevel) updates.qinggongLevel = s.qinggongLevel + bonuses.qinggongLevel;
    if (bonuses.neigongLevel) updates.neigongLevel = s.neigongLevel + bonuses.neigongLevel;
    if (bonuses.energyRegen) updates.energyRegen = s.energyRegen + bonuses.energyRegen;
    
    // ========== 其他属性 ==========
    if (bonuses.luck) updates.luck = s.luck + bonuses.luck;
    
    player.updateStats(updates);
  };

  /**
   * 移除装备加成
   * 
   * 与 applyBonuses 对应，减去装备提供的所有加成
   * 
   * 注意：
   * - HP移除：maxHp减少后，当前hp不能超过新的maxHp
   * - 所有属性都有最小值保护（如HP至少1）
   * - 百分比属性不会低于0
   */
  const removeBonuses = (player: ReturnType<typeof usePlayerStore>, bonuses: any) => {
    const s = player.player.stats;
    const updates: any = {};
    
    // ========== 基础四维减成 ==========
    if (bonuses.strength) updates.strength = Math.max(1, s.strength - bonuses.strength);
    if (bonuses.agility) updates.agility = Math.max(1, s.agility - bonuses.agility);
    if (bonuses.vitality) updates.vitality = Math.max(1, s.vitality - bonuses.vitality);
    if (bonuses.spirit) updates.spirit = Math.max(1, s.spirit - bonuses.spirit);
    
    // ========== 派生属性减成 ==========
    // HP减成：maxHp减少，当前hp不超过新的maxHp
    if (bonuses.hp || bonuses.maxHp) {
      const hpBonus = (bonuses.hp || 0) + (bonuses.maxHp || 0);
      const newMaxHp = Math.max(1, s.maxHp - hpBonus);
      updates.maxHp = newMaxHp;
      updates.hp = Math.min(s.hp, newMaxHp);
    }
    if (bonuses.attack) updates.attack = Math.max(1, s.attack - bonuses.attack);
    if (bonuses.defense) updates.defense = Math.max(0, s.defense - bonuses.defense);
    
    // 内力减成
    if (bonuses.energy || bonuses.maxEnergy) {
      const energyBonus = (bonuses.energy || 0) + (bonuses.maxEnergy || 0);
      const newMaxEnergy = Math.max(1, s.maxEnergy - energyBonus);
      updates.maxEnergy = newMaxEnergy;
      updates.energy = Math.min(s.energy, newMaxEnergy);
    }
    
    // ========== 战斗属性减成 ==========
    if (bonuses.accuracy) updates.accuracy = Math.max(0.05, s.accuracy - bonuses.accuracy);
    if (bonuses.dodgeChance) updates.dodgeChance = Math.max(0, s.dodgeChance - bonuses.dodgeChance);
    if (bonuses.critChance) updates.critChance = Math.max(0, s.critChance - bonuses.critChance);
    if (bonuses.critMultiplier) updates.critMultiplier = Math.max(1.0, s.critMultiplier - bonuses.critMultiplier);
    if (bonuses.blockChance) updates.blockChance = Math.max(0, s.blockChance - bonuses.blockChance);
    if (bonuses.tenacity) updates.tenacity = Math.max(0, s.tenacity - bonuses.tenacity);
    if (bonuses.armorPenetration) updates.armorPenetration = Math.max(0, s.armorPenetration - bonuses.armorPenetration);
    if (bonuses.speed) updates.speed = Math.max(0.1, s.speed - bonuses.speed);
    
    // ========== 武侠特色减成 ==========
    if (bonuses.qinggongLevel) updates.qinggongLevel = Math.max(0, s.qinggongLevel - bonuses.qinggongLevel);
    if (bonuses.neigongLevel) updates.neigongLevel = Math.max(0, s.neigongLevel - bonuses.neigongLevel);
    if (bonuses.energyRegen) updates.energyRegen = Math.max(1, s.energyRegen - bonuses.energyRegen);
    
    // ========== 其他属性 ==========
    if (bonuses.luck) updates.luck = Math.max(0, s.luck - bonuses.luck);
    
    player.updateStats(updates);
  };

  return {
    inventory,
    equipped,
    lostRecords,
    addItemById,
    equip,
    unequip,
    isEquipped,
    setState
    , canSynthesize
    , synthesize
    , lockItem
    , unlockItem
    , dropRandomCarryItem
    , listLostRecords
    , redeemLost
    , setLostRecords
    , removeItem
    , removeItems
  };
});


