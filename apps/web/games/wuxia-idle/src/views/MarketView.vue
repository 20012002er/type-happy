<template>
  <div class="market-container">
    <div class="market-header">
      <h2>江湖集市</h2>
      <div class="tabs">
        <button :class="{active: tab === 'materials'}" @click="tab = 'materials'">材料</button>
        <button :class="{active: tab === 'equipment'}" @click="tab = 'equipment'">装备</button>
      </div>
    </div>

    <div class="toolbar">
      <div v-if="tab === 'materials'" class="filters">
        <label>品质</label>
        <select v-model="matQualityFilter">
          <option value="all">全部</option>
          <option value="common">普通</option>
          <option value="fine">精良</option>
          <option value="rare">稀有</option>
          <option value="epic">史诗</option>
          <option value="legendary">传说</option>
          <option value="mythic">神话</option>
        </select>
        <label>最小保留量</label>
        <input class="number-input" type="number" min="0" v-model.number="matMinKeep" />
      </div>
      <div v-else class="filters">
        <label>稀有度</label>
        <select v-model="eqRarityFilter">
          <option value="all">全部</option>
          <option value="common">普通</option>
          <option value="uncommon">精良</option>
          <option value="rare">稀有</option>
          <option value="epic">史诗</option>
        </select>
        <label>槽位</label>
        <select v-model="eqSlotFilter">
          <option value="all">全部</option>
          <option value="weapon">武器</option>
          <option value="armor">护甲</option>
          <option value="offhand">副手</option>
          <option value="head">头部</option>
          <option value="belt">腰带</option>
          <option value="gloves">手套</option>
          <option value="boots">靴子</option>
          <option value="accessory1">饰品1</option>
          <option value="accessory2">饰品2</option>
          <option value="ring">戒指</option>
        </select>
      </div>
      <div class="bulk-actions">
        <button @click="selectAll()">全选</button>
        <button @click="clearSelection()" :disabled="selectedCount === 0">取消选择</button>
        <button @click="sellSelected()" :disabled="selectedCount === 0">批量出售</button>
      </div>
    </div>

    <div class="buyback" v-if="buybacksView.length > 0">
      <div class="buyback-header">
        <div class="title">回购</div>
        <div class="tip">最近售出物品，可在时限内花费原价回购</div>
      </div>
      <div class="buyback-list">
        <div class="bb-card" v-for="bb in buybacksView" :key="bb.id">
          <div class="bb-name">
            <template v-if="bb.type === 'material'">{{ (bb as any).name || (bb as any).materialId }} x{{ (bb as any).qty }}</template>
            <template v-else>{{ (bb as any).item.name }}</template>
          </div>
          <div class="bb-price">价格：{{ bb.type === 'material' ? (bb as any).totalGold : (bb as any).price }} 金</div>
          <div class="bb-expire">剩余：{{ remainMinutes(bb) }} 分钟</div>
          <button class="bb-action" @click="buyback(bb.id)">回购</button>
        </div>
      </div>
    </div>

    <div v-if="tab === 'materials'" class="materials-section">
      <div v-if="materialsList.length === 0" class="empty">暂无材料</div>
      <template v-else>
        <div v-if="!busySelling" class="grid">
          <div v-for="m in filteredMaterials" :key="m.id" class="card" :class="{ selected: isMatSelected(m.id), shrinking: isMatShrinking(m.id) }" @click="toggleMat(m.id)" :ref="el => el && (matCardRefs[m.id] = el as HTMLElement)">
            <div class="card-head">
              <div class="name">{{ m.name || m.id }}</div>
              <div class="qty">x{{ m.qty }}</div>
            </div>
            <div class="price" v-if="materialPrices[m.id] !== undefined">单价：{{ materialPrices[m.id] }} 金</div>
            <div class="badges">
              <span v-if="(materialMeta[m.id]?.dynamicMultiplier ?? 1) !== 1" class="badge">行情×{{ (materialMeta[m.id]?.dynamicMultiplier ?? 1).toFixed(2) }}</span>
              <span v-if="(materialMeta[m.id]?.blackBonus ?? 1) > 1" class="badge badge-black">黑市+{{ Math.round(((materialMeta[m.id]?.blackBonus ?? 1) - 1) * 100) }}%</span>
            </div>
            <div class="actions">
              <button @click.stop="sellMaterial(m.id, 1)" :disabled="!canSellMaterial(m.id, 1)">卖1</button>
              <button @click.stop="sellMaterial(m.id, 10)" :disabled="!canSellMaterial(m.id, 10)">卖10</button>
              <button @click.stop="sellMaterial(m.id, Math.max(m.qty - matMinKeep, 0))" :disabled="!canSellMaterial(m.id, Math.max(m.qty - matMinKeep, 0))">全部</button>
            </div>
          </div>
        </div>
        <div v-else class="empty">正在处理大量数据…</div>
      </template>
    </div>

    <div v-else class="equipment-section">
      <div v-if="equipmentList.length === 0" class="empty">暂无装备</div>
      <template v-else>
        <div v-if="!busySelling" class="grid">
          <div v-for="it in filteredEquipments" :key="it.id" class="card" :class="{ selected: isEqSelected(it.id), shrinking: isEqShrinking(it.id) }" @click="toggleEq(it.id)" :ref="el => el && (eqCardRefs[it.id] = el as HTMLElement)">
            <div class="card-head">
              <div class="name">{{ it.name }}</div>
              <div class="tag">{{ it.slot || '物品' }}</div>
            </div>
            <div class="price" v-if="equipmentPrices[it.id] !== undefined">价格：{{ equipmentPrices[it.id] }} 金</div>
            <div class="badges">
              <span v-if="(equipmentMeta[it.id]?.dynamicMultiplier ?? 1) !== 1" class="badge">行情×{{ (equipmentMeta[it.id]?.dynamicMultiplier ?? 1).toFixed(2) }}</span>
              <span v-if="(equipmentMeta[it.id]?.blackBonus ?? 1) > 1" class="badge badge-black">黑市+{{ Math.round(((equipmentMeta[it.id]?.blackBonus ?? 1) - 1) * 100) }}%</span>
            </div>
            <div class="actions">
              <button 
                @click.stop="sellEquipment(it.id)"
                :disabled="isEquipped(it) || it.locked || (equipmentPrices[it.id] ?? 0) <= 0"
                :title="isEquipped(it) ? '已装备，无法出售' : (it.locked ? '已锁定，无法出售' : '')"
              >出售</button>
            </div>
          </div>
        </div>
        <div v-else class="empty">正在处理大量数据…</div>
      </template>
    </div>

    <div v-if="confirmVisible" class="confirm-overlay">
      <div class="confirm-dialog">
        <div class="confirm-title">确认出售</div>
        <div class="confirm-body">
          <div v-if="confirmType === 'materials'">将出售 {{ confirmSummary.count }} 种材料，共计 {{ confirmSummary.items.reduce((a,b)=>a+b.qty,0) }} 件，预计获得 {{ confirmSummary.total }} 金（每种至少保留 {{ matMinKeep }} 件）。</div>
          <div v-else>将出售 {{ confirmSummary.count }} 件装备，预计获得 {{ confirmSummary.total }} 金。</div>
        </div>
        <div class="confirm-actions">
          <button @click="confirmVisible = false">取消</button>
          <button @click="confirmProceed">确认出售</button>
        </div>
      </div>
    </div>

    <div v-if="busySelling" class="processing-overlay">
      <div class="processing-dialog">
        <div class="spinner"></div>
        <div class="txt">正在批量处理，请稍候…</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue';
