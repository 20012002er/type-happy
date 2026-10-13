<template>
  <GatheringSkillLayout
    skill-name="铸造"
    :skill-icon="Hammer"
    :skill-type="LifeSkillType.SMITHING"
    :skill-progress="skillProgress"
    :all-resources="allRecipesAsResources"
    :available-resources="availableRecipesAsResources"
    :next-unlock="nextUnlockAsResource"
    :current-resource-id="currentRecipeId"
    :current-progress="smithingProgress"
    :show-sidebar="true"
    sidebar-title="装备分类"
    :categories="categories"
    :current-category="currentCategory"
    :show-ingredients="true"
    ingredients-label="所需材料"
    :ingredients-getter="getRecipeIngredients"
    :ingredient-name-getter="getIngredientName"
    :ingredient-amount-getter="getIngredientAmount"
    empty-state-text="暂无可铸造的配方"
    gathering-time-label="铸造时间"
    @start-gathering="handleStartCrafting"
    @stop-gathering="handleStopCrafting"
    @category-change="handleCategoryChange"
  >
    <!-- Extra插槽：装备合成功能 -->
    <template #extra>
      <SmithingEnhancementPanel />
    </template>
  </GatheringSkillLayout>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, type Component } from 'vue';
import { Hammer, Crown, Shield, Shirt, Hand, Footprints, Gem, CircleDot, Box } from 'lucide-vue-next';
import { useLifeSkillStore } from '@/stores/lifeSkillStore';
import { useSmithingQueueStore } from '@/stores/smithingQueueStore';
import { useQueueManager } from '@/services/QueueManagerService';
import { SmithingConfigService } from '@/services/config/SmithingConfigService';
import { smithingService } from '@/services/smithingService';
import GatheringSkillLayout, { type CategoryItem, type IngredientItem } from '@/components/layout/GatheringSkillLayout.vue';
import SmithingEnhancementPanel from '@/components/SmithingEnhancementPanel.vue';
import type { ResourceConfig } from '@/types/lifeSkill';
import type { SmithingRecipe, SmithingCategory } from '@/types/smithing';
import { LifeSkillType } from '@/types/lifeSkill';
import { useMaterialsStore } from '@/stores/materialsStore';
import { LifeSkillConfigService } from '@/services/config/LifeSkillConfigService';

// ========== Stores and Services ==========
const lifeSkillStore = useLifeSkillStore();
const smithingQueueStore = useSmithingQueueStore();
const materialsStore = useMaterialsStore();
const { startTask } = useQueueManager();

// ========== 状态 ==========
const currentCategory = ref<SmithingCategory>('weapon');

// ========== 计算属性 ==========

const skillProgress = computed(() => lifeSkillStore.getSkillProgress(LifeSkillType.SMITHING));
const smithingProgress = computed(() => smithingQueueStore.smithingProgress);
const currentRecipeId = computed(() => smithingQueueStore.currentSmithing?.recipeId || null);

// 图标映射
const iconMap: Record<string, Component> = {
  '👒': Crown,
  '🛡️': Shield,
  '🥋': Shirt,
  '🧤': Hand,
  '🥾': Footprints,
  '📿': Gem,
  '💍': CircleDot,
  '🎒': Box,
};

// 分类列表（用于左侧菜单）
const categories = computed((): CategoryItem[] => {
  return SmithingConfigService.getCategories()
    .filter(cat => cat.id !== 'materials')
    .map(cat => ({
      id: cat.id,
      name: cat.name,
      icon: iconMap[cat.icon] || Hammer
    }));
});

// 当前分类的所有配方
const allRecipes = computed(() => {
  return SmithingConfigService.getRecipesByCategory(currentCategory.value);
});

// 当前分类的可用配方
const availableRecipes = computed(() => {
  return SmithingConfigService.getAvailableRecipes(
    currentCategory.value,
    skillProgress.value.level
  );
});

// 下一级解锁的配方
const nextUnlock = computed(() => {
  return SmithingConfigService.getNextUnlockRecipe(
    currentCategory.value,
    skillProgress.value.level
  );
});

// 将配方转换为ResourceConfig格式（适配GatheringSkillLayout）
const allRecipesAsResources = computed((): ResourceConfig[] => {
  return allRecipes.value.map(recipe => recipeToResource(recipe));
});

