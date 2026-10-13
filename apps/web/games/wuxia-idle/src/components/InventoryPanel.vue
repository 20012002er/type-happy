<template>
  <div class="inventory-panel">
    <!-- 导航栏 -->
    <div class="section-nav">
      <button
        v-for="section in sections"
        :key="section.key"
        class="section-tab"
        :class="{ active: activeSection === section.key }"
        @click="activeSection = section.key"
      >
        {{ section.label }}
      </button>
    </div>

    <!-- 货币分类 -->
    <div v-if="activeSection === 'overview'" class="section-content">
      <div class="category-section">
        <div class="category-title">货币</div>
        <div class="item-grid">
          <InfoPopover
            type="stat"
            title="金币"
            stat-title="金币"
            :stat-value="playerStore.player.resources.gold"
            stat-desc="游戏中的通用货币，可用于购买物品、升级装备等"
          >
            <div class="item-slot" @click="openContext('gold', null, $event)" @contextmenu.prevent="openContext('gold', null, $event)">
              <div class="item-name">金币</div>
              <div class="item-quantity">{{ playerStore.player.resources.gold }}</div>
            </div>
          </InfoPopover>
        </div>
      </div>

      <!-- 材料分类 -->
      <div class="category-section">
        <div class="category-title">材料</div>
        <div class="item-grid">
          <InfoPopover
            v-for="material in materialsList"
            :key="material.id"
            type="stat"
            :title="material.name || material.id"
            :stat-title="material.name || material.id"
            :stat-value="material.qty"
            :stat-desc="`材料ID: ${material.id}`"
          >
            <div class="item-slot" @click="openContext('material', material, $event)" @contextmenu.prevent="openContext('material', material, $event)">
              <div class="item-name">{{ material.name || material.id }}</div>
              <div class="item-quantity">{{ material.qty }}</div>
            </div>
          </InfoPopover>
          <div v-if="materialsList.length === 0" class="empty-slot">
            <div class="empty-text">暂无材料</div>
          </div>
        </div>
      </div>

      <!-- 装备分类 -->
      <div class="category-section">
        <div class="category-title">装备</div>
        <div class="item-grid">
          <InfoPopover
            v-for="item in equipmentList"
            :key="item.id"
            type="item"
            :item="item"
          >
            <div
              class="item-slot"
              :class="{ 'equipped': equipmentStore.isEquipped(item) }"
              @click="openContext('equipment', item, $event)" @contextmenu.prevent="openContext('equipment', item, $event)"
            >
              <div class="item-name">{{ item.name }}</div>
              <div v-if="equipmentStore.isEquipped(item)" class="equipped-badge">已装备</div>
            </div>
          </InfoPopover>
          <div v-if="equipmentList.length === 0" class="empty-slot">
            <div class="empty-text">暂无装备</div>
          </div>
        </div>
      </div>
    </div>

    <!-- 赎回 -->
    <div v-else-if="activeSection === 'redeem'" class="section-content">
      <div class="redeem-info">
        <p class="redeem-hint">你可以花费金币赎回丢失的装备</p>
      </div>
      <div v-if="redeemList.length === 0" class="empty">暂无丢失记录</div>
      <ul v-else class="item-list">
        <li v-for="r in redeemList" :key="r.id" class="item-row">
          <span class="item-name">{{ r.name }}</span>
          <span class="item-note">{{ r.note }}</span>
          <button class="btn" @click="onRedeem(r.id)">
            赎回 ({{ redeemCost }}金币)
          </button>
        </li>
      </ul>
    </div>

    <ContextMenu
      v-model:visible="ctxVisible"
      :items="menuItems"
      :position="ctxPos"
      @select="handleAction"
    />
    <DraggableModal
      v-model:visible="detailVisible"
      title="详细信息"
      :width="360"
      :height="260"
      :modal="false"
      :showBackdrop="false"
      :resizable="true"
      @close="selectedItem = null"
    >
      <DetailCard :title="selectedItem?.name || '详情'" :dense="true">
        <template v-if="selectedItem && selectedItem.type === 'equipment'">
          <div>类型：装备 · {{ (selectedItem.data?.slot) || '其他' }}</div>
          <div v-if="selectedItem.data?.rarity">稀有：{{ selectedItem.data.rarity }}</div>
          <div v-if="selectedItem.data?.enhanceLevel">强化：+{{ selectedItem.data.enhanceLevel }}</div>
          <div v-if="selectedItem.data?.affixes?.length">词缀：{{ '《' + selectedItem.data.affixes.join('》《') + '》' }}</div>
          <div v-if="selectedItem.data?.bonuses">
            加成：
            <span v-if="selectedItem.data.bonuses.attack">攻+{{ selectedItem.data.bonuses.attack }} </span>
            <span v-if="selectedItem.data.bonuses.defense">防+{{ selectedItem.data.bonuses.defense }} </span>
            <span v-if="selectedItem.data.bonuses.hp">命+{{ selectedItem.data.bonuses.hp }}</span>
          </div>
          <div v-if="selectedItem.data?.comment">评价：{{ selectedItem.data.comment }}</div>
        </template>
        <template v-else-if="selectedItem && selectedItem.type === 'material'">
          <div>名称：{{ selectedItem.name }}</div>
          <div>数量：{{ selectedItem.data?.qty }}</div>
          <div>编号：{{ selectedItem.data?.id }}</div>
        </template>
        <template v-else-if="selectedItem && selectedItem.type === 'gold'">
          <div>名称：金币</div>
          <div>数量：{{ playerStore.player.resources.gold }}</div>
        </template>
      </DetailCard>
    </DraggableModal>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { usePlayerStore } from '@/stores/playerStore';