import { useMaterialsStore } from '@/stores/materialsStore';
import { useEquipmentStore } from '@/stores/equipmentStore';
import { marketService } from '@/services/marketService';
import type { Item } from '@/types/equipment';
import { useGameLogStore } from '@/stores/gameLogStore';
import { LifeSkillConfigService } from '@/services/config/LifeSkillConfigService';
import { useMarketStore } from '@/stores/marketStore';

const tab = ref<'materials' | 'equipment'>('materials');
const ms = useMaterialsStore();
const es = useEquipmentStore();
const logs = useGameLogStore();

const materialsList = computed(() => ms.list());
const equipmentList = computed(() => es.inventory);

const materialPrices = ref<Record<string, number>>({});
const equipmentPrices = ref<Record<string, number>>({});
const materialMeta = ref<Record<string, { dynamicMultiplier?: number; blackBonus?: number; quality?: string }>>({});
const equipmentMeta = ref<Record<string, { dynamicMultiplier?: number; blackBonus?: number }>>({});
const matMinKeep = ref(0);

const market = useMarketStore();
const buybackTick = ref(0);
let buybackTimer: number | null = null;
const buybacksView = computed(() => {
  // 依赖tick触发重新计算，以便过期项自动消失与剩余时间刷新
  buybackTick.value;
  const v: any = (market.list as any);
  // market.list 是 computedRef，template中可自动解包，但此处我们显式取值
  return v?.value ?? v;
});

