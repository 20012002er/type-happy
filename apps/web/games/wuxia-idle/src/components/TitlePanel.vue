<template>
  <div class="title-panel">
    <header class="panel-header">
      <div class="panel-title">
        <h1>称号系统</h1>
        <p>收集和装备称号，获得强大的属性加成</p>
      </div>
      <div class="panel-summary">
        <div class="summary-item">
          <span class="summary-label">已解锁</span>
          <span class="summary-value"
            >{{ titleStore.getUnlockedCount() }} / {{ titleStore.getTotalCount() }}</span
          >
        </div>
        <div class="summary-item">
          <span class="summary-label">当前装备</span>
          <span class="summary-value equipped">{{ equippedTitleName }}</span>
        </div>
      </div>
    </header>

    <!-- 当前装备称号展示 -->
    <section
      class="equipped-section"
      v-if="equippedTitle"
    >
      <h2 class="section-title">已装备称号</h2>
      <div
        class="equipped-card"
        :class="getRarityClass(equippedTitle.rarity)"
      >
        <div class="equipped-icon"><Medal class="title-medal-icon" /></div>
        <div class="equipped-info">
          <div class="equipped-name">{{ equippedTitle.name }}</div>
          <div class="equipped-description">{{ equippedTitle.description }}</div>
          <div
            class="equipped-bonuses"
            v-if="equippedTitle.bonuses.length"
          >
            <span class="bonus-label">属性加成：</span>
            <span
              v-for="(bonus, index) in equippedTitle.bonuses"
              :key="index"
              class="bonus-tag"
            >
              {{ getBonusText(bonus) }}
            </span>
          </div>
        </div>
        <button
          class="unequip-btn"
          v-if="!equippedTitle.isPermanent"
          @click="handleUnequip"
        >
          卸下
        </button>
      </div>
    </section>

    <!-- 分类标签页 -->
    <section class="category-section">
      <h2 class="section-title">称号分类</h2>
      <div class="category-tabs">
        <button
          v-for="category in categories"
          :key="category.id"
          class="category-tab"
          :class="{ active: selectedCategory === category.id }"
          @click="selectedCategory = category.id"
        >
          <component :is="getCategoryIcon(category.id)" class="tab-icon" />
          <span class="tab-name">{{ category.name }}</span>
          <span class="tab-count">{{ getCategoryCount(category.id) }}</span>
        </button>
      </div>
    </section>

    <!-- 称号列表 -->
    <section class="titles-section">
      <h2 class="section-title">
        {{ getCategoryName(selectedCategory) }}
        <span class="section-subtitle">（{{ filteredTitles.length }}个）</span>
      </h2>
      <div class="titles-grid">
        <div
          v-for="title in filteredTitles"
          :key="title.id"
          class="title-card"
          :class="{
            'title-owned': titleStore.isOwned(title.id),
            'title-equipped': isEquipped(title.id),
            [`rarity-${title.rarity}`]: true,
          }"
          @click="handleTitleClick(title)"
        >
          <div class="title-card-header">
            <Medal class="title-icon" />
            <span class="title-name">{{ title.name }}</span>
            <span
              class="title-rarity"
              :class="getRarityClass(title.rarity)"
            >
              {{ getRarityName(title.rarity) }}
            </span>
          </div>
          <div class="title-description">{{ title.description }}</div>
          <div
            class="title-bonuses"
            v-if="title.bonuses.length"
          >
            <span
              v-for="(bonus, index) in title.bonuses.slice(0, 3)"
              :key="index"
              class="bonus-item"
            >
              {{ getBonusText(bonus) }}
            </span>
          </div>
          <div class="title-status">
            <template v-if="titleStore.isOwned(title.id)">
              <span
                v-if="isEquipped(title.id)"
                class="status-equipped"
                >已装备</span
              >
              <span
                v-else
                class="status-owned"
                >已拥有</span
              >
            </template>
            <template v-else>
              <span class="status-locked">未解锁</span>
            </template>
          </div>
        </div>
      </div>
    </section>

    <!-- 称号详情弹窗 -->
    <CommonModal
      v-model="showTitleModal"
      :title="selectedTitle?.name || ''"
      :icon="selectedTitleIcon"
      :rarity="selectedTitle?.rarity"
      :width="480"
      @close="selectedTitle = null"
    >
      <template #default>
        <div v-if="selectedTitle">
          <div class="modal-description-text">{{ selectedTitle.description }}</div>
          <div class="modal-meta">
            <span class="meta-label">分类：</span>
            <span>{{ getCategoryName(selectedTitle.category) }}</span>
          </div>
          <div
            v-if="selectedTitle.source"
            class="modal-meta"
          >
            <span class="meta-label">来源：</span>
            <span>{{ selectedTitle.source }}</span>
          </div>

          <!-- 属性加成 -->
          <div class="modal-section">
            <h4 class="section-heading">属性加成</h4>
            <div class="bonuses-grid">
              <div
                v-for="(bonus, index) in selectedTitle.bonuses"
                :key="index"
                class="bonus-item"
              >
                <span class="bonus-stat">{{ getStatName(bonus.statType) }}</span>
                <span class="bonus-value">
                  +{{ bonus.value }}{{ bonus.isPercentage ? '%' : '' }}
                </span>
              </div>
              <div
                v-if="!selectedTitle.bonuses.length"
                class="no-items"
              >
                无属性加成
              </div>
            </div>
          </div>

          <!-- 解锁条件 -->
          <div
            v-if="!titleStore.isOwned(selectedTitle.id)"
            class="modal-section"
          >
            <h4 class="section-heading">解锁条件</h4>
            <div class="requirements-list">
              <template v-if="selectedTitle.requirements.length">
                <div
                  v-for="(req, index) in selectedTitle.requirements"
                  :key="index"
                  class="requirement-item"
                >
                  <span class="req-icon">{{ req.description ? '✓' : '○' }}</span>
                  <span>{{ req.description || getRequirementText(req) }}</span>
                </div>
              </template>
              <div
                v-else
                class="no-items"
              >
                无特殊条件（初始称号）
              </div>
            </div>
          </div>
        </div>
      </template>

      <template #footer>
        <div v-if="selectedTitle">
          <template v-if="titleStore.isOwned(selectedTitle.id)">
            <button
              v-if="!isEquipped(selectedTitle.id)"
              class="action-btn confirm-btn"
              :class="getRarityClass(selectedTitle.rarity)"
              @click="handleEquip"
            >
              装备称号
            </button>
            <button
              v-else
              class="action-btn equipped-btn"
              disabled
            >
              已装备
            </button>
            <button
              v-if="!selectedTitle.isPermanent && isEquipped(selectedTitle.id)"
              class="action-btn cancel-btn"
              @click="handleUnequip"
            >
              卸下称号
            </button>
          </template>
          <template v-else>
            <button
              class="action-btn unlock-btn"
              :class="getRarityClass(selectedTitle.rarity)"
              :disabled="!canUnlock"
              @click="handleUnlock"
            >
              {{ canUnlock ? '解锁称号' : '条件不足' }}
            </button>
          </template>
        </div>
      </template>
    </CommonModal>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { Medal, Castle, Scroll, Hammer, Trophy, Sparkles, Star, CheckSquare, BarChart3, Gem } from 'lucide-vue-next';