import { useEquipmentStore } from '@/stores/equipmentStore';
import { useMaterialsStore } from '@/stores/materialsStore';
import InfoPopover from './InfoPopover.vue';
import ContextMenu from './common/ContextMenu.vue';
import DraggableModal from './DraggableModal.vue';
import DetailCard from './common/DetailCard.vue';
import type { Item } from '@/types/equipment';
import type { MaterialStack } from '@/stores/materialsStore';
import { economyService } from '@/services/economyService';

const playerStore = usePlayerStore();
const equipmentStore = useEquipmentStore();
const materialsStore = useMaterialsStore();

// 区块配置
const sections = [
  { key: 'overview', label: '概览' },
  { key: 'redeem', label: '赎回' },
] as const;

type SectionKey = typeof sections[number]['key'];
const activeSection = ref<SectionKey>('overview');

// 材料列表
const materialsList = computed(() => materialsStore.list());

// 装备列表
const equipmentList = computed(() => equipmentStore.inventory);

// 赎回列表
const redeemList = computed(() => equipmentStore.listLostRecords());

// 赎回费用
const redeemCost = ref<number>(10);
economyService.getStandardPrices().then(p => {
  redeemCost.value = Number(p?.prices?.redeem_item ?? 10);
});

// 赎回操作
const onRedeem = async (id: string) => {
  const res = await equipmentStore.redeemLost(id);
  if (!res.ok) {
    alert(res.reason === 'not_enough_gold' ? '金币不足' : '赎回失败');
  }
};

// 选中的物品
const selectedItem = ref<{ type: string; name: string; data: any } | null>(null);

// 选中物品
const selectItem = (type: string, data: any) => {
  if (type === 'gold') {
    selectedItem.value = { type, name: '金币', data };
  } else if (type === 'material') {
    const material = data as MaterialStack;
    selectedItem.value = { type, name: material.name || material.id, data };
  } else if (type === 'equipment') {
    const item = data as Item;
    selectedItem.value = { type, name: item.name, data };
  }
};

