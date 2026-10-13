<template>
  <div class="sect-panel">
    <!-- 未加入门派 -->
    <div v-if="!sectStore.hasJoinedSect" class="not-joined">
      <Castle class="empty-icon" />
      <p class="empty-title">你还未加入任何门派</p>
      <p class="hint">{{ joinGuidance.progressText }}</p>
      <div class="join-requirement-card">
        <div class="requirement-item">
          <span class="requirement-label">当前等级</span>
          <span class="requirement-value">Lv.{{ joinGuidance.currentLevel }}</span>
        </div>
        <div class="requirement-item">
          <span class="requirement-label">解锁等级</span>
          <span class="requirement-value">Lv.{{ joinGuidance.requiredLevel }}</span>
        </div>
        <div class="requirement-item">
          <span class="requirement-label">还差等级</span>
          <span class="requirement-value">{{ joinGuidance.levelsRemaining }}</span>
        </div>
      </div>
      <button
        class="btn-join"
        :disabled="!joinGuidance.canJoin"
        @click="showSelectPanel = true"
      >
        选择门派
      </button>
      <button
        v-if="!joinGuidance.canJoin"
        class="btn-guide"
        @click="goLevelUp"
      >
        前往历练
      </button>
    </div>

    <!-- 已加入门派 -->
    <div v-else class="joined">
      <div class="section-nav">
        <button
          v-for="section in sections"
          :key="section.key"
          class="section-tab"
          :class="{ active: activeSection === section.key }"
          @click="activeSection = section.key"
        >
          {{ section.label }}
        </button>
      </div>

      <!-- 门派信息 -->
      <div
        v-if="activeSection === 'overview'"
        class="sect-header"
      >
        <component :is="sectIcon" class="sect-icon" />
        <div class="sect-info">
          <h3 class="sect-name">{{ sectStore.currentSect?.name }}</h3>
          <span class="sect-style">{{ sectStore.currentSect?.style }}</span>
        </div>
        <div class="sect-level">
          <span class="level-label">门派等级</span>
          <span class="level-value">Lv.{{ sectStore.sectLevel }}</span>
        </div>
      </div>

      <!-- 属性加成 -->
      <div
        v-if="activeSection === 'overview'"
        class="bonus-section"
      >
        <h4 class="section-title">属性加成</h4>
        <div class="bonus-list">
          <div
            v-for="(value, key) in sectStore.currentSect?.baseBonus"
            :key="key"
            class="bonus-item"
          >
            <span class="bonus-name">{{ formatBonusName(key) }}</span>
            <span class="bonus-value">+{{ value }}</span>
          </div>
        </div>
      </div>

      <!-- 声望和贡献 -->
      <div
        v-if="activeSection === 'overview'"
        class="stats-section"
      >
        <div class="stat-item">
          <Star class="stat-icon" />
          <span class="stat-label">声望</span>
          <span class="stat-value">{{ sectStore.sectReputation }}</span>
        </div>
        <div class="stat-item">
          <Gem class="stat-icon" />
          <span class="stat-label">贡献</span>
          <span class="stat-value">{{ sectStore.sectContribution }}</span>
        </div>
      </div>

      <!-- 转投按钮 -->
      <div
        v-if="activeSection === 'overview'"
        class="transfer-section"
      >
        <button
          class="btn-transfer"
          :disabled="!sectStore.canTransfer"
          @click="handleTransfer"
        >
          {{ sectStore.canTransfer ? '转投其他门派' : `转投冷却中 (${sectStore.transferRemainingDays}天)` }}
        </button>
      </div>

      <SectMartialPanel v-if="activeSection === 'martials'" />
      <SectContributionPanel
        v-if="activeSection === 'contribution'"
        embedded
      />
    </div>

    <!-- 门派选择弹窗 -->
    <CommonModal
      v-model="showSelectPanel"
      :show-footer="false"
      :title="modalTitle"
      :icon="Castle"
      width="600"
    >
      <SectSelectPanel
        :mode="modalMode"
        :current-sect-type="sectStore.sectType"
        @joined="onJoined"
        @close="showSelectPanel = false"
      />
    </CommonModal>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { Castle, Hexagon, Sword, Cross, Home, Star, Gem, Beer } from 'lucide-vue-next';
import type { Component } from 'vue';
import { useSectStore } from '@/stores/sectStore';
import { usePlayerStore } from '@/stores/playerStore';
import CommonModal from '@/components/common/CommonModal.vue';
import SectSelectPanel from './SectSelectPanel.vue';
import SectMartialPanel from './SectMartialPanel.vue';
import SectContributionPanel from './SectContributionPanel.vue';
import { getSectJoinGuidance } from '@/utils/sectJoinGuidance';
import { getSectPanelSections, type SectPanelSectionKey } from './sectPanelSections';

const emit = defineEmits<{
  (e: 'quick-nav', target: string): void;
}>();

const sectStore = useSectStore();
const playerStore = usePlayerStore();
const showSelectPanel = ref(false);
const activeSection = ref<SectPanelSectionKey>('overview');
const modalMode = computed<'join' | 'transfer'>(() =>
  sectStore.hasJoinedSect ? 'transfer' : 'join'
);
const modalTitle = computed(() => (modalMode.value === 'transfer' ? '转投门派' : '选择门派'));

// 玩家等级
const playerLevel = computed(() => playerStore.player.stats.level);
const joinGuidance = computed(() => getSectJoinGuidance(playerLevel.value, 10));
const sections = getSectPanelSections();