import type { Component } from 'vue';
import { useTitleStore } from '@/stores/titleStore';
import type { Title, TitleCategory, TitleRarity, TitleBonus } from '@/types/title';
import titlesConfigRaw from '@/assets/configs/titles.json5?raw';
import JSON5 from 'json5';
import CommonModal from '@/components/common/CommonModal.vue';

const titlesConfig = JSON5.parse(titlesConfigRaw) as {
  titles: Title[];
  categories: { id: string; name: string; description: string }[];
};

const titleStore = useTitleStore();

// 所有称号分类配置
const categories = titlesConfig.categories;

// 当前选中的分类（使用 'all' 作为初始值，渲染时处理）
const selectedCategory = ref<string>('phase');

// 选中的称号（用于弹窗）
const selectedTitle = ref<Title | null>(null);

// 计算属性：选中称号的图标
const selectedTitleIcon = computed(() => {
  return Medal; // 默认使用 Medal 图标
});

// 计算属性：当前装备的称号
const equippedTitle = computed(() => {
  const equipped = titleStore.equippedTitle;
  if (!equipped) return null;
  return titleStore.getTitleById(equipped.titleId);
});

const equippedTitleName = computed(() => {
  return equippedTitle.value?.name || '无';
});

// 计算属性：筛选后的称号列表
const filteredTitles = computed(() => {
  if (selectedCategory.value === 'all') {
    return titleStore.allTitles;
  }
  return titleStore.allTitles.filter((t: Title) => t.category === selectedCategory.value);
});

