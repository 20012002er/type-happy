<template>
  <GatheringSkillLayout
    skill-name="炼丹"
    :skill-icon="FlaskConical"
    :skill-type="LifeSkillType.ALCHEMY"
    :skill-progress="skillProgress"
    :all-resources="allRecipesAsResources"
    :available-resources="availableRecipesAsResources"
    :next-unlock="nextUnlockAsResource"
    :current-resource-id="currentRecipeId"
    :current-progress="alchemyProgress"
    :show-sidebar="true"
    sidebar-title="丹药分类"
    :categories="categories"
    :current-category="currentCategory"
    :show-ingredients="true"
    ingredients-label="所需材料"
    :ingredients-getter="getRecipeIngredients"
    :ingredient-name-getter="getIngredientName"
    :ingredient-amount-getter="getIngredientAmount"
    empty-state-text="暂无可炼制的丹药"
    gathering-time-label="炼制时间"
    @start-gathering="handleStartAlchemy"
    @stop-gathering="handleStopAlchemy"
    @category-change="handleCategoryChange"
  />
</template>

<script setup lang="ts">
import { ref, computed, onMounted, type Component } from 'vue';
import { FlaskConical, Heart, Zap, RefreshCw, Sparkles, Activity, Shield, Wind } from 'lucide-vue-next';
import { useLifeSkillStore } from '@/stores/lifeSkillStore';
import { useAlchemyQueueStore } from '@/stores/alchemyQueueStore';
import { useQueueManager } from '@/services/QueueManagerService';
import { AlchemyConfigService } from '@/services/config/AlchemyConfigService';
import { alchemyService } from '@/services/alchemyService';
import GatheringSkillLayout, { type CategoryItem, type IngredientItem } from '@/components/layout/GatheringSkillLayout.vue';
import type { ResourceConfig } from '@/types/lifeSkill';
import type { AlchemyRecipe, AlchemyCategory } from '@/types/alchemy';
import { LifeSkillType } from '@/types/lifeSkill';
import { useMaterialsStore } from '@/stores/materialsStore';
import { LifeSkillConfigService } from '@/services/config/LifeSkillConfigService';

// ========== Stores and Services ==========
const lifeSkillStore = useLifeSkillStore();
const alchemyQueueStore = useAlchemyQueueStore();
const materialsStore = useMaterialsStore();
const { startTask } = useQueueManager();

// ========== 状态 ==========
const currentCategory = ref<AlchemyCategory>('healing');  // 默认显示回血丹药

// ========== 计算属性 ==========

const skillProgress = computed(() => lifeSkillStore.getSkillProgress(LifeSkillType.ALCHEMY));
const alchemyProgress = computed(() => alchemyQueueStore.alchemyProgress);
const currentRecipeId = computed(() => alchemyQueueStore.currentAlchemy?.recipeId || null);

// 图标映射
const iconMap: Record<string, Component> = {
  '❤️': Heart,
  '⚡': Zap,
  '🌀': RefreshCw,
  '✨': Sparkles,
  '💪': Activity,
  '🛡️': Shield,
  '🌬️': Wind,
};

// 分类列表（用于左侧菜单）
const categories = computed((): CategoryItem[] => {
  const cats = AlchemyConfigService.getCategories();
  if (!cats || cats.length === 0) return [];
  return cats.map(cat => ({
    id: cat.id,
    name: cat.name,
    icon: iconMap[cat.icon] || FlaskConical
  }));
});

// 当前分类的所有配方
const allRecipes = computed(() => {
  return AlchemyConfigService.getRecipesByCategory(currentCategory.value) || [];
});

// 当前分类的可用配方
const availableRecipes = computed(() => {
  return AlchemyConfigService.getAvailableRecipes(
    currentCategory.value,
    skillProgress.value.level
  ) || [];
});

// 下一级解锁的配方
const nextUnlock = computed(() => {
  return AlchemyConfigService.getNextUnlockRecipe(
    currentCategory.value,
    skillProgress.value.level
  ) || null;
});

