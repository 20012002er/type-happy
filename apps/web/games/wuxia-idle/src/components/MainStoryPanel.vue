<template>
  <div class="main-story-panel">
    <header class="panel-header">
      <div class="panel-title">
        <h1>主线剧情</h1>
        <p>追寻二十年前沈府惨案的真相。</p>
      </div>
      <div class="panel-summary">
        <div class="summary-item">
          <span class="summary-label">已收集</span>
          <span class="summary-value">{{ collectedCount }}/{{ totalFragments }}</span>
        </div>
        <div class="summary-item">
          <span class="summary-label">当前章节</span>
          <span class="summary-value">{{ currentChapterName }}</span>
        </div>
      </div>
    </header>

    <nav class="view-tabs">
      <button
        class="view-tab"
        :class="{ active: currentView === 'chapters' }"
        @click="currentView = 'chapters'"
      >
        章节
      </button>
      <button
        class="view-tab"
        :class="{ active: currentView === 'fragments' }"
        @click="currentView = 'fragments'"
      >
        碎片
      </button>
      <button
        class="view-tab"
        :class="{ active: currentView === 'story' }"
        @click="currentView = 'story'"
      >
        剧情
      </button>
    </nav>

    <div
      class="empty-state"
      v-if="!isReady"
    >
      <p>主线剧情加载中...</p>
    </div>

    <!-- 章节视图 -->
    <section
      v-else-if="currentView === 'chapters'"
      class="chapter-list"
    >
      <article
        v-for="chapter in chapters"
        :key="chapter.id"
        class="chapter-card"
        :class="getChapterStatusClass(chapter.id)"
      >
        <header class="card-header">
          <div class="chapter-number">第 {{ chapter.id }} 章</div>
          <h2 class="chapter-name">{{ chapter.name }}</h2>
          <span
            class="status-pill"
            :class="getChapterStatusClass(chapter.id)"
          >
            {{ getChapterStatusLabel(chapter.id) }}
          </span>
        </header>

        <p class="chapter-description">{{ chapter.description }}</p>

        <div
          class="chapter-progress"
          v-if="getChapterStatusClass(chapter.id) !== 'locked'"
        >
          <div class="progress-info">
            <span>碎片收集进度</span>
            <span
              >{{ getChapterProgress(chapter.id).current }}/{{
                getChapterProgress(chapter.id).total
              }}</span
            >
          </div>
          <div class="progress-bar">
            <div
              class="progress-bar-fill"
              :style="{ width: getChapterProgressPercent(chapter.id) + '%' }"
            ></div>
          </div>
        </div>

        <div
          class="chapter-requirements"
          v-if="getChapterStatusClass(chapter.id) === 'locked'"
        >
          <p class="requirement-title">解锁条件：</p>
          <ul class="requirement-list">
            <li v-if="chapter.requiredLevel > 0">等级达到 {{ chapter.requiredLevel }}</li>
            <li v-if="chapter.requiredReputation > 0">
              江湖声望达到 {{ chapter.requiredReputation }}
            </li>
            <li>收集 {{ chapter.requiredFragments }} 个真相碎片</li>
          </ul>
        </div>

        <footer
          class="card-footer"
          v-if="chapter.rewards"
        >
          <span class="reward-title">章节奖励：</span>
          <span class="reward-text">{{ formatChapterRewards(chapter.rewards) }}</span>
        </footer>
      </article>
    </section>

    <!-- 碎片视图 -->
    <section
      v-else-if="currentView === 'fragments'"
      class="fragment-view"
    >
      <nav class="filter-tabs">
        <button
          class="filter-tab"
          :class="{ active: fragmentFilter === 'all' }"
          @click="fragmentFilter = 'all'"
        >
          全部 ({{ totalFragments }})
        </button>
        <button
          class="filter-tab"
          :class="{ active: fragmentFilter === 'collected' }"
          @click="fragmentFilter = 'collected'"
        >
          已收集 ({{ collectedCount }})
        </button>
        <button
          class="filter-tab"
          :class="{ active: fragmentFilter === 'available' }"
          @click="fragmentFilter = 'available'"
        >
          可收集 ({{ availableFragments.length }})
        </button>
      </nav>

      <div
        class="fragment-grid"
        v-if="filteredFragments.length > 0"
      >
        <article
          v-for="fragment in filteredFragments"
          :key="fragment.id"
          class="fragment-card"
          :class="{ collected: isCollected(fragment.id), available: isAvailable(fragment.id) }"
          @click="openFragmentDetail(fragment)"
        >
          <div
            class="fragment-category"
            :class="getCategoryClass(fragment.category)"
          >
            {{ fragment.category }}
          </div>
          <h3 class="fragment-name">{{ fragment.name }}</h3>
          <p class="fragment-description">{{ fragment.description }}</p>
          <div class="fragment-status">
            <span
              v-if="isCollected(fragment.id)"
              class="status-collected"
              >已收集</span
            >
            <span
              v-else-if="isAvailable(fragment.id)"
              class="status-available"
              >可收集</span
            >
            <span
              v-else
              class="status-locked"
              >未解锁</span
            >
          </div>
        </article>
      </div>

      <div
        v-else
        class="empty-state"
      >
        <p>{{ getEmptyMessage() }}</p>
      </div>
    </section>

    <!-- 剧情视图 -->
    <section
      v-else-if="currentView === 'story'"
      class="story-view"
    >
      <div
        class="story-intro"
        v-if="collectedFragments.length === 0"
      >
        <h2>二十年前，江南首富沈百万举办「天下第一武道会」</h2>
        <p>七位顶尖高手应邀赴会，却遭遇伏击，六人当场身亡，只有一人重伤逃脱。</p>
        <p>你的父亲，正是当年死在沈府的六位高手之一。</p>
        <p class="story-question">真相究竟是什么？是谁策划了这场血案？</p>
        <p class="story-hint">探索江湖，收集真相碎片，拼凑出被掩埋的真相。</p>
      </div>

      <div
        class="story-timeline"
        v-else
      >
        <h2>已收集的真相碎片</h2>
        <div class="timeline-list">
          <article
            v-for="(item, index) in collectedFragments"
            :key="item.fragmentId"
            class="timeline-item"
            @click="openFragmentDetailById(item.fragmentId)"
          >
            <div class="timeline-marker">{{ index + 1 }}</div>
            <div class="timeline-content">
              <h3 class="timeline-title">{{ getFragmentName(item.fragmentId) }}</h3>
              <p class="timeline-description">{{ getFragmentDescription(item.fragmentId) }}</p>
              <span class="timeline-date">{{ formatDate(item.collectedAt) }}</span>
            </div>
            <button
              class="read-button"
              v-if="!item.read"
            >
              阅读
            </button>
            <span
              class="read-badge"
              v-else
              >已读</span
            >
          </article>
        </div>
      </div>
    </section>

    <!-- 碎片详情弹窗 -->
    <CommonModal
      v-model="showFragmentDetail"
      :title="selectedFragment?.name || ''"
      :icon="getCategoryIcon(selectedFragment?.category)"
      :width="480"
      :show-footer="false"
      @close="closeFragmentDetail"
    >
      <template #default>
        <div v-if="selectedFragment">
          <div class="fragment-category-tag" :class="getCategoryClass(selectedFragment.category)">
            {{ selectedFragment.category }}
          </div>
          <p class="fragment-desc">{{ selectedFragment.description }}</p>
          <div class="story-content">
            <h3>真相内容</h3>
            <p>{{ selectedFragment.storyContent }}</p>
          </div>
          <div
            class="fragment-source"
            v-if="selectedFragment.sourceType"
          >
            <p>获取方式：{{ getSourceLabel(selectedFragment) }}</p>
          </div>
          <div
            class="fragment-hints"
            v-if="selectedFragment.hints && selectedFragment.hints.length > 0"
          >
            <h4>获取提示</h4>
            <ul>
              <li
                v-for="hint in selectedFragment.hints"
                :key="hint"
              >
                {{ hint }}
              </li>
            </ul>
          </div>
        </div>
      </template>

      <template #footer>
        <div class="modal-actions">
          <button
            class="action-button"
            @click="markAsRead"
            :disabled="isRead"
          >
            {{ isRead ? '已阅读' : '标记为已读' }}
          </button>
        </div>
      </template>
    </CommonModal>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { storeToRefs } from 'pinia';
