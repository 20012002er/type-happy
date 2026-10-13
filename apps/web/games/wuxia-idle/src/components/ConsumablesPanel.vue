<template>
  <div class="consumables-panel">
    <div class="header">消耗品</div>
    <div class="list" v-if="items.length > 0">
      <div class="row" v-for="it in items" :key="it.id">
        <div class="name">{{ it.name }}（{{ it.category === 'potion' ? '药' : '料理' }}）</div>
        <div class="desc">冷却：{{ it.cooldownSec || 0 }}s</div>
        <button class="btn" @click="use(it.id)">使用</button>
      </div>
    </div>
    <div v-else class="empty">（暂无可用消耗品；可通过调试面板发放或未来背包获得）</div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { configService, ConfigType } from '@/services/config';
import { ConsumableService } from '@/services/consumableService';

interface ConsumableItem { id: string; name: string; category: string; cooldownSec?: number; effects: any[] }

const items = ref<ConsumableItem[]>([]);

onMounted(async () => {
  const cfg = await configService.loadConfig<any>(ConfigType.CONSUMABLES);
  items.value = Object.values(cfg.items || {});
});

const use = async (id: string) => {
  await ConsumableService.useById(id);
};
</script>

<style scoped>
.consumables-panel { border: 1px solid #000; padding: var(--spacing-md); background: #fff; }
.header { font-size: var(--font-size-sm); color: #000; border-bottom: 1px solid #000; margin-bottom: var(--spacing-xs); padding-bottom: var(--spacing-xxs); }
.list { display: flex; flex-direction: column; gap: var(--spacing-xs); }
.row { display: flex; align-items: center; justify-content: space-between; gap: var(--spacing-sm); font-size: var(--font-size-sm); color: #000; }
.name { font-weight: bold; }
.btn { background: #fff; border: 1px solid #000; padding: var(--spacing-xxs) var(--spacing-xs); cursor: pointer; color: #000; }
.empty { color: #000; font-size: var(--font-size-xs); }
</style>


