<template>
  <GatheringSkillLayout
    skill-name="伐木"
    :skill-icon="Axe"
    :skill-type="LifeSkillType.WOODCUTTING"
    :skill-progress="skillProgress"
    :all-resources="allResources"
    :available-resources="availableResources"
    :next-unlock="nextUnlock"
    :current-resource-id="currentResourceId"
    :current-progress="gatherProgress"
    empty-state-text="暂无可采集的木材"
    gathering-time-label="采集时间"
    @start-gathering="startGathering"
    @stop-gathering="stopGathering"
  />
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { Axe } from 'lucide-vue-next';
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
const skillProgress = computed(() => lifeSkillStore.getSkillProgress(LifeSkillType.WOODCUTTING));

const gatherProgress = computed(() => gatherQueueStore.gatherProgress);

const currentResourceId = computed(() => gatherQueueStore.currentGathering?.resourceId || null);

const allResources = computed(() => {
  return LifeSkillConfigService.getResourcesBySkill(LifeSkillType.WOODCUTTING);
});

const availableResources = computed(() => {
  return LifeSkillConfigService.getAvailableResources(LifeSkillType.WOODCUTTING, skillProgress.value.level);
});

const nextUnlock = computed(() => {
  return LifeSkillConfigService.getNextUnlockResource(LifeSkillType.WOODCUTTING, skillProgress.value.level);
});

// ========== 方法 ==========
/**
 * 开始采集
 * 
 * 设计说明：
 * 1. 通过队列管理器启动任务，自动处理任务互斥和AutoRunner启动
 * 2. 无需手动启动AutoRunner（QueueTask.start()会处理）
 * 3. 符合SOLID原则：单一职责，只负责采集相关逻辑
 */
function startGathering(resource: ResourceConfig): void {
  // 1. 开始采集这个资源
  gatherQueueStore.startGathering(resource, LifeSkillType.WOODCUTTING);
  
  // 2. 通过队列管理器启动任务（会自动停止其他任务并启动AutoRunner）
  startTask(gatherQueueStore.createQueueTask());
  
  console.log('[Woodcutting] 开始自动采集:', resource.name);
}

function stopGathering(): void {
  gatherQueueStore.stopGathering();
  console.log('[Woodcutting] 停止自动采集');
}

// ========== 生命周期 ==========
onMounted(() => {
  console.log('[WoodcuttingPanel] 组件已挂载');
  // 队列恢复由QueueRestoreService统一处理，组件无需处理
});
</script>