// 筛选
const matQualityFilter = ref<'all' | 'common' | 'fine' | 'rare' | 'epic' | 'legendary' | 'mythic'>('all');
const eqRarityFilter = ref<'all' | 'common' | 'uncommon' | 'rare' | 'epic'>('all');
const eqSlotFilter = ref<'all' | 'weapon' | 'armor' | 'offhand' | 'head' | 'belt' | 'gloves' | 'boots' | 'accessory1' | 'accessory2' | 'ring'>('all');

// 选择
const selectedMats = ref<string[]>([]);
const selectedEqs = ref<string[]>([]);
const selectedCount = computed(() => (tab.value === 'materials' ? selectedMats.value.length : selectedEqs.value.length));

const matCardRefs = ref<Record<string, HTMLElement>>({});
const eqCardRefs = ref<Record<string, HTMLElement>>({});

// 缩小动画状态
const shrinkingMats = ref<string[]>([]);
const shrinkingEqs = ref<string[]>([]);
const isMatShrinking = (id: string) => shrinkingMats.value.includes(id);
const isEqShrinking = (id: string) => shrinkingEqs.value.includes(id);
const markMatShrink = (id: string) => { if (!isMatShrinking(id)) shrinkingMats.value.push(id); };
const unmarkMatShrink = (id: string) => { shrinkingMats.value = shrinkingMats.value.filter(x => x !== id); };
const markEqShrink = (id: string) => { if (!isEqShrinking(id)) shrinkingEqs.value.push(id); };
const unmarkEqShrink = (id: string) => { shrinkingEqs.value = shrinkingEqs.value.filter(x => x !== id); };
const waitMs = (ms: number) => new Promise(r => setTimeout(r, ms));

const isMatSelected = (id: string) => selectedMats.value.includes(id);
const isEqSelected = (id: string) => selectedEqs.value.includes(id);
const toggleMat = (id: string) => {
  const idx = selectedMats.value.indexOf(id);
  if (idx >= 0) selectedMats.value.splice(idx, 1); else selectedMats.value.push(id);
};
const toggleEq = (id: string) => {
  const idx = selectedEqs.value.indexOf(id);
  if (idx >= 0) selectedEqs.value.splice(idx, 1); else selectedEqs.value.push(id);
};
const selectAll = () => {
  if (tab.value === 'materials') {
    selectedMats.value = filteredMaterials.value.map(x => x.id);
  } else {
    selectedEqs.value = filteredEquipments.value.map(x => x.id);
  }
};
const clearSelection = () => {
  selectedMats.value = [];
  selectedEqs.value = [];
};

const isEquipped = (it: Item) => es.isEquipped(it);

const refreshPrices = async () => {
  // 材料单价
  const mats = materialsList.value;
  const mp: Record<string, number> = {};
  const mm: Record<string, { dynamicMultiplier?: number; blackBonus?: number; quality?: string }> = {};
  await LifeSkillConfigService.init();
  for (const m of mats) {
    const info = await marketService.getMaterialSellInfo(m.id);
    mp[m.id] = info.sellable ? info.unitPrice : 0;
    const cfg = LifeSkillConfigService.findResourceById(m.id);
    mm[m.id] = { dynamicMultiplier: info.dynamicMultiplier, blackBonus: info.blackBonus, quality: (cfg?.quality as any) };
  }
  materialPrices.value = mp;
  materialMeta.value = mm;

  // 装备价格
  const eqs = equipmentList.value;
  const ep: Record<string, number> = {};
  const em: Record<string, { dynamicMultiplier?: number; blackBonus?: number }> = {};
  for (const it of eqs) {
    const info = await marketService.getEquipmentSellInfo(it);
    ep[it.id] = info.sellable ? info.price : 0;
    em[it.id] = { dynamicMultiplier: info.dynamicMultiplier, blackBonus: info.blackBonus };
  }
  equipmentPrices.value = ep;
  equipmentMeta.value = em;
};

