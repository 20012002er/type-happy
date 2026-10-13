<template>
  <GatheringSkillLayout
    skill-name="狩猎"
    :skill-icon="Target"
    :skill-type="LifeSkillType.HUNTING"
    :skill-progress="skillProgress"
    :all-resources="allResources"
    :available-resources="availableResources"
    :next-unlock="nextUnlock"
    :current-resource-id="currentResourceId"
    :current-progress="gatherProgress"
    empty-state-text="还没有适合狩猎的目标"
    gathering-time-label="狩猎耗时"
    @start-gathering="startGathering"
    @stop-gathering="stopGathering"
  />
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { Target } from 'lucide-vue-next';
import { useLifeSkillStore } from '@/stores/lifeSkillStore';
import { useGatherQueueStore } from '@/stores/gatherQueueStore';
import { useQueueManager } from '@/services/QueueManagerService';
import { LifeSkillConfigService } from '@/services/config/LifeSkillConfigService';
import type { ResourceConfig } from '@/types/lifeSkill';
import { LifeSkillType } from '@/types/lifeSkill';
import GatheringSkillLayout from '@/components/layout/GatheringSkillLayout.vue';

const lifeSkillStore = useLifeSkillStore();
const gatherQueueStore = useGatherQueueStore();
const { startTask } = useQueueManager();

// ========== 计算属性 ==========
const skillProgress = computed(() => lifeSkillStore.getSkillProgress(LifeSkillType.HUNTING));

const gatherProgress = computed(() => gatherQueueStore.gatherProgress);

const currentResourceId = computed(() => gatherQueueStore.currentGathering?.resourceId || null);

const allResources = computed(() => {
  return LifeSkillConfigService.getResourcesBySkill(LifeSkillType.HUNTING);
});

const availableResources = computed(() => {
  return LifeSkillConfigService.getAvailableResources(LifeSkillType.HUNTING, skillProgress.value.level);
});

const nextUnlock = computed(() => {
  return LifeSkillConfigService.getNextUnlockResource(LifeSkillType.HUNTING, skillProgress.value.level);
});

// ========== 方法 ==========
function startGathering(resource: ResourceConfig): void {
  gatherQueueStore.startGathering(resource, LifeSkillType.HUNTING);
  startTask(gatherQueueStore.createQueueTask());
  console.log('[Hunting] 开始自动狩猎:', resource.name);
}

function stopGathering(): void {
  gatherQueueStore.stopGathering();
  console.log('[Hunting] 停止自动狩猎');
}

// ========== 生命周期 ==========
onMounted(() => {
  console.log('[HuntingPanel] 组件已挂载');
});
</script>