import { Landmark, Hexagon, Gem, Swords, Anchor, Scroll } from 'lucide-vue-next';
import { useMainStoryStore } from '@/stores/mainStoryStore';
import { mainStoryService } from '@/services/mainStoryService';
import { ChapterStatus, TruthFragmentCategory } from '@/types/truthFragment';
import CommonModal from './common/CommonModal.vue';

type ViewType = 'chapters' | 'fragments' | 'story';
type FragmentFilter = 'all' | 'collected' | 'available';

const store = useMainStoryStore();
const {
  initialized,
  chapters,
  totalFragments,
  collectedCount,
  collectedFragmentIds,
  availableFragments,
  chapterStatus,
  progress,
} = storeToRefs(store);

const currentView = ref<ViewType>('chapters');
const fragmentFilter = ref<FragmentFilter>('all');
const selectedFragment = ref<TruthFragment | null>(null);
const showFragmentDetail = computed({
  get: () => selectedFragment.value !== null,
  set: (value: boolean) => {
    if (!value) {
      selectedFragment.value = null;
    }
  },
});

const isReady = computed(() => initialized.value && totalFragments.value > 0);

const collectedFragments = computed(() => {
  return collectedFragmentIds.value
    .map(id => {
      const fragment = mainStoryService.getFragment(id);
      const collected = progress.value.fragmentCollection.collectedFragments.find(
        f => f.fragmentId === id
      );
      return {
        fragmentId: id,
        collectedAt: collected?.collectedAt ?? 0,
        read: collected?.read ?? false,
        fragment,
      };
    })
    .filter(item => item.fragment);
});