onMounted(() => {
  refreshPrices();
  buybackTimer = window.setInterval(() => {
    buybackTick.value++;
  }, 10000);
});

onUnmounted(() => {
  if (buybackTimer) window.clearInterval(buybackTimer);
});

const canSellMaterial = (id: string, qty: number) => {
  const unit = materialPrices.value[id] ?? 0;
  const stack = materialsList.value.find(x => x.id === id);
  return unit > 0 && qty > 0 && !!stack && stack.qty >= qty;
};

const doSellMaterial = async (id: string, qty: number) => {
  const res = await marketService.sellMaterial(id, qty);
  if (res.ok) {
    logs.addRewardLog(`卖出材料 ${id} x${qty}，获得金币 ${res.gold}`);
    await refreshPrices();
    buybackTick.value++;
  } else {
    logs.addErrorLog(`卖出失败：${res.reason || '未知原因'}`);
  }
};

const doSellEquipment = async (id: string) => {
  const it = equipmentList.value.find(x => x.id === id);
  if (!it) return;
  const res = await marketService.sellEquipment(id);
  if (res.ok) {
    logs.addRewardLog(`卖出装备 ${it.name}，获得金币 ${res.gold}`);
    await refreshPrices();
    buybackTick.value++;
  } else {
    logs.addErrorLog(`卖出失败：${res.reason || '未知原因'}`);
  }
};

// 包装：先缩小动画，再执行真正出售
const sellMaterial = async (id: string, qty: number) => {
  if (qty <= 0) return;
  markMatShrink(id);
  await nextTick();
  await waitMs(220);
  await doSellMaterial(id, qty);
  unmarkMatShrink(id);
};

const sellEquipment = async (id: string) => {
  markEqShrink(id);
  await nextTick();
  await waitMs(220);
  await doSellEquipment(id);
  unmarkEqShrink(id);
};

// 批量出售
const confirmVisible = ref(false);
const confirmType = ref<'materials' | 'equipment' | null>(null);
const confirmSummary = ref<{ count: number; total: number; items: any[] }>({ count: 0, total: 0, items: [] });
const busySelling = ref(false);
const BULK_SHRINK_THRESHOLD = 80;
const REFRESH_SOFT_LIMIT = 120;

const sellSelected = async () => {
  if (tab.value === 'materials') {
    const items: any[] = [];
    let total = 0;
    for (const id of selectedMats.value) {
      const stack = materialsList.value.find(x => x.id === id);
      if (!stack) continue;
      const qty = Math.max(stack.qty - matMinKeep.value, 0);
      if (qty <= 0) continue;
      const info = await marketService.getMaterialSellInfo(id);
      const gold = info.unitPrice * qty;
      total += gold;
      items.push({ id, qty, gold });
    }
    confirmType.value = 'materials';
    confirmSummary.value = { count: items.length, total, items };
    confirmVisible.value = true;
  } else {
    const items: any[] = [];
    let total = 0;
    for (const id of selectedEqs.value) {
      const price = equipmentPrices.value[id] ?? 0;
      if (price > 0) { items.push({ id, price }); total += price; }
    }
    confirmType.value = 'equipment';
    confirmSummary.value = { count: items.length, total, items };
    confirmVisible.value = true;
  }
};

const confirmProceed = async () => {
  if (confirmType.value === 'materials') {
    // 先统一缩小
    for (const rec of confirmSummary.value.items) markMatShrink(rec.id);
    await nextTick();
    await waitMs(220);
    let total = 0;
    for (const rec of confirmSummary.value.items) {
      const res = await marketService.sellMaterial(rec.id, rec.qty);
      if (res.ok && res.gold) total += res.gold;
      unmarkMatShrink(rec.id);
    }
    if (total > 0) logs.addRewardLog(`批量卖出材料，共获得金币 ${total}`);
    await refreshPrices();
  } else if (confirmType.value === 'equipment') {
    const ids: string[] = confirmSummary.value.items.map((x: any) => x.id);
    const doShrink = ids.length > 0 && ids.length <= BULK_SHRINK_THRESHOLD;
    if (doShrink) {
      for (const id of ids) markEqShrink(id);
      await nextTick();
      await waitMs(220);
    }
    busySelling.value = true;
    const res = await marketService.batchSellEquipment(ids, equipmentPrices.value as any);
    busySelling.value = false;
    if (res.ok && res.gold > 0) {
      logs.addRewardLog(`批量卖出装备，共获得金币 ${res.gold}（成功${res.soldIds.length}件${res.errors && Object.keys(res.errors).length ? `，失败${Object.keys(res.errors).length}件` : ''}）`);
    }
    // 大批量：先本地清理价格缓存，延迟再全量刷新，减少主线程阻塞
    if (res.soldIds && res.soldIds.length > 0) {
      for (const id of res.soldIds) {
        delete (equipmentPrices.value as any)[id];
        delete (equipmentMeta.value as any)[id];
      }
    }
    shrinkingEqs.value = [];
    const needImmediateRefresh = !res.soldIds || res.soldIds.length <= REFRESH_SOFT_LIMIT;
    if (needImmediateRefresh) {
      await refreshPrices();
    } else {
      setTimeout(() => { refreshPrices(); }, 400);
    }
  }
  confirmVisible.value = false;
  clearSelection();
  buybackTick.value++;
};