// 门派图标
const sectIcons: Record<string, Component> = {
  shaolin: Castle,
  wudang: Hexagon,
  emei: Sword,
  huashan: Cross,
  gaibang: Beer,
};

const sectIcon = computed(() => {
  if (!sectStore.sectType) return Home;
  return sectIcons[sectStore.sectType] || Home;
});

// 格式化加成名称
function formatBonusName(key: string): string {
  const bonusNames: Record<string, string> = {
    attack: '攻击',
    defense: '防御',
    hp: '生命',
    energy: '真元',
    energyRegen: '真元恢复',
    dodge: '闪避',
    crit: '暴击',
    speed: '速度',
  };
  return bonusNames[key] || key;
}

// 处理转投
function handleTransfer() {
  if (!sectStore.canTransfer) return;
  showSelectPanel.value = true;
}

function goLevelUp() {
  emit('quick-nav', 'explore');
}

// 加入门派后的回调
function onJoined() {
  showSelectPanel.value = false;
}
</script>

<style scoped>
.sect-panel {
  padding: 20px;
  height: 100%;
  overflow-y: auto;
}

/* 未加入状态 */
.not-joined {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  text-align: center;
}

.empty-icon {
  width: 64px;
  height: 64px;
  margin-bottom: 16px;
  opacity: 0.5;
}

.empty-title {
  margin: 0 0 8px 0;
  font-size: 18px;
  font-weight: 600;
  color: #0f0f0f;
}

.hint {
  margin: 0 0 24px 0;
  font-size: 14px;
  color: rgba(17, 17, 17, 0.5);
}

.join-requirement-card {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  width: 100%;
  max-width: 520px;
  margin-bottom: 20px;
}

.requirement-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 14px;
  border-radius: 12px;
  background: rgba(17, 17, 17, 0.04);
}

.requirement-label {
  font-size: 12px;
  color: rgba(17, 17, 17, 0.5);
}

.requirement-value {
  font-size: 18px;
  font-weight: 600;
  color: #0f0f0f;
}

.btn-join {
  padding: 12px 32px;
  background: #0f0f0f;
  color: #fff;
  border: none;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-join:hover {
  background: #333;
  transform: translateY(-1px);
}

.btn-join:disabled {
  background: rgba(17, 17, 17, 0.2);
  cursor: not-allowed;
  transform: none;
}

.btn-guide {
  margin-top: 12px;
  padding: 12px 32px;
  background: #fff;
  color: #0f0f0f;
  border: 1px solid rgba(17, 17, 17, 0.15);
  border-radius: 10px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-guide:hover {
  background: rgba(17, 17, 17, 0.04);
}

/* 已加入状态 */
.joined {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.section-nav {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.section-tab {
  padding: 10px 18px;
  border-radius: 999px;
  border: 1px solid rgba(17, 17, 17, 0.1);
  background: #fff;
  color: rgba(17, 17, 17, 0.72);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.section-tab.active {
  background: #0f0f0f;
  color: #fff;
  border-color: #0f0f0f;
}

/* 门派头部 */
.sect-header {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 20px;
  background: rgba(17, 17, 17, 0.03);
  border-radius: 12px;
}

.sect-icon {
  width: 48px;
  height: 48px;
}

.sect-info {
  flex: 1;
}

.sect-name {
  margin: 0 0 4px 0;
  font-size: 20px;
  font-weight: 600;
  color: #0f0f0f;
}

.sect-style {
  font-size: 13px;
  color: rgba(17, 17, 17, 0.5);
  font-style: italic;
}

.sect-level {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 8px 16px;
  background: #0f0f0f;
  border-radius: 8px;
  color: #fff;
}

.level-label {
  font-size: 10px;
  opacity: 0.7;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.level-value {
  font-size: 18px;
  font-weight: 700;
}

/* 属性加成 */
.bonus-section {
  padding: 16px;
  background: #fff;
  border: 1px solid rgba(17, 17, 17, 0.08);
  border-radius: 12px;
}

.section-title {
  margin: 0 0 12px 0;
  font-size: 12px;
  font-weight: 600;
  color: rgba(17, 17, 17, 0.5);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.bonus-list {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
}

.bonus-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: rgba(17, 17, 17, 0.03);
  border-radius: 8px;
}

.bonus-name {
  font-size: 13px;
  color: rgba(17, 17, 17, 0.7);
}

.bonus-value {
  font-size: 14px;
  font-weight: 600;
  color: #16a34a;
}

/* 声望和贡献 */
.stats-section {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 16px;
  background: #fff;
  border: 1px solid rgba(17, 17, 17, 0.08);
  border-radius: 10px;
}

.stat-icon {
  width: 20px;
  height: 20px;
}

.stat-label {
  flex: 1;
  font-size: 13px;
  color: rgba(17, 17, 17, 0.6);
}

.stat-value {
  font-size: 16px;
  font-weight: 700;
  color: #0f0f0f;
}

/* 转投按钮 */
.transfer-section {
  padding-top: 8px;
  border-top: 1px solid rgba(17, 17, 17, 0.08);
}

.btn-transfer {
  width: 100%;
  padding: 14px 20px;
  background: #fff;
  color: #0f0f0f;
  border: 2px solid rgba(17, 17, 17, 0.15);
  border-radius: 10px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-transfer:hover:not(:disabled) {
  border-color: #0f0f0f;
  background: rgba(17, 17, 17, 0.02);
}

.btn-transfer:disabled {
  background: rgba(17, 17, 17, 0.04);
  color: rgba(17, 17, 17, 0.4);
  border-color: rgba(17, 17, 17, 0.08);
  cursor: not-allowed;
}
</style>