// 当前选中物品的操作列表
const selectedActions = computed(() => {
  if (!selectedItem.value) return [];

  const { type, data } = selectedItem.value;

  if (type === 'gold') {
    return [
      { id: 'info', label: '详细信息' }
    ];
  } else if (type === 'material') {
    return [
      { id: 'discard', label: '丢弃' },
      { id: 'info', label: '详细信息' }
    ];
  } else if (type === 'equipment') {
    const item = data as Item;
    const isEquipped = equipmentStore.isEquipped(item);

    return [
      { id: isEquipped ? 'unequip' : 'equip', label: isEquipped ? '卸下' : '使用' },
      { id: item.locked ? 'unlock' : 'lock', label: item.locked ? '解锁' : '锁定' },
      { id: 'discard', label: '丢弃', danger: true },
      { id: 'info', label: '详细信息', dividerBefore: true }
    ];
  }

  return [];
});

interface MenuItem { id: string; label: string; disabled?: boolean; danger?: boolean; dividerBefore?: boolean; shortcut?: string }
const ctxVisible = ref(false);
const ctxPos = ref<{ x: number; y: number }>({ x: 0, y: 0 });
const menuItems = computed<MenuItem[]>(() => {
  if (!selectedItem.value) return [] as MenuItem[];
  return selectedActions.value.map((a: any) => ({
    id: a.id,
    label: a.label,
    danger: a.id === 'discard',
    dividerBefore: a.id === 'info'
  }));
});

const openContext = (type: string, data: any, e: MouseEvent) => {
  selectItem(type, data);
  let x = (e as MouseEvent).clientX;
  let y = (e as MouseEvent).clientY;
  if ((!x && !y) && (e as any)?.currentTarget) {
    const rect = ((e as any).currentTarget as HTMLElement).getBoundingClientRect();
    x = rect.left + rect.width / 2;
    y = rect.top + rect.height / 2;
  }
  ctxPos.value = { x, y };
  ctxVisible.value = true;
};

// 处理操作
const detailVisible = ref(false);
const handleAction = async (actionId: string) => {
  const sel = selectedItem.value;
  if (!sel) { ctxVisible.value = false; return; }
  const { type, data } = sel;
  if (actionId === 'info') {
    detailVisible.value = true;
    ctxVisible.value = false;
    return;
  }
  if (type === 'equipment') {
    const it = data as Item;
    if (actionId === 'equip') {
      if (!it.slot) { alert('该物品不可装备'); ctxVisible.value = false; return; }
      equipmentStore.equip(it);
    } else if (actionId === 'unequip') {
      if (it.slot) equipmentStore.unequip(it.slot as any);
    } else if (actionId === 'lock') {
      const res = await equipmentStore.lockItem(it.id);
      if (!res.ok) {
        alert(res.reason === 'not_enough_gold' ? '金币不足' : '锁定失败');
      }
    } else if (actionId === 'unlock') {
      equipmentStore.unlockItem(it.id);
    } else if (actionId === 'discard') {
      if ((it as any).locked) { alert('物品已锁定，无法丢弃'); ctxVisible.value = false; return; }
      if (equipmentStore.isEquipped(it)) { alert('请先卸下该装备再丢弃'); ctxVisible.value = false; return; }
      const ok = window.confirm(`确定要丢弃「${it.name}」吗？此操作不可撤销。`);
      if (ok) {
        equipmentStore.removeItem(it.id);
      }
    }
  } else if (type === 'material') {
    const m = data as MaterialStack;
    if (actionId === 'discard') {
      const input = window.prompt(`丢弃数量（拥有 ${m.qty}）`, '1');
      if (input === null) { ctxVisible.value = false; return; }
      const n = parseInt(String(input), 10);
      if (!Number.isFinite(n) || n <= 0) { alert('数量无效'); ctxVisible.value = false; return; }
      if (n > m.qty) { alert('数量超出持有数量'); ctxVisible.value = false; return; }
      const ok = window.confirm(`确定要丢弃「${m.name || m.id}」×${n} 吗？此操作不可撤销。`);
      if (ok) {
        materialsStore.consume(m.id, n);
      }
    }
  } else if (type === 'gold') {
    if (actionId === 'discard') {
      alert('金币不可丢弃');
    }
  }
  selectedItem.value = null;
  ctxVisible.value = false;
};
</script>