const buyback = async (id: string) => {
  const res = await marketService.buyback(id);
  if (res.ok) {
    logs.addSystemLog('回购成功');
    await refreshPrices();
  } else {
    logs.addErrorLog(`回购失败：${res.reason || '未知原因'}`);
  }
};

const remainMinutes = (bb: any) => Math.max(0, Math.ceil((bb.expireAt - Date.now()) / 60000));

function flyFrom(fromEl: HTMLElement) {
  const target = document.querySelector('.market-header h2') as HTMLElement | null;
  const rect = fromEl.getBoundingClientRect();
  const toRect = target ? target.getBoundingClientRect() : ({ left: window.innerWidth - 40, top: 8, width: 0, height: 0 } as any);
  const startX = rect.left + rect.width / 2;
  const startY = rect.top + rect.height / 2;
  const endX = (toRect as any).left + (toRect as any).width / 2;
  const endY = (toRect as any).top + 8;
  const ctrlX = (startX + endX) / 2;
  const ctrlY = Math.min(startY, endY) - 120;
  const dot = document.createElement('div');
  dot.className = 'fly-dot';
  // 使用内联样式避免 scoped 样式不作用于 body 附加元素
  dot.style.position = 'fixed';
  dot.style.left = '0';
  dot.style.top = '0';
  dot.style.width = '10px';
  dot.style.height = '10px';
  dot.style.borderRadius = '50%';
  dot.style.background = '#111';
  dot.style.pointerEvents = 'none';
  dot.style.transform = 'translate(-100px, -100px)';
  dot.style.opacity = '0.9';
  (dot.style as any).zIndex = '1000';
  document.body.appendChild(dot);
  const start = performance.now();
  const duration = 600;
  const step = (t: number) => {
    const p = Math.min(1, (t - start) / duration);
    const x = (1 - p) * (1 - p) * startX + 2 * (1 - p) * p * ctrlX + p * p * endX;
    const y = (1 - p) * (1 - p) * startY + 2 * (1 - p) * p * ctrlY + p * p * endY;
    dot.style.transform = `translate(${x}px, ${y}px) scale(${1 - 0.7 * p})`;
    dot.style.opacity = String(1 - p);
    if (p < 1) {
      requestAnimationFrame(step);
    } else {
      dot.remove();
    }
  };
  step(start);
}

// 过滤后的列表
const filteredMaterials = computed(() => {
  if (matQualityFilter.value === 'all') return materialsList.value;
  return materialsList.value.filter(m => materialMeta.value[m.id]?.quality === matQualityFilter.value);
});
const filteredEquipments = computed(() => {
  return equipmentList.value.filter(it => {
    const okRarity = eqRarityFilter.value === 'all' || (it.rarity as any) === eqRarityFilter.value;
    const okSlot = eqSlotFilter.value === 'all' || (it.slot as any) === eqSlotFilter.value;
    return okRarity && okSlot;
  });
});
</script>