// 将配方转换为ResourceConfig格式（适配GatheringSkillLayout）
const allRecipesAsResources = computed((): ResourceConfig[] => {
  return allRecipes.value.map(recipe => recipeToResource(recipe));
});

const availableRecipesAsResources = computed((): ResourceConfig[] => {
  return availableRecipes.value.map(recipe => recipeToResource(recipe));
});

const nextUnlockAsResource = computed((): ResourceConfig | null => {
  const next = nextUnlock.value;
  return next ? recipeToResource(next) : null;
});

// ========== 辅助函数 ==========

/**
 * 将AlchemyRecipe转换为ResourceConfig
 */
function recipeToResource(recipe: AlchemyRecipe): ResourceConfig {
  return {
    id: recipe.id,
    name: recipe.name,
    description: recipe.description,
    skillType: 'alchemy' as any,
    quality: recipe.quality as any,
    requiredLevel: recipe.requiredLevel,
    baseSuccessRate: 1, // 炼丹成功率100%
    gatherTime: recipe.craftTime,
    experience: recipe.experience
  };
}

/**
 * 获取配方材料列表
 */
function getRecipeIngredients(recipeId: string): IngredientItem[] {
  const recipe = AlchemyConfigService.getRecipeById(recipeId);
  if (!recipe) return [];
  
  return recipe.ingredients.map(ing => ({
    id: ing.materialId,
    quantity: ing.amount
  }));
}

/**
 * 获取材料名称
 */
function getIngredientName(materialId: string): string {
  // 从life-skills配置中获取材料名称
  const resource = LifeSkillConfigService.findResourceById(materialId);
  return resource?.name || materialId;
}

/**
 * 获取材料数量（玩家拥有的）
 */
function getIngredientAmount(materialId: string): number {
  return materialsStore.getMaterial(materialId)?.quantity || 0;
}

// ========== 事件处理 ==========

/**
 * 开始炼丹
 */
function handleStartAlchemy(resource: ResourceConfig) {
  const recipeId = resource.id;
  console.log(`[AlchemyPanel] 开始炼丹: ${recipeId}`);
  
  // 1. 获取炼丹配方
  const recipe = AlchemyConfigService.getRecipeById(recipeId);
  if (!recipe) {
    console.error(`[AlchemyPanel] 配方不存在: ${recipeId}`);
    return;
  }
  
  // 2. 尝试开始炼丹
  const task = alchemyService.startAlchemy(recipe.id);
  if (!task) {
    console.warn('[AlchemyPanel] 无法开始炼丹（材料不足或等级不够）');
    return;
  }
  
  // 3. 添加到炼丹队列
  alchemyQueueStore.startAlchemy(task);
  
  // 4. 启动队列管理器
  startTask(alchemyQueueStore.createQueueTask());
  
  console.log('[AlchemyPanel] 开始自动炼丹:', recipe.name);
}

/**
 * 停止炼丹
 */
function handleStopAlchemy() {
  console.log('[AlchemyPanel] 停止炼丹');
  
  const recipe = alchemyQueueStore.currentAlchemy;
  if (!recipe) return;
  
  alchemyService.stopAlchemy(recipe.recipeId);
  alchemyQueueStore.stopAlchemy();
}

/**
 * 切换分类
 */
function handleCategoryChange(categoryId: string) {
  console.log(`[AlchemyPanel] 切换分类: ${categoryId}`);
  currentCategory.value = categoryId as AlchemyCategory;
}

// ========== 生命周期 ==========

onMounted(async () => {
  console.log('[AlchemyPanel] 组件已挂载');
  
  // 确保配置已加载（App.vue中已经init过了，这里只是保险）
  await AlchemyConfigService.init();
  console.log('[AlchemyPanel] 炼丹配置已确认加载');
});
</script>

<style scoped>
/* 炼丹面板样式 */
</style>