// 计算属性：选中的称号是否可以解锁
const canUnlock = computed(() => {
  if (!selectedTitle.value) return false;
  const result = titleStore.checkUnlockRequirements(selectedTitle.value.id);
  return result.canUnlock;
});

// 计算属性：控制弹窗显示
const showTitleModal = computed({
  get: () => !!selectedTitle.value,
  set: val => {
    if (!val) selectedTitle.value = null;
  },
});

// 监听器：当 selectedTitle 变为 null 时，同步关闭弹窗
watch(selectedTitle, val => {
  if (!val && showTitleModal.value) {
    showTitleModal.value = false;
  }
});

// 生命周期
onMounted(async () => {
  await titleStore.init();
});

// 方法：获取分类图标
function getCategoryIcon(categoryId: string): Component {
  const icons: Record<string, Component> = {
    phase: BarChart3,
    sect: Castle,
    ranking: Scroll,
    life_skill: Hammer,
    achievement: Trophy,
    hidden: Sparkles,
    special: Star,
  };
  return icons[categoryId] || CheckSquare;
}

// 方法：获取分类名称
function getCategoryName(categoryId: string | TitleCategory): string {
  const category = categories.find((c: { id: string }) => c.id === categoryId);
  return category?.name || '未知分类';
}

// 方法：获取分类数量
function getCategoryCount(categoryId: string): number {
  return titleStore.allTitles.filter((t: Title) => t.category === categoryId).length;
}

// 方法：判断称号是否已装备
function isEquipped(titleId: string): boolean {
  const equipped = titleStore.equippedTitle;
  return equipped?.titleId === titleId;
}

// 方法：获取稀有度样式类
function getRarityClass(rarity: TitleRarity): string {
  const classes: Record<TitleRarity, string> = {
    common: 'rarity-common',
    rare: 'rarity-rare',
    epic: 'rarity-epic',
    legendary: 'rarity-legendary',
    mythic: 'rarity-mythic',
  };
  return classes[rarity] || 'rarity-common';
}

// 方法：获取稀有度名称
function getRarityName(rarity: TitleRarity): string {
  const names: Record<TitleRarity, string> = {
    common: '普通',
    rare: '稀有',
    epic: '珍贵',
    legendary: '传说',
    mythic: '神话',
  };
  return names[rarity] || '普通';
}

// 方法：获取属性加成文本
function getBonusText(bonus: TitleBonus): string {
  const statName = getStatName(bonus.statType);
  const value = bonus.isPercentage ? `${bonus.value}%` : bonus.value.toString();
  return `${statName}+${value}`;
}