const filteredFragments = computed(() => {
  const allFragments = Object.values(mainStoryService['config']?.fragments || {}).filter(Boolean);

  switch (fragmentFilter.value) {
    case 'collected':
      return allFragments.filter(f => collectedFragmentIds.value.includes(f.id));
    case 'available':
      return availableFragments.value;
    default:
      return allFragments;
  }
});

const currentChapterName = computed(() => {
  const current = store.getCurrentChapter();
  if (current) return current.name;
  const status = chapterStatus.value[1];
  if (status === ChapterStatus.LOCKED) return '未开始';
  return '序章';
});

function getChapterStatusClass(chapterId: number): string {
  return chapterStatus.value[chapterId] || ChapterStatus.LOCKED;
}

function getChapterStatusLabel(chapterId: number): string {
  const status = chapterStatus.value[chapterId];
  switch (status) {
    case ChapterStatus.COMPLETED:
      return '已完成';
    case ChapterStatus.IN_PROGRESS:
      return '进行中';
    case ChapterStatus.AVAILABLE:
      return '可进行';
    default:
      return '未解锁';
  }
}

function getChapterProgress(chapterId: number): { current: number; total: number } {
  return store.getChapterProgress(chapterId);
}

function getChapterProgressPercent(chapterId: number): number {
  const progress = getChapterProgress(chapterId);
  if (progress.total === 0) return 0;
  return Math.round((progress.current / progress.total) * 100);
}

function getCategoryClass(category: TruthFragmentCategory): string {
  const categoryMap: Record<string, string> = {
    少林: 'shaolin',
    武当: 'wudang',
    峨眉: 'emei',
    华山: 'huashan',
    丐帮: 'gaibang',
    通用: 'common',
  };
  return categoryMap[category] || 'common';
}

function getCategoryIcon(category?: TruthFragmentCategory) {
  const iconMap: Record<string, typeof Scroll> = {
    少林: Landmark,
    武当: Hexagon,
    峨眉: Gem,
    华山: Swords,
    丐帮: Anchor,
    通用: Scroll,
  };
  return category ? (iconMap[category] || Scroll) : Scroll;
}

function isCollected(fragmentId: string): boolean {
  return collectedFragmentIds.value.includes(fragmentId);
}

function isAvailable(fragmentId: string): boolean {
  return availableFragments.value.some(f => f.id === fragmentId);
}

function getFragmentName(fragmentId: string): string {
  const fragment = mainStoryService.getFragment(fragmentId);
  return fragment?.name || '未知碎片';
}

function getFragmentDescription(fragmentId: string): string {
  const fragment = mainStoryService.getFragment(fragmentId);
  return fragment?.description || '';
}

