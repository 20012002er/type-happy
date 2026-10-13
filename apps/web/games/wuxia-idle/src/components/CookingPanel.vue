<template>
  <GatheringSkillLayout
    skill-name="烹饪"
    :skill-icon="ChefHat"
    :skill-type="LifeSkillType.COOKING"
    :skill-progress="skillProgress"
    :all-resources="recipeResources"
    :available-resources="availableRecipeResources"
    :next-unlock="nextRecipeResource"
    :current-resource-id="currentRecipeId"
    :current-progress="cookingProgress"
    :show-ingredients="true"
    ingredients-label="所需食材"
    :ingredients-getter="getIngredients"
    :ingredient-name-getter="getIngredientName"
    :ingredient-amount-getter="getIngredientAmount"
    :resource-state-getter="resourceStateGetter"
    empty-state-text="暂无可烹饪的配方"
    gathering-time-label="烹饪时间"
    @start-gathering="startCooking"
    @stop-gathering="stopCooking"
  />
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { ChefHat } from 'lucide-vue-next';
import { useLifeSkillStore } from '@/stores/lifeSkillStore';
import { useCookingQueueStore } from '@/stores/cookingQueueStore';
import { useMaterialsStore } from '@/stores/materialsStore';
import { useQueueManager } from '@/services/QueueManagerService';
import { CookingRecipeConfigService } from '@/services/config/CookingRecipeConfigService';
import { LifeSkillConfigService } from '@/services/config/LifeSkillConfigService';
import { cookingService } from '@/services/cookingService';
import { autoCookingService } from '@/services/autoCookingService';
import GatheringSkillLayout from '@/components/layout/GatheringSkillLayout.vue';
import type { CookingRecipe } from '@/types/cooking';
import { LifeSkillType, type ResourceConfig } from '@/types/lifeSkill';

const lifeSkillStore = useLifeSkillStore();
const cookingQueueStore = useCookingQueueStore();
const materialsStore = useMaterialsStore();
const queueManager = useQueueManager();

interface CookingResource extends ResourceConfig {
  recipe: CookingRecipe;
}

const skillProgress = computed(() => lifeSkillStore.getSkillProgress(LifeSkillType.COOKING));
const cookingProgress = computed(() => cookingQueueStore.cookingProgress);
const currentRecipeId = computed(() => cookingQueueStore.currentCooking?.recipeId || null);

const allRecipes = computed(() => CookingRecipeConfigService.getAllRecipes());
const nextUnlock = computed(() => CookingRecipeConfigService.getNextUnlockRecipe(skillProgress.value.level));

const recipeResources = computed<CookingResource[]>(() =>
  allRecipes.value.map((recipe) => ({
    id: recipe.id,
    name: recipe.name,
    description: recipe.description,
    skillType: LifeSkillType.COOKING,
    quality: recipe.quality,
    requiredLevel: recipe.cookingLevel,
    baseSuccessRate: recipe.successRate,
    gatherTime: recipe.cookingTime,
    experience: recipe.experience,
    recipe
  }))
);

const availableRecipeResources = computed(() =>
  recipeResources.value.filter(resource => resource.recipe.cookingLevel <= skillProgress.value.level)
);

const recipeResourceMap = computed(() => {
  const map = new Map<string, CookingResource>();
  recipeResources.value.forEach(resource => map.set(resource.id, resource));
  return map;
});

const nextRecipeResource = computed(() => {
  const next = nextUnlock.value;
  if (!next) return null;
  const mapped = recipeResourceMap.value.get(next.id);
  if (mapped) return mapped;
  return {
    id: next.id,
    name: next.name,
    description: next.description,
    skillType: LifeSkillType.COOKING,
    quality: next.quality,
    requiredLevel: next.cookingLevel,
    baseSuccessRate: next.successRate,
    gatherTime: next.cookingTime,
    experience: next.experience,
    recipe: next
  } as CookingResource;
});

function canCook(recipe: CookingRecipe): boolean {
  if (recipe.cookingLevel > skillProgress.value.level) {
    return false;
  }
  return cookingService.canCook(recipe);
}

