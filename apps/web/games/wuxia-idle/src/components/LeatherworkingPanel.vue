<template>
  <GatheringSkillLayout
    skill-name="制皮"
    :skill-icon="Scissors"
    :skill-type="LifeSkillType.LEATHERWORKING"
    :skill-progress="skillProgress"
    :all-resources="allResources"
    :available-resources="availableResources"
    :next-unlock="nextUnlockResource"
    :current-resource-id="currentRecipeId"
    :current-progress="progress"
    :show-sidebar="false"
    :show-ingredients="true"
    ingredients-label="所需材料"
    :ingredients-getter="getIngredients"
    :ingredient-name-getter="getIngredientName"
    :ingredient-amount-getter="getIngredientAmount"
    empty-state-text="暂无可制皮的配方"
    gathering-time-label="制皮时间"
    @start-gathering="startCraft"
    @stop-gathering="stopCraft"
  />
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { Scissors } from 'lucide-vue-next';
import { useLifeSkillStore } from '@/stores/lifeSkillStore';
import { useMaterialsStore } from '@/stores/materialsStore';
import { useQueueManager } from '@/services/QueueManagerService';
import { LeatherworkingConfigService } from '@/services/config/LeatherworkingConfigService';
import { leatherworkingService } from '@/services/leatherworkingService';
import { useLeatherworkingQueueStore } from '@/stores/leatherworkingQueueStore';
import GatheringSkillLayout from '@/components/layout/GatheringSkillLayout.vue';
import type { ResourceConfig } from '@/types/lifeSkill';
import { LifeSkillType } from '@/types/lifeSkill';
import { LifeSkillConfigService } from '@/services/config/LifeSkillConfigService';

const lifeSkillStore = useLifeSkillStore();
const materialsStore = useMaterialsStore();
const queue = useLeatherworkingQueueStore();
const { startTask, stopTask } = useQueueManager();

const skillProgress = computed(() => lifeSkillStore.getSkillProgress(LifeSkillType.LEATHERWORKING));
const currentRecipeId = computed(() => queue.current?.recipeId || null);
const progress = computed(() => queue.progress);

const allRecipes = computed(() => LeatherworkingConfigService.getAllRecipes());
const available = computed(() => LeatherworkingConfigService.getAvailableRecipes(skillProgress.value.level));
const nextUnlock = computed(() => LeatherworkingConfigService.getNextUnlockRecipe(skillProgress.value.level));

function mapRecipe(r: any): ResourceConfig {
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    skillType: LifeSkillType.LEATHERWORKING,
    quality: r.quality,
    requiredLevel: r.requiredLevel,
    baseSuccessRate: r.baseSuccessRate,
    gatherTime: r.craftTime,
    experience: r.experience
  } as ResourceConfig;
}

const allResources = computed<ResourceConfig[]>(() => allRecipes.value.map(mapRecipe));
const availableResources = computed<ResourceConfig[]>(() => available.value.map(mapRecipe));
const nextUnlockResource = computed<ResourceConfig | null>(() => nextUnlock.value ? mapRecipe(nextUnlock.value) : null);

function getIngredients(resourceId: string) {
  const r = LeatherworkingConfigService.getRecipeById(resourceId);
  return r?.ingredients || [];
}

function getIngredientName(ingredientId: string): string {
  const name = LifeSkillConfigService.getResourceName(ingredientId);
  if (name && name !== ingredientId) return name;
  const item = materialsStore.getMaterial(ingredientId);
  return item?.name || ingredientId;
}

function getIngredientAmount(ingredientId: string): number {
  return materialsStore.getMaterial(ingredientId)?.quantity || 0;
}

function startCraft(resource: ResourceConfig) {
  const r = LeatherworkingConfigService.getRecipeById(resource.id);
  if (!r) return;
  if (!leatherworkingService.canCraft(r)) return;
  queue.start(r.id, r.name, r.craftTime);
  startTask(queue.createQueueTask());
}

function stopCraft() {
  stopTask();
}
</script>

<style scoped>
</style>
