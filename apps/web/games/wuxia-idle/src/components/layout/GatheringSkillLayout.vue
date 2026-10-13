<!--
  通用采集技能布局组件
  用于所有采集类技能（采药、伐木、钓鱼、采矿、铸造等）
  支持可选的左侧分类菜单（用于铸造系统的装备分类）
-->
<template>
  <div class="gathering-skill-layout">
    <!-- 技能信息头部 - 始终在最顶部 -->
    <div class="skill-header">
      <h2><component :is="skillIcon" class="skill-icon" /> {{ skillName }}</h2>
      <div class="skill-info">
        <div class="skill-level">
          <span class="label">技能等级:</span>
          <span class="value">Lv.{{ skillProgress.level }}</span>
        </div>
        <div class="skill-exp">
          <div class="exp-bar-container">
            <div class="exp-bar" :style="{ width: expPercentage + '%' }"></div>
            <span class="exp-text">{{ skillProgress.currentExp }} / {{ skillProgress.requiredExp }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 
      扩展插槽：位于 header 下面，在 aside 和 grid 之前
      用于添加技能特有的额外内容，如特殊能力、装备合成等
    -->
    <div v-if="$slots.extra" class="skill-extra-content">
      <slot name="extra"></slot>
    </div>

    <!-- 主要内容区：左侧菜单（可选） + 资源网格 -->
    <div class="content-wrapper" :class="{ 'has-sidebar': showSidebar }">
      <!-- 左侧分类菜单（可选） -->
      <aside v-if="showSidebar" class="category-sidebar">
        <div class="sidebar-title">{{ sidebarTitle || '分类' }}</div>
        <nav class="category-list">
          <button
            v-for="category in categories"
            :key="category.id"
            class="category-item"
            :class="{ active: currentCategory === category.id }"
            @click="handleCategoryChange(category.id)"
          >
            <component v-if="category.icon" :is="category.icon" class="category-icon" />
            <span>{{ category.name }}</span>
          </button>
        </nav>
      </aside>

      <!-- 资源内容区 -->
      <div class="resources-content">
        <!-- 空状态提示 -->
        <div v-if="!availableResources.length" class="empty-state">
          <p>{{ emptyStateText }}</p>
        </div>

        <!-- 资源网格 -->
        <div v-else class="resources-grid">
      <div
        v-for="resource in allResources"
        :key="resource.id"
        class="resource-card"
        :class="{
          locked: resource.requiredLevel > skillProgress.level,
          gathering: isCurrentGathering(resource.id)
        }"
      >
        <!-- 资源信息 -->
        <div class="resource-header">
          <h3>{{ resource.name }}</h3>
          <span class="quality-badge">
            {{ getQualityName(resource.quality) }}
          </span>
        </div>

        <div class="resource-description">{{ resource.description }}</div>

        <!-- 材料需求（可选） -->
        <div v-if="showIngredients && ingredientsGetter" class="ingredients-section">
          <div class="ingredients-title">{{ ingredientsLabel || '所需材料' }}:</div>
          <div class="ingredients-list">
            <div 
              v-for="ingredient in ingredientsGetter(resource.id)" 
              :key="ingredient.id"
              class="ingredient-item"
              :class="{ insufficient: ingredientAmountGetter && ingredientAmountGetter(ingredient.id) < ingredient.quantity }"
            >
              <span class="ingredient-name">
                {{ ingredientNameGetter ? ingredientNameGetter(ingredient.id) : ingredient.id }}
              </span>
              <span class="ingredient-amount">
                {{ ingredientAmountGetter ? ingredientAmountGetter(ingredient.id) : 0 }} / {{ ingredient.quantity }}
              </span>
            </div>
          </div>
        </div>

        <div class="resource-stats">
          <div class="stat-row">
            <span class="stat-label">需求等级:</span>
            <span class="stat-value" :class="{ insufficient: resource.requiredLevel > skillProgress.level }">
              Lv.{{ resource.requiredLevel }}
            </span>
          </div>
          <div class="stat-row">
            <span class="stat-label">{{ gatheringTimeLabel }}:</span>
            <span class="stat-value">{{ (resource.gatherTime / 1000).toFixed(1) }}秒</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">成功率:</span>
            <span class="stat-value">{{ (getSuccessRate(resource) * 100).toFixed(1) }}%</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">获得经验:</span>
            <span class="stat-value">{{ resource.experience }}</span>
          </div>
        </div>

        <!-- 采集按钮 -->
        <button
          class="gather-btn"
          :class="{ active: isCurrentGathering(resource.id) }"
          :disabled="!canGather(resource)"
          @click="handleGatherClick(resource)"
        >
          <div 
            v-if="isCurrentGathering(resource.id)" 
            class="btn-progress-bar"
            :style="{ width: currentProgress + '%' }"
          ></div>
          <span class="btn-text">{{ getButtonText(resource) }}</span>
        </button>
        </div>
      </div>

        <!-- 下一级解锁提示 -->
        <div v-if="nextUnlock" class="next-unlock">
          <p><Lock class="lock-icon" /> 下一级解锁: <strong>{{ nextUnlock.name }}</strong> (需要 Lv.{{ nextUnlock.requiredLevel }})</p>
        </div>
      </div><!-- /resources-content -->
    </div><!-- /content-wrapper -->
  </div><!-- /gathering-skill-layout -->
