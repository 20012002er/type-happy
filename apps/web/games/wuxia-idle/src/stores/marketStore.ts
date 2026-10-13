import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { Item } from '@/types/equipment';

export type BuybackMaterial = {
  id: string;
  type: 'material';
  materialId: string;
  name?: string;
  qty: number;
  unitPrice: number;
  totalGold: number;
  soldAt: number;
  expireAt: number;
};

export type BuybackEquipment = {
  id: string;
  type: 'equipment';
  item: Item;
  price: number;
  soldAt: number;
  expireAt: number;
};

export type BuybackRecord = BuybackMaterial | BuybackEquipment;

export const useMarketStore = defineStore('market', () => {
  const STORAGE_KEY = 'market-buybacks-v1';
  const buybacks = ref<BuybackRecord[]>([]);

  const now = () => Date.now();
  const prune = () => {
    const t = now();
    buybacks.value = buybacks.value.filter(r => r.expireAt > t);
  };

  const load = () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const arr = JSON.parse(raw) as BuybackRecord[];
        if (Array.isArray(arr)) buybacks.value = arr as any;
      }
      prune();
    } catch (e) {
      console.warn('[MarketStore] Failed to load buybacks:', e);
    }
  };
  const save = () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(buybacks.value));
    } catch (e) {
      console.warn('[MarketStore] Failed to save buybacks:', e);
    }
  };

  const list = computed(() => {
    prune();
    return buybacks.value.slice();
  });

  const addMaterial = (materialId: string, name: string | undefined, qty: number, unitPrice: number, ttlSec: number, limit: number) => {
    if (qty <= 0 || unitPrice <= 0) return;
    const id = `bbm-${Date.now()}-${Math.floor(Math.random()*1e6)}`;
    const rec: BuybackMaterial = {
      id,
      type: 'material',
      materialId,
      name,
      qty,
      unitPrice: Math.floor(unitPrice),
      totalGold: Math.floor(unitPrice) * qty,
      soldAt: now(),
      expireAt: now() + Math.max(1, ttlSec) * 1000
    };
    buybacks.value.unshift(rec);
    if (buybacks.value.length > Math.max(1, limit)) buybacks.value = buybacks.value.slice(0, limit);
    save();
  };

  const addEquipment = (item: Item, price: number, ttlSec: number, limit: number) => {
    if (!item || price <= 0) return;
    const id = `bbe-${Date.now()}-${Math.floor(Math.random()*1e6)}`;
    const rec: BuybackEquipment = {
      id,
      type: 'equipment',
      item: JSON.parse(JSON.stringify(item)),
      price: Math.floor(price),
      soldAt: now(),
      expireAt: now() + Math.max(1, ttlSec) * 1000
    };
    buybacks.value.unshift(rec);
    if (buybacks.value.length > Math.max(1, limit)) buybacks.value = buybacks.value.slice(0, limit);
    save();
  };

  const addEquipments = (items: { item: Item; price: number }[], ttlSec: number, limit: number) => {
    if (!Array.isArray(items) || items.length === 0) return;
    const t = now();
    const recs: BuybackEquipment[] = items
      .filter(x => x.item && x.price > 0)
      .map(x => ({
        id: `bbe-${t}-${Math.floor(Math.random()*1e6)}-${x.item.id}`,
        type: 'equipment',
        item: JSON.parse(JSON.stringify(x.item)),
        price: Math.floor(x.price),
        soldAt: t,
        expireAt: t + Math.max(1, ttlSec) * 1000
      }));
    if (recs.length === 0) return;
    buybacks.value = [...recs, ...buybacks.value];
    if (buybacks.value.length > Math.max(1, limit)) buybacks.value = buybacks.value.slice(0, limit);
    save();
  };

  const remove = (id: string) => {
    buybacks.value = buybacks.value.filter(r => r.id !== id);
    save();
  };

  const find = (id: string) => buybacks.value.find(r => r.id === id);

  load();

  return {
    buybacks,
    list,
    addMaterial,
    addEquipment,
    addEquipments,
    remove,
    find
  };
});