function isCurrentCooking(recipeId: string): boolean {
  return currentRecipeId.value === recipeId;
}

function startCooking(resource: ResourceConfig): void {
  const mapped = recipeResourceMap.value.get(resource.id);
  if (!mapped) return;
  const recipe = mapped.recipe;
  if (!canCook(recipe)) {
    return;
  }
  if (isCurrentCooking(recipe.id)) {
    return;
  }
  cookingQueueStore.startCooking(recipe.id, recipe.name, recipe.cookingTime);
  queueManager.startTask(cookingQueueStore.createQueueTask());
}

function stopCooking(): void {
  queueManager.stopTask();
}

function getIngredients(resourceId: string) {
  const mapped = recipeResourceMap.value.get(resourceId);
  return mapped ? mapped.recipe.ingredients : [];
}

function getIngredientName(ingredientId: string): string {
  const material = materialsStore.getMaterial(ingredientId);
  if (material?.name) {
    return material.name;
  }
  return LifeSkillConfigService.getResourceName(ingredientId);
}

function getIngredientAmount(ingredientId: string): number {
  const material = materialsStore.getMaterial(ingredientId);
  return material?.quantity || 0;
}

const resourceStateGetter = (resource: ResourceConfig) => {
  const mapped = recipeResourceMap.value.get(resource.id);
  if (!mapped) {
    return { canStart: false, reason: '未知配方' };
  }
  const recipe = mapped.recipe;
  if (!canCook(recipe)) {
    return { canStart: false, reason: '材料不足' };
  }
  return { canStart: true };
};

onMounted(() => {
  if (cookingQueueStore.isCooking && cookingQueueStore.currentCooking) {
    if (!autoCookingService.isRunning()) {
      autoCookingService.start();
    }
  }
});
</script>

<style scoped>
.cooking-panel {
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;
}

/* 技能信息头部 - 复用采集布局样式 */
.skill-header {
  margin-bottom: var(--spacing-lg);
  padding: var(--spacing-md);
  background: var(--color-bg-secondary);
  border: var(--border-width-thin) solid var(--color-border-medium);
}

.skill-header h2 {
  margin: 0 0 var(--spacing-md) 0;
  font-size: var(--font-size-2xl);
  color: var(--color-text-primary);
  font-weight: bold;
  border-bottom: var(--border-width-medium) solid var(--color-border-dark);
  padding-bottom: var(--spacing-sm);
}

.skill-info {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
}

.skill-level {
  min-width: 120px;
}

.skill-level .label {
  color: var(--color-text-secondary);
  margin-right: var(--spacing-sm);
}

.skill-level .value {
  font-size: var(--font-size-xl);
  font-weight: bold;
  color: var(--color-text-primary);
}

.skill-exp {
  flex: 1;
}

.exp-bar-container {
  position: relative;
  height: 30px;
  background: var(--color-bg-primary);
  border: var(--border-width-thin) solid var(--color-border-medium);
  overflow: hidden;
}

.exp-bar {
  position: absolute;
  left: 0;
  top: 0;
  height: 100%;
  background: var(--color-black);
  transition: width 0.3s ease;
}

.exp-text {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  color: var(--color-text-primary);
  font-size: var(--font-size-sm);
  font-weight: bold;
  z-index: 1;
}

/* 空状态 */
.empty-state {
  text-align: center;
  padding: var(--spacing-xl);
  color: var(--color-text-secondary);
  font-size: var(--font-size-base);
}

/* 配方网格 */
.recipes-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: var(--spacing-md);
  margin-bottom: var(--spacing-lg);
}

/* 配方卡片 */
.recipe-card {
  background: var(--color-bg-primary);
  border: var(--border-width-thin) solid var(--color-border-light);
  padding: var(--spacing-md);
  transition: all 0.15s ease;
}

.recipe-card:hover:not(.locked) {
  background: var(--color-bg-secondary);
  border-color: var(--color-border-dark);
}

.recipe-card.locked {
  opacity: 0.5;
  cursor: not-allowed;
}