</template>

<script setup lang="ts">
import { computed, type Component } from 'vue';
import { Lock, RefreshCw, FlaskConical, Sparkles, Scroll, BookOpen, Library, ScrollText, Dumbbell, Sword, Shield, BookMarked, GraduationCap, Scroll as ScrollIcon } from 'lucide-vue-next';
import type { ResourceConfig, LifeSkillType, SkillProgress } from '@/types/lifeSkill';
import { LifeSkillService } from '@/services/lifeSkillService';

/**
 * 分类菜单项
 */
export interface CategoryItem {
  id: string;
  name: string;
  icon?: Component;
}

/**
 * 材料/配料项
 */
export interface IngredientItem {
  id: string;
  quantity: number;
}

/**
 * Props定义
 */
interface Props {
  // 技能相关
  skillName: string;              // 技能名称，如"采药"、"伐木"
  skillIcon: Component;              // 技能图标组件
  skillType: LifeSkillType;       // 技能类型
  skillProgress: SkillProgress;   // 技能进度
  
  // 资源相关
  allResources: ResourceConfig[]; // 所有资源列表
  availableResources: ResourceConfig[]; // 可用资源列表
  nextUnlock: ResourceConfig | null;    // 下一级解锁的资源
  
  // 当前状态
  currentResourceId: string | null;  // 当前正在采集的资源ID
  currentProgress: number;           // 当前采集进度 0-100
  
  // 左侧菜单配置（可选）
  showSidebar?: boolean;             // 是否显示左侧菜单
  sidebarTitle?: string;             // 左侧菜单标题
  categories?: CategoryItem[];       // 分类列表
  currentCategory?: string;          // 当前选中的分类
  
  // 材料/配料配置（可选，用于铸造、烹饪等需要材料的技能）
  showIngredients?: boolean;         // 是否显示材料需求
  ingredientsLabel?: string;         // 材料标签，如"所需材料"、"所需食材"
  ingredientsGetter?: (resourceId: string) => IngredientItem[];  // 获取材料列表的函数
  ingredientNameGetter?: (ingredientId: string) => string;       // 获取材料名称的函数
  ingredientAmountGetter?: (ingredientId: string) => number;     // 获取当前材料数量的函数
  resourceStateGetter?: (resource: ResourceConfig) => { canStart: boolean; reason?: string };
  
  // 文案配置
  emptyStateText?: string;        // 空状态提示文字
  gatheringTimeLabel?: string;    // 采集时间标签，如"采集时间"、"钓鱼时间"
}

/**
 * Emits定义
 */
interface Emits {
  (e: 'start-gathering', resource: ResourceConfig): void;
  (e: 'stop-gathering'): void;
  (e: 'category-change', categoryId: string): void;  // 分类切换事件
}

const props = withDefaults(defineProps<Props>(), {
  emptyStateText: '暂无可采集的资源',
  gatheringTimeLabel: '采集时间',
  showSidebar: false,
  categories: () => [],
  currentCategory: '',
  showIngredients: false,
  ingredientsLabel: '所需材料',
  ingredientAmountGetter: undefined,
  resourceStateGetter: undefined
});