<style scoped>
.inventory-panel {
  height: 100%;
  overflow-y: auto;
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

/* 导航栏 */
.section-nav {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.section-tab {
  padding: 8px 16px;
  border-radius: 999px;
  border: 1px solid rgba(17, 17, 17, 0.1);
  background: #fff;
  color: rgba(17, 17, 17, 0.72);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.section-tab.active {
  background: #0f0f0f;
  color: #fff;
  border-color: #0f0f0f;
}

/* 内容区 */
.section-content {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.category-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.category-title {
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.6px;
  color: rgba(17, 17, 17, 0.75);
  border-bottom: 1px solid rgba(17, 17, 17, 0.08);
  padding-bottom: 6px;
}

.item-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(68px, 1fr));
  gap: 8px;
}

.item-grid :deep(.popover-anchor) {
  text-decoration: none;
  cursor: pointer;
}

.item-slot {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 10px 6px;
  border-radius: 12px;
  border: 1px solid rgba(17, 17, 17, 0.12);
  background: #fff;
  min-height: 70px;
  cursor: pointer;
  transition: all 0.15s ease;
  position: relative;
}

.item-slot:hover {
  border-color: rgba(17, 17, 17, 0.35);
  background: rgba(17, 17, 17, 0.05);
  transform: translateY(-1px);
}

.item-name {
  font-size: 11.5px;
  text-align: center;
  color: rgba(17, 17, 17, 0.78);
  line-height: 1.3;
  word-break: break-word;
}

.item-quantity {
  font-size: 11px;
  font-weight: 600;
  color: rgba(17, 17, 17, 0.45);
}

.empty-slot {
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px dashed rgba(17, 17, 17, 0.12);
  border-radius: 12px;
  min-height: 70px;
  background: rgba(255, 255, 255, 0.6);
}

.empty-text {
  font-size: 11px;
  color: rgba(17, 17, 17, 0.4);
}

.equipped {
  border-color: rgba(17, 17, 17, 0.65);
  background: rgba(17, 17, 17, 0.08);
}

.equipped-badge {
  position: absolute;
  top: 6px;
  right: 8px;
  font-size: 10px;
  font-weight: 600;
  color: rgba(17, 17, 17, 0.7);
}

/* 赎回区域 */
.redeem-info {
  padding: 12px;
  background: rgba(17, 17, 17, 0.03);
  border-radius: 10px;
}

.redeem-hint {
  margin: 0;
  font-size: 12px;
  color: rgba(17, 17, 17, 0.6);
}

.item-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.item-row {
  display: flex;
  gap: 8px;
  align-items: center;
  font-size: 12px;
  padding: 10px;
  border: 1px solid rgba(17, 17, 17, 0.08);
  border-radius: 10px;
  background: #fff;
  flex-wrap: wrap;
}

.item-row:hover {
  background: rgba(17, 17, 17, 0.03);
  border-color: rgba(17, 17, 17, 0.15);
}

.item-note {
  color: rgba(17, 17, 17, 0.5);
  font-size: 11px;
  flex: 1;
}

.btn {
  padding: 6px 12px;
  border-radius: 6px;
  border: 1px solid rgba(17, 17, 17, 0.12);
  background: #fff;
  color: #111;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn:hover {
  background: rgba(17, 17, 17, 0.05);
  border-color: rgba(17, 17, 17, 0.25);
}

.empty {
  color: rgba(17, 17, 17, 0.4);
  font-size: 13px;
  text-align: center;
  padding: 24px;
}

.inventory-panel::-webkit-scrollbar {
  width: 6px;
}

.inventory-panel::-webkit-scrollbar-track {
  background: rgba(17, 17, 17, 0.05);
}

.inventory-panel::-webkit-scrollbar-thumb {
  background: rgba(17, 17, 17, 0.2);
  border-radius: 999px;
}

.inventory-panel::-webkit-scrollbar-thumb:hover {
  background: rgba(17, 17, 17, 0.35);
}
</style>
