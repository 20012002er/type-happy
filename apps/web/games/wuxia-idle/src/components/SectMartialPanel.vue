<template>
  <section class="sect-martial-panel">
    <header class="panel-header">
      <div>
        <h3 class="panel-title">门派武学</h3>
        <p class="panel-subtitle">随着声望与贡献提升，逐步掌握更高深的门派传承。</p>
      </div>
      <span class="panel-count">已解锁 {{ unlockedCount }}/{{ martials.length }}</span>
    </header>

    <div
      v-if="feedbackMessage"
      class="feedback-banner"
      :class="feedbackType"
    >
      {{ feedbackMessage }}
    </div>

    <div
      v-if="!martials.length"
      class="empty-state"
    >
      当前门派暂无可展示的武学。
    </div>

    <div
      v-else
      class="martial-grid"
    >
      <button
        v-for="martial in martials"
        :key="martial.id"
        class="martial-card"
        :class="[martial.tier, { unlocked: isUnlocked(martial.id) }]"
        @click="openMartialModal(martial)"
      >
        <div class="martial-tier">{{ getTierLabel(martial.tier) }}</div>
        <div class="martial-name">{{ martial.name }}</div>
        <div class="martial-desc">{{ martial.description }}</div>
        <div class="martial-status">
          {{ isUnlocked(martial.id) ? '已解锁' : getStatusText(martial.id) }}
        </div>
      </button>
    </div>

    <CommonModal
      v-model="showMartialModal"
      :title="selectedMartial?.name || '门派武学'"
      :icon="Scroll"
      :width="520"
      :confirm-text="isSelectedUnlocked ? '已解锁' : '解锁武学'"
      :confirm-disabled="!selectedMartial || isSelectedUnlocked || !selectedMartialStatus.canUnlock"
      @confirm="confirmUnlock"
      @close="selectedMartial = null"
    >
      <template #default>
        <div
          v-if="selectedMartial"
          class="modal-content"
        >
          <p class="modal-copy">{{ selectedMartial.description }}</p>
          <div class="modal-section">
            <h4 class="section-heading">效果</h4>
            <div class="tag-list">
              <span
                v-for="effect in selectedMartial.effects"
                :key="effect"
                class="tag-item"
              >
                {{ effect }}
              </span>
            </div>
          </div>
          <div class="modal-section">
            <h4 class="section-heading">解锁条件</h4>
            <div class="requirements-list">
              <div class="requirement-item">门派声望：{{ selectedMartial.unlockRequirements.minReputation }}</div>
              <div class="requirement-item">门派贡献：{{ selectedMartial.unlockRequirements.minContribution }}</div>
              <div class="requirement-item">门派等级：{{ selectedMartial.unlockRequirements.minSectLevel }}</div>
            </div>
          </div>
          <div
            v-if="!isSelectedUnlocked && selectedMartialStatus.reasons.length"
            class="modal-section"
          >
            <h4 class="section-heading">当前缺口</h4>
            <div class="requirements-list">
              <div
                v-for="reason in selectedMartialStatus.reasons"
                :key="reason"
                class="requirement-item warning"
              >
                {{ reason }}
              </div>
            </div>
          </div>
        </div>
      </template>
    </CommonModal>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { Scroll } from 'lucide-vue-next';
import CommonModal from '@/components/common/CommonModal.vue';
import { sectService } from '@/services/sectService';
import { sectMartialConfigService } from '@/services/config/SectMartialConfigService';
import { useSectStore } from '@/stores/sectStore';
import type { SectMartial } from '@/types/sectMartial';

const sectStore = useSectStore();

const martials = ref<SectMartial[]>([]);
const showMartialModal = ref(false);
const selectedMartial = ref<SectMartial | null>(null);
const selectedMartialStatus = ref<{ canUnlock: boolean; reasons: string[] }>({
  canUnlock: false,
  reasons: [],
});
const feedbackMessage = ref('');
const feedbackType = ref<'success' | 'warning'>('success');

const unlockedCount = computed(() => {
  return martials.value.filter(martial => sectStore.unlockedSkills.includes(martial.id)).length;
});

const isSelectedUnlocked = computed(() => {
  return !!selectedMartial.value && sectStore.unlockedSkills.includes(selectedMartial.value.id);
});

function setFeedback(message: string, type: 'success' | 'warning' = 'success') {
  feedbackMessage.value = message;
  feedbackType.value = type;
}