const emit = defineEmits<Emits>();

/**
 * 计算属性
 */
const expPercentage = computed(() => {
  return (props.skillProgress.currentExp / props.skillProgress.requiredExp) * 100;
});

/**
 * 方法
 */
function getResourceState(resource: ResourceConfig): { canStart: boolean; reason?: string } {
  const levelOk = resource.requiredLevel <= props.skillProgress.level;
  let state = props.resourceStateGetter ? props.resourceStateGetter(resource) : null;
  if (!levelOk) {
    return { canStart: false, reason: '等级不足' };
  }
  if (state) {
    return state.canStart ? state : { canStart: false, reason: state.reason || '不可执行' };
  }
  return { canStart: true };
}

function canGather(resource: ResourceConfig): boolean {
  if (isCurrentGathering(resource.id)) return true;
  const state = getResourceState(resource);
  return state.canStart;
}

function isCurrentGathering(resourceId: string): boolean {
  return props.currentResourceId === resourceId;
}

function getSuccessRate(resource: ResourceConfig): number {
  return LifeSkillService.calculateSuccessRate(resource, props.skillProgress.level);
}

function getQualityName(quality: string): string {
  return LifeSkillService.getQualityName(quality);
}

function handleGatherClick(resource: ResourceConfig): void {
  if (!canGather(resource)) return;
  
  // 如果正在采集此资源，则停止
  if (isCurrentGathering(resource.id)) {
    emit('stop-gathering');
  } else {
    emit('start-gathering', resource);
  }
}

function getButtonText(resource: ResourceConfig): string {
  if (isCurrentGathering(resource.id)) {
    return '停止';
  }
 
  const state = getResourceState(resource);
  if (!state.canStart) {
    return state.reason || '不可执行';
  }
  return '开始';
}

/**
 * 处理分类切换
 */
function handleCategoryChange(categoryId: string): void {
  emit('category-change', categoryId);
}
</script>

