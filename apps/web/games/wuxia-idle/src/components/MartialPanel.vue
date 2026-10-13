<template>
  <div class="martial-panel">
    <div class="panel-header">武学修炼</div>
    <div class="panel-section">
      <div class="field-row">
        <select v-model="selectedArtId" class="simple-select">
          <option disabled value="">选择要学习的秘籍</option>
          <option v-for="art in artOptions" :key="art.id" :value="art.id">
            {{ art.name }}
          </option>
        </select>
        <button class="nav-btn" @click="learnSelected" :disabled="!selectedArtId">学习</button>
      </div>
    </div>

    <div class="panel-section">
      <div class="section-title">已学武学</div>
      <div v-if="learnedArts.length === 0" class="muted">暂无</div>
      <ul v-else class="list">
        <li v-for="id in learnedArts" :key="id">{{ getArtName(id) }}</li>
      </ul>
    </div>

    <div class="panel-section">
      <div class="section-title">已悟招数</div>
      <div v-if="learnedMoves.length === 0" class="muted">暂无</div>
      <ul v-else class="list">
        <li v-for="id in learnedMoves" :key="id">{{ getMoveName(id) }}</li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { usePlayerStore } from '@/stores/playerStore';
import { MartialArtConfigService } from '@/services/config/MartialConfigServices';
import { martialService } from '@/services/martialService';

const playerStore = usePlayerStore();
const selectedArtId = ref<string>('');

const artOptions = ref<{ id: string; name: string }[]>([]);
const moveNameCache = ref<Record<string, string>>({});
const artNameCache = ref<Record<string, string>>({});

const learnedArts = computed(() => playerStore.player.martial?.learnedArtIds || []);
const learnedMoves = computed(() => playerStore.player.martial?.learnedMoveIds || []);

const loadOptions = async () => {
  const file = await MartialArtConfigService.load();
  artOptions.value = Object.values(file.arts).map(a => ({ id: a.id, name: a.name }));
  // 建立艺术名缓存
  artNameCache.value = Object.values(file.arts).reduce((acc, a) => { acc[a.id] = a.name; return acc; }, {} as Record<string,string>);
};

onMounted(() => {
  loadOptions();
});

const learnSelected = async () => {
  if (!selectedArtId.value) return;
  const gained = await martialService.learnArt(playerStore.player, selectedArtId.value);
  if (gained.length > 0) {
    // 简单提示：写入日志由上层决定，这里保持最小职责
  }
};

const getArtName = (id: string) => artNameCache.value[id] || id;

const getMoveName = (id: string) => {
  const cached = moveNameCache.value[id];
  if (cached) return cached;
  // 懒加载名称：避免在UI加载时并发请求全部
  import('@/services/config/MartialConfigServices').then(async m => {
    const mv = await m.MoveConfigService.getMove(id);
    if (mv) moveNameCache.value[id] = mv.name;
  });
  return id;
};
</script>

<style scoped>
.martial-panel { border: 1px solid #000; padding: var(--spacing-sm); }
.panel-header { font-weight: bold; margin-bottom: var(--spacing-sm); }
.panel-section { margin-top: var(--spacing-sm); }
.section-title { font-weight: bold; margin-bottom: var(--spacing-xs); }
.muted { color: var(--color-text-muted); }
.list { list-style: none; padding: 0; margin: 0; }
.list li { padding: var(--spacing-xxs) 0; }
.field-row { display: flex; gap: var(--spacing-xs); }
</style>