// 方法：获取属性名称
function getStatName(statType: string): string {
  const names: Record<string, string> = {
    attack: '攻击',
    defense: '防御',
    maxHp: '生命',
    critChance: '暴击率',
    critMultiplier: '暴击伤害',
    dodgeChance: '闪避率',
    speed: '速度',
    luck: '幸运',
    energyRegen: '内力恢复',
    armorPenetration: '破防',
    vitality: '体质',
    strength: '力量',
    agility: '敏捷',
    spirit: '悟性',
    expBonus: '经验加成',
  };
  return names[statType] || statType;
}

// 方法：获取条件描述
function getRequirementText(req: { type: string; value: string | number }): string {
  switch (req.type) {
    case 'reputation_level':
      return `江湖声望等级达到${req.value}`;
    case 'level':
      return `角色等级达到${req.value}级`;
    case 'achievement':
      return `达成成就：${req.value}`;
    case 'sect_rank':
      return `门派排名达到${req.value}`;
    case 'jianghu_rank':
      return `江湖榜排名达到${req.value}`;
    case 'life_skill':
      return `生活技能达到${req.value}级`;
    default:
      return `满足条件：${req.type}`;
  }
}

// 事件处理：点击称号卡片
function handleTitleClick(title: Title) {
  selectedTitle.value = title;
}

// 事件处理：装备称号
function handleEquip() {
  if (!selectedTitle.value) return;
  titleStore.equipTitle(selectedTitle.value.id);
  const updatedTitle = titleStore.getTitleById(selectedTitle.value.id);
  if (updatedTitle) {
    selectedTitle.value = updatedTitle;
  }
}

// 事件处理：卸下称号
function handleUnequip() {
  if (!selectedTitle.value) return;
  titleStore.unequipTitle(selectedTitle.value.id);
}

// 事件处理：解锁称号
function handleUnlock() {
  if (!selectedTitle.value || !canUnlock.value) return;
  titleStore.unlockTitle(selectedTitle.value.id);
  const updatedTitle = titleStore.getTitleById(selectedTitle.value.id);
  if (updatedTitle) {
    selectedTitle.value = updatedTitle;
  }
}
</script>

<style scoped>
.title-panel {
  display: flex;
  flex-direction: column;
  gap: 24px;
  padding: 20px;
}

/* Header */
.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 24px;
  padding-bottom: 20px;
  border-bottom: 1px solid rgba(17, 17, 17, 0.08);
}

.panel-title h1 {
  margin: 0 0 6px 0;
  font-size: 22px;
  font-weight: 600;
  color: #0f0f0f;
  letter-spacing: -0.3px;
}

.panel-title p {
  margin: 0;
  font-size: 13px;
  color: rgba(17, 17, 17, 0.55);
}

.panel-summary {
  display: flex;
  gap: 20px;
}

.summary-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 100px;
  text-align: right;
}

.summary-label {
  font-size: 10px;
  letter-spacing: 1.6px;
  text-transform: uppercase;
  color: rgba(17, 17, 17, 0.45);
}

.summary-value {
  font-size: 18px;
  font-weight: 600;
  color: #101010;
}

.summary-value.equipped {
  color: #0f0f0f;
}