<style scoped>
.market-container { padding: 12px; display: flex; flex-direction: column; gap: 12px; }
.market-header { display: flex; align-items: center; justify-content: space-between; }
.tabs { display: flex; gap: 8px; }
.tabs button { padding: 6px 10px; border: 1px solid rgba(17,17,17,0.12); border-radius: 8px; background: #fff; cursor: pointer; }
.tabs button.active { background: #111; color: #fff; border-color: #111; }
.toolbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.filters { display: flex; align-items: center; gap: 8px; }
.filters select { padding: 6px 8px; border: 1px solid rgba(17,17,17,0.12); border-radius: 8px; background: #fff; }
.number-input { width: 84px; padding: 6px 8px; border: 1px solid rgba(17,17,17,0.12); border-radius: 8px; background: #fff; }
.bulk-actions { display: flex; gap: 8px; }
.bulk-actions button { padding: 6px 10px; border: 1px solid rgba(17,17,17,0.12); border-radius: 8px; background: #fff; cursor: pointer; }
.bulk-actions button:disabled { opacity: 0.5; cursor: not-allowed; }

.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 8px; }
.card { display: flex; flex-direction: column; gap: 8px; padding: 10px; background: #fff; border: 1px solid rgba(17,17,17,0.08); border-radius: 10px; transform: translateZ(0) scale(1); transition: transform .18s ease, opacity .18s ease; will-change: transform, opacity; }
.card.selected { border-color: #111; box-shadow: 0 0 0 2px #111 inset; }
.card.shrinking { transform: translateZ(0) scale(0.01); opacity: 0; }
.card-head { display: flex; align-items: center; justify-content: space-between; }
.name { font-weight: 600; }
.qty, .tag { font-size: 12px; color: rgba(17,17,17,0.6); }
.price { font-size: 13px; }
.badges { display: flex; gap: 6px; flex-wrap: wrap; }
.badge { font-size: 11px; color: #111; background: rgba(17,17,17,0.06); border-radius: 6px; padding: 2px 6px; }
.badge-black { background: #111; color: #fff; }
.actions { display: flex; gap: 6px; }
.actions button { padding: 6px 10px; border: 1px solid rgba(17,17,17,0.12); border-radius: 8px; background: #fafafa; cursor: pointer; }
.actions button:disabled { opacity: 0.5; cursor: not-allowed; }
.empty { color: rgba(17,17,17,0.6); padding: 16px; }

.buyback { display: flex; flex-direction: column; gap: 8px; padding: 8px; background: #fff; border: 1px solid rgba(17,17,17,0.08); border-radius: 10px; }
.buyback-header { display: flex; align-items: baseline; gap: 8px; }
.buyback-header .title { font-weight: 700; }
.buyback-header .tip { font-size: 12px; color: rgba(17,17,17,0.6); }
.buyback-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 8px; }
.bb-card { display: flex; flex-direction: column; gap: 6px; padding: 8px; border: 1px solid rgba(17,17,17,0.08); border-radius: 8px; }
.bb-name { font-weight: 600; }
.bb-price, .bb-expire { font-size: 12px; color: rgba(17,17,17,0.7); }
.bb-action { align-self: flex-start; padding: 6px 10px; border: 1px solid rgba(17,17,17,0.12); border-radius: 8px; background: #fafafa; cursor: pointer; }

.confirm-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.35); display: flex; align-items: center; justify-content: center; z-index: 999; }
.confirm-dialog { width: 360px; background: #fff; border-radius: 12px; border: 1px solid rgba(17,17,17,0.08); padding: 12px; display: flex; flex-direction: column; gap: 10px; }
.confirm-title { font-weight: 700; }
.confirm-body { font-size: 14px; color: rgba(17,17,17,0.8); }
.confirm-actions { display: flex; justify-content: flex-end; gap: 8px; }
.confirm-actions button { padding: 6px 10px; border: 1px solid rgba(17,17,17,0.12); border-radius: 8px; background: #fff; cursor: pointer; }

.fly-dot { position: fixed; left: 0; top: 0; width: 10px; height: 10px; border-radius: 50%; background: #111; pointer-events: none; transform: translate(-100px, -100px); opacity: 0.9; z-index: 1000; }

/* 全局处理中遮罩 */
.processing-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.35); display: flex; align-items: center; justify-content: center; z-index: 1000; }
.processing-dialog { min-width: 220px; background: #fff; border-radius: 12px; border: 1px solid rgba(17,17,17,0.08); padding: 16px; display: flex; flex-direction: column; align-items: center; gap: 10px; }
.spinner { width: 28px; height: 28px; border: 3px solid rgba(17,17,17,0.15); border-top-color: #111; border-radius: 50%; animation: spin 0.9s linear infinite; }
.processing-dialog .txt { font-size: 14px; color: rgba(17,17,17,0.8); }
@keyframes spin { to { transform: rotate(360deg); } }
</style>