function getEmptyMessage(): string {
  switch (fragmentFilter.value) {
    case 'collected':
      return '暂无已收集的碎片';
    case 'available':
      return '暂无可收集的碎片';
    default:
      return '暂无碎片';
  }
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function getSourceLabel(fragment: TruthFragment): string {
  const sourceLabels: Record<string, string> = {
    task_reward: '完成任务获得',
    exploration: '探索发现',
    combat_drop: '战斗掉落',
    npc_gift: 'NPC赠送',
    location_interaction: '地点互动',
    story_trigger: '剧情触发',
  };
  return sourceLabels[fragment.sourceType] || fragment.sourceType;
}

function formatChapterRewards(rewards: NonNullable<MainStoryChapter['rewards']>): string {
  const parts: string[] = [];
  if (rewards.exp) parts.push(`${rewards.exp} 经验`);
  if (rewards.gold) parts.push(`${rewards.gold} 金币`);
  if (rewards.reputation) parts.push(`${rewards.reputation} 声望`);
  if (rewards.title) parts.push(`称号「${rewards.title}」`);
  return parts.join('、');
}

function openFragmentDetail(fragment: TruthFragment): void {
  selectedFragment.value = fragment;
}

function openFragmentDetailById(fragmentId: string): void {
  const fragment = mainStoryService.getFragment(fragmentId);
  if (fragment) {
    openFragmentDetail(fragment);
  }
}

function closeFragmentDetail(): void {
  selectedFragment.value = null;
}

const isRead = computed(() => {
  if (!selectedFragment.value) return false;
  const collected = progress.value.fragmentCollection.collectedFragments.find(
    f => f.fragmentId === selectedFragment.value!.id
  );
  return collected?.read ?? false;
});

function markAsRead(): void {
  if (selectedFragment.value) {
    store.markFragmentAsRead(selectedFragment.value.id);
  }
}

onMounted(() => {
  if (!mainStoryService.isInitialized()) {
    mainStoryService.init();
  }
});
</script>

<style scoped>
.main-story-panel {
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

/* View Tabs */
.view-tabs {
  display: flex;
  gap: 8px;
  padding-bottom: 16px;
  border-bottom: 1px solid rgba(17, 17, 17, 0.08);
}

.view-tab {
  padding: 10px 20px;
  background: #fff;
  border: 1px solid rgba(17, 17, 17, 0.08);
  border-radius: 10px;
  cursor: pointer;
  font-size: 13px;
  color: rgba(17, 17, 17, 0.6);
  transition: all 0.2s ease;
}

.view-tab:hover {
  border-color: rgba(17, 17, 17, 0.2);
  background: rgba(17, 17, 17, 0.02);
}

.view-tab.active {
  background: #0f0f0f;
  border-color: #0f0f0f;
  color: #fff;
}

/* Filter Tabs */
.filter-tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
}

.filter-tab {
  padding: 8px 16px;
  background: #fff;
  border: 1px solid rgba(17, 17, 17, 0.08);
  border-radius: 8px;
  cursor: pointer;
  font-size: 12px;
  color: rgba(17, 17, 17, 0.6);
  transition: all 0.2s ease;
}

.filter-tab:hover {
  border-color: rgba(17, 17, 17, 0.2);
}

.filter-tab.active {
  background: #0f0f0f;
  border-color: #0f0f0f;
  color: #fff;
}

/* Chapter List */
.chapter-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.chapter-card {
  padding: 20px;
  background: #fff;
  border: 1px solid rgba(17, 17, 17, 0.08);
  border-radius: 12px;
  transition: all 0.2s ease;
}

.chapter-card:hover {
  border-color: rgba(17, 17, 17, 0.16);
}

.chapter-card.locked {
  opacity: 0.5;
}

.card-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.chapter-number {
  font-size: 11px;
  font-weight: 500;
  color: rgba(17, 17, 17, 0.5);
  padding: 4px 10px;
  background: rgba(17, 17, 17, 0.04);
  border-radius: 6px;
}

.chapter-name {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #0f0f0f;
  flex: 1;
}

.status-pill {
  font-size: 11px;
  font-weight: 500;
  padding: 4px 10px;
  border-radius: 6px;
  background: rgba(17, 17, 17, 0.06);
  color: rgba(17, 17, 17, 0.6);
}

.status-pill.completed {
  background: rgba(16, 185, 129, 0.1);
  color: #10b981;
}

.status-pill.in_progress,
.status-pill.available {
  background: rgba(245, 158, 11, 0.1);
  color: #f59e0b;
}

.chapter-description {
  font-size: 13px;
  color: rgba(17, 17, 17, 0.6);
  margin: 0 0 16px 0;
  line-height: 1.5;
}

.chapter-progress {
  margin-bottom: 12px;
}

.progress-info {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  margin-bottom: 8px;
}

.progress-label {
  color: rgba(17, 17, 17, 0.6);
}

.progress-value {
  color: rgba(17, 17, 17, 0.45);
}

.progress-bar {
  position: relative;
  width: 100%;
  height: 8px;
  border-radius: 999px;
  background: rgba(17, 17, 17, 0.08);
  overflow: hidden;
}

.progress-bar-fill {
  height: 100%;
  border-radius: 999px;
  background: linear-gradient(135deg, #101010, #3d3d3d);
  transition: width 0.3s ease;
}

.chapter-requirements {
  padding: 16px;
  background: rgba(17, 17, 17, 0.04);
  border-radius: 10px;
  margin-bottom: 12px;
}

.requirement-title {
  font-size: 11px;
  font-weight: 500;
  color: rgba(17, 17, 17, 0.5);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin: 0 0 10px 0;
}

.requirement-list {
  margin: 0;
  padding-left: 18px;
  font-size: 13px;
  color: rgba(17, 17, 17, 0.7);
}

.requirement-list li {
  margin-bottom: 6px;
}

.card-footer {
  padding-top: 14px;
  border-top: 1px solid rgba(17, 17, 17, 0.08);
  font-size: 13px;
}

.reward-title {
  color: rgba(17, 17, 17, 0.5);
}

.reward-text {
  color: #10b981;
  font-weight: 500;
}

/* Fragment Grid */
.fragment-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 16px;
}

.fragment-card {
  padding: 16px;
  background: #fff;
  border: 1px solid rgba(17, 17, 17, 0.08);
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.fragment-card:hover {
  border-color: rgba(17, 17, 17, 0.16);
  transform: translateY(-2px);
}

.fragment-card.available {
  border-color: rgba(245, 158, 11, 0.3);
  background: rgba(245, 158, 11, 0.02);
}

.fragment-card.collected {
  border-color: rgba(16, 185, 129, 0.3);
  background: rgba(16, 185, 129, 0.02);
}

.fragment-category {
  display: inline-block;
  font-size: 10px;
  font-weight: 500;
  padding: 4px 8px;
  border-radius: 6px;
  margin-bottom: 10px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.fragment-category.shaolin {
  background: rgba(245, 158, 11, 0.1);
  color: #d97706;
}

.fragment-category.wudang {
  background: rgba(59, 130, 246, 0.1);
  color: #2563eb;
}

.fragment-category.emei {
  background: rgba(236, 72, 153, 0.1);
  color: #db2777;
}

.fragment-category.huashan {
  background: rgba(16, 185, 129, 0.1);
  color: #059669;
}

.fragment-category.gaibang {
  background: rgba(107, 114, 128, 0.1);
  color: #4b5563;
}

.fragment-category.common {
  background: rgba(17, 17, 17, 0.06);
  color: rgba(17, 17, 17, 0.6);
}

/* fragment-category-tag 样式 - 用于弹窗内 */
.fragment-category-tag.shaolin {
  background: rgba(245, 158, 11, 0.1);
  color: #d97706;
}

.fragment-category-tag.wudang {
  background: rgba(59, 130, 246, 0.1);
  color: #2563eb;
}

.fragment-category-tag.emei {
  background: rgba(236, 72, 153, 0.1);
  color: #db2777;
}

.fragment-category-tag.huashan {
  background: rgba(16, 185, 129, 0.1);
  color: #059669;
}

.fragment-category-tag.gaibang {
  background: rgba(107, 114, 128, 0.1);
  color: #4b5563;
}

.fragment-category-tag.common {
  background: rgba(17, 17, 17, 0.08);
  color: rgba(17, 17, 17, 0.7);
}

.fragment-name {
  margin: 0 0 8px 0;
  font-size: 14px;
  font-weight: 600;
  color: #0f0f0f;
}

.fragment-description {
  font-size: 12px;
  color: rgba(17, 17, 17, 0.55);
  margin: 0 0 12px 0;
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.fragment-status {
  font-size: 11px;
  font-weight: 500;
}

.status-collected {
  color: #10b981;
}

.status-available {
  color: #f59e0b;
}

.status-locked {
  color: rgba(17, 17, 17, 0.4);
}

/* Story View */
.story-view {
  padding: 16px 0;
}

.story-intro {
  text-align: center;
  padding: 32px 24px;
  background: #fff;
  border: 1px solid rgba(17, 17, 17, 0.08);
  border-radius: 16px;
}

.story-intro h2 {
  font-size: 18px;
  font-weight: 600;
  color: #0f0f0f;
  margin: 0 0 16px 0;
  line-height: 1.4;
}

.story-intro p {
  font-size: 14px;
  color: rgba(17, 17, 17, 0.6);
  margin: 0 0 12px 0;
  line-height: 1.6;
}

.story-question {
  font-size: 16px;
  font-weight: 600;
  color: #0f0f0f !important;
  margin: 20px 0 12px 0 !important;
}

.story-hint {
  font-size: 13px;
  color: rgba(17, 17, 17, 0.4) !important;
  font-style: italic;
  margin-top: 20px !important;
}

.timeline-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.timeline-item {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  padding: 16px;
  background: #fff;
  border: 1px solid rgba(17, 17, 17, 0.08);
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.timeline-item:hover {
  border-color: rgba(17, 17, 17, 0.16);
  background: rgba(17, 17, 17, 0.02);
}

.timeline-marker {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #0f0f0f;
  color: #fff;
  border-radius: 50%;
  font-size: 14px;
  font-weight: 600;
  flex-shrink: 0;
}

.timeline-content {
  flex: 1;
  min-width: 0;
}

.timeline-title {
  margin: 0 0 6px 0;
  font-size: 14px;
  font-weight: 600;
  color: #0f0f0f;
}

.timeline-description {
  margin: 0 0 8px 0;
  font-size: 13px;
  color: rgba(17, 17, 17, 0.55);
  line-height: 1.5;
}

.timeline-date {
  font-size: 11px;
  color: rgba(17, 17, 17, 0.4);
}

.read-button {
  padding: 8px 16px;
  background: #0f0f0f;
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.read-button:hover {
  background: #333;
}

.read-badge {
  font-size: 11px;
  color: rgba(17, 17, 17, 0.4);
  padding: 8px 0;
  flex-shrink: 0;
}

/* Modal弹窗内容样式 */
.modal-actions {
  display: flex;
  justify-content: flex-end;
  width: 100%;
}

.fragment-category-tag {
  display: inline-block;
  font-size: 11px;
  font-weight: 600;
  padding: 5px 10px;
  border-radius: 6px;
  margin-bottom: 16px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.fragment-desc {
  font-size: 14px;
  color: rgba(17, 17, 17, 0.6);
  margin: 0 0 20px 0;
  line-height: 1.6;
}

.story-content {
  padding: 20px;
  background: rgba(17, 17, 17, 0.04);
  border-radius: 12px;
  margin-bottom: 20px;
}

.story-content h3 {
  margin: 0 0 12px 0;
  font-size: 14px;
  font-weight: 600;
  color: #0f0f0f;
}

.story-content p {
  margin: 0;
  font-size: 14px;
  color: rgba(17, 17, 17, 0.8);
  line-height: 1.7;
  white-space: pre-wrap;
}

.fragment-source {
  font-size: 13px;
  color: rgba(17, 17, 17, 0.5);
  margin-bottom: 16px;
}

.fragment-hints h4 {
  margin: 0 0 10px 0;
  font-size: 13px;
  font-weight: 600;
  color: rgba(17, 17, 17, 0.6);
}

.fragment-hints ul {
  margin: 0;
  padding-left: 18px;
  font-size: 14px;
  color: rgba(17, 17, 17, 0.7);
}

.fragment-hints li {
  margin-bottom: 8px;
  line-height: 1.5;
}

.action-button {
  padding: 10px 20px;
  background: #0f0f0f;
  color: #fff;
  border: none;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.action-button:hover:not(:disabled) {
  background: #333;
}

.action-button:disabled {
  background: rgba(17, 17, 17, 0.2);
  color: rgba(17, 17, 17, 0.4);
  cursor: not-allowed;
}

.empty-state {
  text-align: center;
  padding: 48px 24px;
  color: rgba(17, 17, 17, 0.45);
  font-size: 14px;
}
</style>