/* Section Title */
.section-title {
  margin: 0 0 14px 0;
  font-size: 13px;
  font-weight: 600;
  color: #0f0f0f;
  letter-spacing: 0.5px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.section-subtitle {
  font-weight: normal;
  color: rgba(17, 17, 17, 0.5);
  font-size: 12px;
}

/* 已装备称号 */
.equipped-card {
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 24px;
  background: #fff;
  border: 2px solid #111;
  border-radius: 16px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

.equipped-card.rarity-legendary {
  border-color: #d97706;
  box-shadow: 0 4px 16px rgba(217, 119, 6, 0.15);
}

.equipped-card.rarity-mythic {
  border-color: #dc2626;
  box-shadow: 0 4px 16px rgba(220, 38, 38, 0.15);
}

.equipped-icon {
  font-size: 48px;
  width: 80px;
  height: 80px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(17, 17, 17, 0.04);
  border-radius: 16px;
}

.equipped-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.equipped-name {
  font-size: 20px;
  font-weight: 600;
  color: #0f0f0f;
}

.equipped-description {
  font-size: 13px;
  color: rgba(17, 17, 17, 0.6);
}

.equipped-bonuses {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 4px;
}

.bonus-tag {
  padding: 4px 10px;
  background: rgba(17, 17, 17, 0.06);
  border-radius: 999px;
  font-size: 11px;
  color: rgba(17, 17, 17, 0.72);
}

.unequip-btn {
  padding: 10px 20px;
  font-size: 13px;
  font-weight: 500;
  color: #666;
  background: transparent;
  border: 1px solid rgba(17, 17, 17, 0.2);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.unequip-btn:hover {
  color: #111;
  border-color: #111;
  background: rgba(17, 17, 17, 0.04);
}

/* 分类标签页 */
.category-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.category-tab {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  font-size: 13px;
  color: rgba(17, 17, 17, 0.6);
  background: rgba(255, 255, 255, 0.5);
  border: 1px solid rgba(17, 17, 17, 0.1);
  border-radius: 999px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.category-tab:hover {
  color: #111;
  border-color: rgba(17, 17, 17, 0.3);
}

.category-tab.active {
  color: #111;
  background: #fff;
  border-color: #111;
}

.tab-icon {
  width: 14px;
  height: 14px;
}

.tab-name {
  font-weight: 500;
}

.tab-count {
  padding: 2px 6px;
  background: rgba(17, 17, 17, 0.06);
  border-radius: 999px;
  font-size: 10px;
  color: rgba(17, 17, 17, 0.5);
}

/* 称号列表 */
.titles-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 12px;
}

.title-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 16px;
  background: rgba(255, 255, 255, 0.5);
  border: 1px solid rgba(17, 17, 17, 0.08);
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
  opacity: 0.7;
}

.title-card:hover {
  opacity: 1;
  border-color: rgba(17, 17, 17, 0.2);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);
}

.title-card.title-owned {
  opacity: 0.9;
  background: #fff;
  border-color: rgba(17, 17, 17, 0.12);
}

.title-card.title-equipped {
  border-color: #111;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.title-card-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.title-icon {
  font-size: 24px;
}

.title-name {
  flex: 1;
  font-size: 14px;
  font-weight: 600;
  color: #0f0f0f;
}

.title-rarity {
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 10px;
  font-weight: 600;
}

.title-rarity.rarity-common {
  background: rgba(17, 17, 17, 0.06);
  color: rgba(17, 17, 17, 0.6);
}

.title-rarity.rarity-rare {
  background: rgba(59, 130, 246, 0.1);
  color: #2563eb;
}

.title-rarity.rarity-epic {
  background: rgba(147, 51, 234, 0.1);
  color: #9333ea;
}

.title-rarity.rarity-legendary {
  background: rgba(217, 119, 6, 0.1);
  color: #d97706;
}

.title-rarity.rarity-mythic {
  background: rgba(220, 38, 38, 0.1);
  color: #dc2626;
}

.title-description {
  font-size: 12px;
  color: rgba(17, 17, 17, 0.55);
  line-height: 1.4;
}

.title-bonuses {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.bonus-item {
  padding: 2px 6px;
  background: rgba(17, 17, 17, 0.04);
  border-radius: 4px;
  font-size: 10px;
  color: rgba(17, 17, 17, 0.6);
}

.title-status {
  display: flex;
  justify-content: flex-end;
  margin-top: 4px;
}

.status-owned {
  font-size: 11px;
  color: rgba(59, 130, 246, 0.8);
}

.status-equipped {
  font-size: 11px;
  color: #111;
  font-weight: 600;
}

.status-locked {
  font-size: 11px;
  color: rgba(17, 17, 17, 0.4);
}

/* ===== CommonModal 内容样式 ===== */
.modal-description-text {
  font-size: 14px;
  color: rgba(17, 17, 17, 0.6);
  line-height: 1.6;
  margin-bottom: 16px;
}

.modal-meta {
  font-size: 13px;
  color: rgba(17, 17, 17, 0.55);
  margin-bottom: 8px;
}

.modal-meta .meta-label {
  color: rgba(17, 17, 17, 0.5);
}

.modal-section {
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid rgba(17, 17, 17, 0.08);
}

.section-heading {
  margin: 0 0 12px 0;
  font-size: 13px;
  font-weight: 600;
  color: #0f0f0f;
}

.bonuses-grid {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.bonus-item {
  display: flex;
  justify-content: space-between;
  padding: 10px 14px;
  background: rgba(17, 17, 17, 0.04);
  border-radius: 8px;
  font-size: 13px;
}

.bonus-stat {
  color: rgba(17, 17, 17, 0.6);
}

.bonus-value {
  font-weight: 600;
  color: #0f0f0f;
}

.no-items {
  font-size: 13px;
  color: rgba(17, 17, 17, 0.4);
  padding: 12px;
  text-align: center;
  background: rgba(17, 17, 17, 0.02);
  border-radius: 8px;
}

.requirements-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.requirement-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: rgba(17, 17, 17, 0.72);
}

.req-icon {
  color: rgba(17, 17, 17, 0.4);
}

/* 按钮样式 */
.action-btn {
  flex: 1;
  padding: 12px 20px;
  font-size: 14px;
  font-weight: 600;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.action-btn.confirm-btn {
  color: #fff;
  background: #111;
  border: none;
}

.action-btn.confirm-btn:hover:not(:disabled) {
  background: #333;
}

.action-btn.equipped-btn {
  color: #666;
  background: rgba(17, 17, 17, 0.06);
  border: none;
  cursor: default;
}

.action-btn.cancel-btn {
  color: #666;
  background: rgba(17, 17, 17, 0.06);
  border: 1px solid rgba(17, 17, 17, 0.15);
}

.action-btn.cancel-btn:hover {
  color: #111;
  border-color: rgba(17, 17, 17, 0.3);
}

.action-btn.unlock-btn {
  color: #fff;
  background: #16a34a;
  border: none;
}

.action-btn.unlock-btn:hover:not(:disabled) {
  background: #15803d;
}

.action-btn.unlock-btn:disabled {
  background: rgba(17, 17, 17, 0.1);
  color: rgba(17, 17, 17, 0.4);
  cursor: not-allowed;
}

/* 稀有度主题按钮 */
.action-btn.rarity-rare {
  background: #2563eb;
}

.action-btn.rarity-rare:hover:not(:disabled) {
  background: #1d4ed8;
}

.action-btn.rarity-epic {
  background: #9333ea;
}

.action-btn.rarity-epic:hover:not(:disabled) {
  background: #7c3aed;
}

.action-btn.rarity-legendary {
  background: #d97706;
}

.action-btn.rarity-legendary:hover:not(:disabled) {
  background: #b45309;
}

.action-btn.rarity-mythic {
  background: #dc2626;
}

.action-btn.rarity-mythic:hover:not(:disabled) {
  background: #b91c1c;
}

.equip-btn:hover {
  background: #333;
}

.equipped-btn {
  color: #666;
  background: rgba(17, 17, 17, 0.06);
  border: none;
  cursor: default;
}

.unquip-btn {
  color: #666;
  background: transparent;
  border: 1px solid rgba(17, 17, 17, 0.2);
}

.unquip-btn:hover {
  color: #111;
  border-color: #111;
}

.unlock-btn {
  color: #fff;
  background: #2563eb;
  border: none;
}

.unlock-btn:hover:not(:disabled) {
  background: #1d4ed8;
}

.unlock-btn:disabled {
  background: rgba(17, 17, 17, 0.1);
  color: rgba(17, 17, 17, 0.4);
  cursor: not-allowed;
}
</style>