<style scoped>
.gathering-skill-layout {
  padding: 18px 20px;
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.skill-header {
  padding: 16px 18px;
  background: #fdfdfc;
  border: 1px solid rgba(17, 17, 17, 0.12);
  border-radius: 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.skill-header h2 {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  letter-spacing: 0.8px;
  color: #111;
  display: flex;
  align-items: center;
  gap: 8px;
}

.skill-icon {
  width: 24px;
  height: 24px;
}

.skill-info {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}

.skill-level {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: rgba(17, 17, 17, 0.7);
}

.skill-level .value {
  font-size: 18px;
  font-weight: 600;
  color: #111;
}

.skill-exp {
  flex: 1;
  min-width: 240px;
}

.exp-bar-container {
  position: relative;
  height: 12px;
  border-radius: 999px;
  background: rgba(17, 17, 17, 0.08);
  overflow: hidden;
}

.exp-bar {
  position: absolute;
  inset: 0;
  background: linear-gradient(90deg, #111, #333);
  transition: width 0.3s ease;
}

.exp-text {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  color: rgba(255, 255, 255, 0.85);
  text-shadow: 0 0 4px rgba(0, 0, 0, 0.2);
}

.skill-extra-content {
  padding: 14px 16px;
  background: rgba(249, 249, 248, 0.8);
  border: 1px dashed rgba(17, 17, 17, 0.12);
  border-radius: 12px;
}

.content-wrapper {
  display: grid;
  gap: 18px;
}

.content-wrapper.has-sidebar {
  grid-template-columns: 200px 1fr;
  align-items: start;
}

.category-sidebar {
  background: #fff;
  border: 1px solid rgba(17, 17, 17, 0.12);
  border-radius: 14px;
  padding: 14px;
  position: sticky;
  top: 18px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.sidebar-title {
  font-size: 13px;
  font-weight: 600;
  color: rgba(17, 17, 17, 0.8);
  border-bottom: 1px solid rgba(17, 17, 17, 0.12);
  padding-bottom: 6px;
  text-align: center;
}

.category-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.category-item {
  padding: 8px 10px;
  background: #fdfdfc;
  border: 1px solid rgba(17, 17, 17, 0.1);
  border-radius: 10px;
  font-size: 12.5px;
  color: rgba(17, 17, 17, 0.75);
  cursor: pointer;
  transition: all 0.15s ease;
  display: flex;
  align-items: center;
  gap: 6px;
}

.category-icon {
  width: 14px;
  height: 14px;
}

.category-item:hover {
  background: rgba(17, 17, 17, 0.05);
  border-color: rgba(17, 17, 17, 0.25);
}

.category-item.active {
  background: #111;
  color: #fff;
  border-color: #111;
  font-weight: 600;
}

.resources-content {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.resources-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 14px;
}

.resource-card {
  background: #fff;
  border: 1px solid rgba(17, 17, 17, 0.1);
  border-radius: 14px;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  transition: border-color 0.15s ease, transform 0.15s ease;
}

.resource-card:hover:not(.locked) {
  border-color: rgba(17, 17, 17, 0.35);
  transform: translateY(-1px);
}

.resource-card.locked {
  opacity: 0.55;
  cursor: not-allowed;
}

.resource-card.gathering {
  border-color: #111;
  background: rgba(17, 17, 17, 0.05);
}

.resource-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 6px;
  border-bottom: 1px solid rgba(17, 17, 17, 0.07);
}

.resource-header h3 {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: #111;
}

.quality-badge {
  padding: 2px 8px;
  font-size: 10px;
  border-radius: 999px;
  border: 1px solid rgba(17, 17, 17, 0.15);
  color: rgba(17, 17, 17, 0.6);
}

.resource-description {
  font-size: 12px;
  color: rgba(17, 17, 17, 0.6);
  line-height: 1.45;
}

.ingredients-section {
  background: rgba(249, 249, 248, 0.8);
  border: 1px solid rgba(17, 17, 17, 0.08);
  border-radius: 10px;
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.ingredients-title {
  font-size: 11px;
  font-weight: 600;
  color: rgba(17, 17, 17, 0.6);
}

.ingredients-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.ingredient-item {
  display: flex;
  justify-content: space-between;
  font-size: 11.5px;
  padding: 4px 6px;
  border-radius: 8px;
  background: #fff;
  border: 1px solid rgba(17, 17, 17, 0.08);
}

.ingredient-item.insufficient {
  opacity: 0.6;
  text-decoration: line-through;
}

.resource-stats {
  display: grid;
  gap: 6px;
}

.stat-row {
  display: flex;
  justify-content: space-between;
  font-size: 11.5px;
  color: rgba(17, 17, 17, 0.7);
}

.stat-value {
  font-weight: 600;
  color: #111;
}

.stat-value.insufficient {
  color: rgba(17, 17, 17, 0.45);
  text-decoration: line-through;
}

.gather-btn {
  position: relative;
  width: 100%;
  padding: 10px;
  border-radius: 10px;
  border: 1px solid #111;
  background: #111;
  color: #fff;
  font-weight: 600;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s ease;
  overflow: hidden;
}

.gather-btn:hover:not(:disabled) {
  background: #fff;
  color: #111;
}

.gather-btn.active {
  background: rgba(17, 17, 17, 0.06);
  color: #111;
}

.gather-btn:disabled {
  background: rgba(17, 17, 17, 0.06);
  color: rgba(17, 17, 17, 0.4);
  border-color: rgba(17, 17, 17, 0.12);
  cursor: not-allowed;
}

.btn-progress-bar {
  position: absolute;
  inset: 0;
  background: linear-gradient(90deg, rgba(17, 17, 17, 0.1), rgba(17, 17, 17, 0.35));
  transition: width 0.1s linear;
}

.btn-text {
  position: relative;
  z-index: 1;
}

.next-unlock {
  text-align: center;
  padding: 12px;
  border-radius: 12px;
  border: 1px dashed rgba(17, 17, 17, 0.14);
  background: rgba(249, 249, 248, 0.8);
  font-size: 12px;
  color: rgba(17, 17, 17, 0.65);
}

.next-unlock strong {
  color: #111;
}

@media (max-width: 1024px) {
  .gathering-skill-layout {
    padding: 16px;
  }

  .content-wrapper.has-sidebar {
    grid-template-columns: 1fr;
  }

  .resources-grid {
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  }
}

.lock-icon {
  width: 12px;
  height: 12px;
  vertical-align: middle;
  margin-right: 4px;
}
</style>

