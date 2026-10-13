<template>
  <GatheringSkillLayout
    skill-name="锻材"
    :skill-icon="Hammer"
    :skill-type="LifeSkillType.SMITHING"
    :skill-progress="skillProgress"
    :all-resources="allResourcesAsResources"
    :available-resources="availableRecipesAsResources"
    :next-unlock="nextUnlockAsResource"
    :current-resource-id="currentRecipeId"
    :current-progress="smithingProgress"
    :show-sidebar="false"
    :show-ingredients="true"
    ingredients-label="所需材料"
    :ingredients-getter="getRecipeIngredients"
    :ingredient-name-getter="getIngredientName"
    :ingredient-amount-getter="getIngredientAmount"
    empty-state-text="暂无可铸造的材料"
    gathering-time-label="锻造时间"
    @start-gathering="handleStartCrafting"
    @stop-gathering="handleStopCrafting"
  />
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { Hammer } from 'lucide-vue-next';
import { useLifeSkillStore } from '@/stores/lifeSkillStore';
import { useSmithingQueueStore } from '@/stores/smithingQueueStore';
import { useQueueManager } from '@/services/QueueManagerService';
import { SmithingConfigService } from '@/services/config/SmithingConfigService';
import { LifeSkillConfigService } from '@/services/config/LifeSkillConfigService';
import { useMaterialsStore } from '@/stores/materialsStore';
import { smithingService } from '@/services/smithingService';
import GatheringSkillLayout, { type IngredientItem } from '@/components/layout/GatheringSkillLayout.vue';
import type { ResourceConfig } from '@/types/lifeSkill';
import { LifeSkillType } from '@/types/lifeSkill';

// ========== Stores and Services ==========
const lifeSkillStore = useLifeSkillStore();
const smithingQueueStore = useSmithingQueueStore();
const { startTask } = useQueueManager();
const materialsStore = useMaterialsStore();

// 常量：只展示锻材（materials）分类
const MATERIALS_CATEGORY = 'materials' as any;

// ========== 计算属性 ==========
const skillProgress = computed(() => lifeSkillStore.getSkillProgress(LifeSkillType.SMITHING));
const smithingProgress = computed(() => smithingQueueStore.smithingProgress);
const currentRecipeId = computed(() => smithingQueueStore.currentSmithing?.recipeId || null);

// 全部锻材配方
const allRecipes = computed(() => {
  return SmithingConfigService.getRecipesByCategory(MATERIALS_CATEGORY);
});

// 可用锻材配方（按等级过滤）
const availableRecipes = computed(() => {
  return allRecipes.value.filter(r => r.requiredLevel <= skillProgress.value.level);
});

// 下一级解锁的锻材
const nextUnlock = computed(() => {
  return SmithingConfigService.getNextUnlockRecipe(MATERIALS_CATEGORY, skillProgress.value.level);
});

// 适配 GatheringSkillLayout
const allResourcesAsResources = computed((): ResourceConfig[] => allRecipes.value.map(recipeToResource));
const availableRecipesAsResources = computed((): ResourceConfig[] => availableRecipes.value.map(recipeToResource));
const nextUnlockAsResource = computed((): ResourceConfig | null => nextUnlock.value ? recipeToResource(nextUnlock.value) : null);

function recipeToResource(recipe: any): ResourceConfig {
  return {
    id: recipe.id,
    name: recipe.name,
    description: recipe.description,
    skillType: LifeSkillType.SMITHING,
    quality: recipe.quality,
    requiredLevel: recipe.requiredLevel,
    baseSuccessRate: recipe.baseSuccessRate,
    gatherTime: recipe.craftTime,
    experience: recipe.experience
  } as ResourceConfig;
}

// ========== 材料信息 ==========
function getRecipeIngredients(recipeId: string): IngredientItem[] {
  const recipe = SmithingConfigService.getRecipe(recipeId);
  if (!recipe || !recipe.ingredients) return [];
  return recipe.ingredients.map(ing => ({ id: ing.id, quantity: ing.quantity }));
}

function getIngredientName(ingredientId: string): string {
  // 优先从生活技能资源表取名
  const resourceName = LifeSkillConfigService.getResourceName(ingredientId);
  if (resourceName && resourceName !== ingredientId) return resourceName;
  // 其次从锻材（中间材料）中查找
  const recipe = SmithingConfigService.getRecipe(ingredientId);
  if (recipe) return recipe.name;
  return ingredientId;
}

function getIngredientAmount(ingredientId: string): number {
  const material = materialsStore.getMaterial(ingredientId);
  return material?.quantity || 0;
}

// ========== 交互 ==========
function handleStartCrafting(resource: ResourceConfig): void {
  const recipe = SmithingConfigService.getRecipe(resource.id);
  if (!recipe) return;
  if (!smithingService.canCraft(recipe)) return;
  smithingQueueStore.startSmithing(recipe.id, recipe.name, recipe.craftTime);
  startTask(smithingQueueStore.createQueueTask());
}

function handleStopCrafting(): void {
  const { stopTask } = useQueueManager();
  stopTask();
}

onMounted(() => {
  console.log('[MaterialsSmithingPanel] 组件已挂载');
});
</script>

<style scoped>
/* 复用 GatheringSkillLayout 的样式，无需额外样式 */
</style>