async function loadMartials() {
  martials.value = await sectService.getCurrentSectMartials();
}

function getTierLabel(tier: SectMartial['tier']): string {
  const labels: Record<SectMartial['tier'], string> = {
    basic: '基础',
    advanced: '进阶',
    ultimate: '绝学',
  };
  return labels[tier];
}

function isUnlocked(martialId: string): boolean {
  return sectStore.unlockedSkills.includes(martialId);
}

function getCurrentSnapshot() {
  return {
    currentSect: sectStore.sectType,
    reputation: sectStore.sectReputation,
    contribution: sectStore.sectContribution,
    sectLevel: sectStore.sectLevel,
    unlockedMartials: sectStore.unlockedSkills,
  };
}

function getStatusText(martialId: string): string {
  const martial = martials.value.find(item => item.id === martialId);
  if (!martial) return '未达成';

  const status = sectMartialConfigService.evaluateUnlock(martial, getCurrentSnapshot());
  return status.canUnlock ? '可解锁' : '未达成';
}

async function openMartialModal(martial: SectMartial) {
  selectedMartial.value = martial;
  selectedMartialStatus.value = sectMartialConfigService.evaluateUnlock(martial, getCurrentSnapshot());
  showMartialModal.value = true;
}

async function confirmUnlock() {
  if (!selectedMartial.value) return;

  const result = await sectService.unlockMartial(selectedMartial.value.id);
  setFeedback(result.message, result.success ? 'success' : 'warning');
  if (result.success) {
    selectedMartialStatus.value = { canUnlock: false, reasons: [] };
    showMartialModal.value = false;
  }
}

watch(
  () => sectStore.sectType,
  async () => {
    await loadMartials();
  }
);

onMounted(async () => {
  await loadMartials();
});
</script>

<style scoped>
.sect-martial-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
}

.panel-title {
  margin: 0 0 4px;
  font-size: 18px;
}

.panel-subtitle {
  margin: 0;
  font-size: 12px;
  color: rgba(17, 17, 17, 0.55);
}

.panel-count {
  font-size: 12px;
  color: rgba(17, 17, 17, 0.55);
}

.feedback-banner {
  padding: 10px 12px;
  border-radius: 10px;
  font-size: 13px;
}

.feedback-banner.success {
  background: rgba(22, 163, 74, 0.08);
  color: #166534;
}

.feedback-banner.warning {
  background: rgba(217, 119, 6, 0.08);
  color: #92400e;
}

.empty-state {
  padding: 20px;
  border-radius: 12px;
  background: rgba(17, 17, 17, 0.03);
  color: rgba(17, 17, 17, 0.6);
  text-align: center;
}

.martial-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
}

.martial-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px;
  border: 1px solid rgba(17, 17, 17, 0.08);
  border-radius: 12px;
  background: #fff;
  text-align: left;
  cursor: pointer;
}

.martial-card.basic {
  border-color: rgba(17, 17, 17, 0.08);
}

.martial-card.advanced {
  border-color: rgba(59, 130, 246, 0.18);
}

.martial-card.ultimate {
  border-color: rgba(147, 51, 234, 0.2);
}

.martial-card.unlocked {
  background: rgba(22, 163, 74, 0.04);
}

.martial-tier {
  font-size: 11px;
  color: rgba(17, 17, 17, 0.48);
  text-transform: uppercase;
}

.martial-name {
  font-size: 16px;
  font-weight: 600;
}

.martial-desc {
  font-size: 12px;
  line-height: 1.5;
  color: rgba(17, 17, 17, 0.62);
}

.martial-status {
  font-size: 12px;
  color: #0f0f0f;
}

.modal-content {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.modal-copy {
  margin: 0;
  font-size: 13px;
  line-height: 1.6;
  color: rgba(17, 17, 17, 0.72);
}

.modal-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.section-heading {
  margin: 0;
  font-size: 12px;
  color: rgba(17, 17, 17, 0.48);
  text-transform: uppercase;
}

.tag-list,
.requirements-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.tag-item,
.requirement-item {
  padding: 6px 10px;
  border-radius: 999px;
  background: rgba(17, 17, 17, 0.05);
  font-size: 12px;
}

.requirement-item.warning {
  background: rgba(217, 119, 6, 0.08);
  color: #92400e;
}
</style>