const availableRecipesAsResources = computed((): ResourceConfig[] => {
  return availableRecipes.value.map(recipe => recipeToResource(recipe));
});

const nextUnlockAsResource = computed((): ResourceConfig | null => {
  return nextUnlock.value ? recipeToResource(nextUnlock.value) : null;
});

// ========== 方法 ==========

/**
 * 获取配方所需的材料列表
 */
function getRecipeIngredients(recipeId: string): IngredientItem[] {
  const recipe = SmithingConfigService.getRecipe(recipeId);
  if (!recipe || !recipe.ingredients) return [];
  
  return recipe.ingredients.map(ing => ({
    id: ing.id,
    quantity: ing.quantity
  }));
}

/**
 * 获取材料的名称
 * 首先尝试从生活技能资源中获取，如果不是生活技能资源，则尝试从铸造中间材料中获取
 */
function getIngredientName(ingredientId: string): string {
  // 优先：材料仓库（可能包含制皮产出物如 leather/fine_leather 的显示名）
  const stored = materialsStore.getMaterial(ingredientId);
  if (stored?.name) return stored.name;

  // 其次：生活技能资源命名（木材、矿石等）
  const resourceName = LifeSkillConfigService.getResourceName(ingredientId);
  if (resourceName && resourceName !== ingredientId) return resourceName;

  // 再次：锻材中间材料（若配置中存在）
  const recipe = SmithingConfigService.getRecipe(ingredientId);
  if (recipe) return recipe.name;

  // 回退：ID
  return ingredientId;
}

/**
 * 获取当前拥有的材料数量
 */
function getIngredientAmount(ingredientId: string): number {
  const material = materialsStore.getMaterial(ingredientId);
  return material?.quantity || 0;
}

/**
 * 将铸造配方转换为资源配置（适配GatheringSkillLayout）
 */
function recipeToResource(recipe: SmithingRecipe): ResourceConfig {
  return {
    id: recipe.id,
    name: recipe.name,
    description: recipe.description,
    skillType: 'smithing' as any,
    quality: recipe.quality as any, // SmithingRecipe的quality是string，需要类型转换
    requiredLevel: recipe.requiredLevel,
    baseSuccessRate: recipe.baseSuccessRate,
    gatherTime: recipe.craftTime,
    experience: recipe.experience
  };
}

/**
 * 处理分类切换
 */
function handleCategoryChange(categoryId: string): void {
  currentCategory.value = categoryId as SmithingCategory;
  console.log('[SmithingPanel] 切换分类:', categoryId);
}

/**
 * 开始铸造
 * 
 * 设计说明：
 * 1. 通过队列管理器启动任务，自动处理任务互斥和AutoRunner启动
 * 2. 无需手动启动AutoRunner（QueueTask.start()会处理）
 * 3. 符合SOLID原则：单一职责，只负责铸造相关逻辑
 */
function handleStartCrafting(resource: ResourceConfig): void {
  // 1. 获取铸造配方
  const recipe = SmithingConfigService.getRecipe(resource.id);
  if (!recipe) {
    console.warn('[SmithingPanel] 配方不存在:', resource.id);
    return;
  }
  
  // 2. 检查材料是否充足
  if (!smithingService.canCraft(recipe)) {
    console.warn('[SmithingPanel] 材料不足，无法开始铸造');
    return;
  }
  
  // 3. 添加到铸造队列
  smithingQueueStore.startSmithing(recipe.id, recipe.name, recipe.craftTime);
  
  // 4. 通过队列管理器启动任务（会自动停止其他任务并启动AutoRunner）
  startTask(smithingQueueStore.createQueueTask());
  
  console.log('[SmithingPanel] 开始自动铸造:', recipe.name);
}

/**
 * 停止铸造
 */
function handleStopCrafting(): void {
  // 通过队列管理器停止任务
  const { stopTask } = useQueueManager();
  stopTask();
  
  console.log('[SmithingPanel] 停止自动铸造');
}

// ========== 生命周期 ==========

onMounted(() => {
  console.log('[SmithingPanel] 组件已挂载');
  // 队列恢复由QueueRestoreService统一处理，组件无需处理
});
</script>

<style scoped>
/* SmithingPanel 特定样式（如有需要可在此添加） */
</style>

