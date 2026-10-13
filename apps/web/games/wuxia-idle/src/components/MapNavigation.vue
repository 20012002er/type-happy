<template>
  <div class="map-nav">
    <div class="map-header">当前位置</div>
    <div v-if="current" class="current-loc">
      <div class="loc-name">{{ current.name }}</div>
      <div class="loc-desc">{{ current.description }}</div>
    </div>
    <div class="map-header">可前往</div>
    <div v-if="dests.length === 0" class="empty">暂无可前往地点</div>
    <ul class="dest-list">
      <li v-for="loc in dests" :key="loc.id">
        <button class="dest-btn" @click="go(loc.id)">→ {{ loc.name }}</button>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useMapStore } from '@/stores/mapStore';
import { useGameLogStore } from '@/stores/gameLogStore';

const mapStore = useMapStore();
const gameLog = useGameLogStore();

const current = computed(() => mapStore.currentLocation);
const dests = computed(() => mapStore.availableDestinations);

const go = (id: string) => {
  const res = mapStore.travelTo(id);
  if (res.success) {
    gameLog.addActionLog(res.message);
    if (res.eventMessage) gameLog.addInfoLog(res.eventMessage);
  } else {
    gameLog.addErrorLog(res.message);
  }
};

onMounted(async () => {
  if (!mapStore.isReady) {
    await mapStore.initializeMap();
  }
});
</script>

<style scoped>
.map-nav {
  border: 1px solid #000;
  padding: var(--spacing-md);
  background: #fff;
}
.map-header {
  font-size: var(--font-size-sm);
  color: #000;
  border-bottom: 1px solid #000;
  margin: 0 0 var(--spacing-xs) 0;
  padding-bottom: var(--spacing-xs);
}
.current-loc {
  margin-bottom: var(--spacing-md);
}
.loc-name {
  font-weight: bold;
  margin-bottom: var(--spacing-xs);
}
.loc-desc {
  font-size: var(--font-size-sm);
  color: #000;
}
.empty {
  color: #000;
  font-size: var(--font-size-xs);
}
.dest-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}
.dest-btn {
  background: #fff;
  border: 1px solid #000;
  padding: var(--spacing-xs);
  cursor: pointer;
  width: 100%;
  text-align: left;
}
.dest-btn:hover { background: #fff; }
</style>