.recipe-card.cooking {
  border-width: var(--border-width-medium);
  border-color: var(--color-black);
  background: var(--color-bg-secondary);
}

.recipe-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-sm);
  padding-bottom: var(--spacing-sm);
  border-bottom: var(--border-width-thin) solid var(--color-border-light);
}

.recipe-header h3 {
  margin: 0;
  font-size: var(--font-size-lg);
  color: var(--color-text-primary);
  font-weight: bold;
}

.quality-badge {
  padding: var(--spacing-xs) var(--spacing-sm);
  font-size: var(--font-size-xs);
  color: var(--color-text-primary);
  background: var(--color-bg-secondary);
  border: var(--border-width-thin) solid var(--color-border-medium);
  font-weight: bold;
}

.recipe-description {
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  margin-bottom: var(--spacing-md);
  line-height: 1.5;
}

/* 食材列表 */
.ingredients-section {
  margin-bottom: var(--spacing-md);
  padding: var(--spacing-sm);
  background: var(--color-bg-secondary);
  border: var(--border-width-thin) solid var(--color-border-light);
}

.ingredients-title {
  font-size: var(--font-size-sm);
  font-weight: bold;
  color: var(--color-text-primary);
  margin-bottom: var(--spacing-xs);
}

.ingredients-list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.ingredient-item {
  display: flex;
  justify-content: space-between;
  padding: var(--spacing-xs);
  font-size: var(--font-size-sm);
  background: var(--color-bg-primary);
  border: var(--border-width-thin) solid var(--color-border-light);
}

.ingredient-item.insufficient {
  color: var(--color-text-muted);
  border-color: var(--color-text-muted);
}

.ingredient-name {
  color: var(--color-text-primary);
}

.ingredient-amount {
  font-weight: bold;
  color: var(--color-text-secondary);
}

.ingredient-item.insufficient .ingredient-amount {
  color: var(--color-text-muted);
}

/* 配方属性 */
.recipe-stats {
  margin-bottom: var(--spacing-md);
}

.stat-row {
  display: flex;
  justify-content: space-between;
  padding: var(--spacing-xs) 0;
  border-bottom: var(--border-width-thin) solid var(--color-border-light);
}

.stat-label {
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
}

.stat-value {
  color: var(--color-text-primary);
  font-size: var(--font-size-sm);
  font-weight: bold;
}

.stat-value.insufficient {
  color: var(--color-text-muted);
  text-decoration: line-through;
}

/* 烹饪按钮 */
.cook-btn {
  position: relative;
  width: 100%;
  padding: var(--spacing-sm) var(--spacing-md);
  background: var(--color-black);
  color: var(--color-white);
  border: var(--border-width-thin) solid var(--color-black);
  font-size: var(--font-size-base);
  font-weight: bold;
  cursor: pointer;
  transition: all 0.15s ease;
  overflow: hidden;
}

.cook-btn:hover:not(:disabled) {
  background: var(--color-white);
  color: var(--color-black);
  border-color: var(--color-black);
}

.cook-btn.active {
  background: var(--color-white);
  color: var(--color-black);
  border-color: var(--color-black);
  border-width: var(--border-width-medium);
}

.cook-btn.active:hover {
  background: var(--color-bg-secondary);
}

.cook-btn:disabled {
  background: var(--color-bg-secondary);
  color: var(--color-text-muted);
  border-color: var(--color-border-light);
  cursor: not-allowed;
  opacity: 0.6;
}

.btn-progress-bar {
  position: absolute;
  left: 0;
  top: 0;
  height: 100%;
  background: var(--color-black);
  transition: width 0.1s linear;
  z-index: 0;
}

.btn-text {
  position: relative;
  z-index: 1;
}

/* 下一级解锁提示 */
.next-unlock {
  text-align: center;
  padding: var(--spacing-md);
  background: var(--color-bg-secondary);
  border: var(--border-width-thin) dashed var(--color-border-medium);
  color: var(--color-text-secondary);
}

.next-unlock strong {
  color: var(--color-text-primary);
  font-weight: bold;
}
</style>

