<template>
  <div class="sect-select-panel">
    <div class="panel-header">
      <h3>{{ panelTitle }}</h3>
      <p class="hint">{{ panelHint }}</p>
    </div>

    <div
      v-if="feedbackMessage"
      class="feedback-banner"
      :class="feedbackType"
    >
      {{ feedbackMessage }}
    </div>

    <div class="sects-grid">
      <div
        v-for="sect in sectConfigs"
        :key="sect.id"
        class="sect-card"
        :class="{ selected: selectedSect === sect.id }"
        @click="selectSect(sect.id)"
      >
        <component :is="getSectIcon(sect.id)" class="sect-icon" />
        <div class="sect-name">{{ sect.name }}</div>
        <div class="sect-style">{{ sect.style }}</div>
        <div class="sect-desc">{{ sect.description }}</div>
        <div class="sect-bonus">
          <span class="bonus-title">属性加成</span>
          <div class="bonus-list">
            <span v-for="(value, key) in sect.baseBonus" :key="key" class="bonus-item">
              {{ formatBonus(key) }} +{{ value }}
            </span>
          </div>
        </div>
        <div v-if="sect.lifeSkillBonus" class="sect-life-bonus">
          <span class="bonus-title">生活技能</span>
          <span class="life-bonus-item">
            {{ formatLifeBonus(sect.lifeSkillBonus) }}
          </span>
        </div>
        <div v-if="selectedSect === sect.id" class="selected-badge">已选择</div>
      </div>
    </div>

    <div class="panel-footer">
      <button class="btn-confirm" :disabled="!selectedSect" @click="confirmSelect">
        {{ confirmText }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, type Component } from 'vue';
import { Castle, Hexagon, Sword, Cross, Beer, Home } from 'lucide-vue-next';
import { sectService } from '@/services/sectService';
import { useSectStore } from '@/stores/sectStore';
import type { SectType, SectConfig } from '@/types/sect';

interface Props {
  mode?: 'join' | 'transfer';
  currentSectType?: SectType | null;
}

const props = withDefaults(defineProps<Props>(), {
  mode: 'join',
  currentSectType: null,
});

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'joined'): void;
}>();

const sectStore = useSectStore();
const sectConfigs = ref<SectConfig[]>(sectService.getAllSectConfigs());
const selectedSect = ref<SectType | null>(null);
const feedbackMessage = ref('');
const feedbackType = ref<'success' | 'warning'>('success');

const panelTitle = computed(() => (props.mode === 'transfer' ? '转投门派' : '选择门派'));
const panelHint = computed(() =>
  props.mode === 'transfer'
    ? '转投会清空旧门派的声望、贡献与武学进度。'
    : '选择后将获得门派属性加成和专属武学。'
);
const confirmText = computed(() => (props.mode === 'transfer' ? '确认转投' : '确认加入'));

const sectIcons: Record<string, Component> = {
  shaolin: Castle,
  wudang: Hexagon,
  emei: Sword,
  huashan: Cross,
  gaibang: Beer,
};

function getSectIcon(sectId: string): Component {
  return sectIcons[sectId] || Home;
}

function selectSect(sectId: string) {
  selectedSect.value = sectId as SectType;
  feedbackMessage.value = '';
}

function formatBonus(key: string): string {
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

function formatLifeBonus(bonus: { type: string; bonus: number }): string {
  const typeNames: Record<string, string> = {
    smithing: '锻造',
    alchemy: '炼丹',
    gathering: '采集',
    mining: '采矿',
    all: '全部',
  };
  const typeName = typeNames[bonus.type] || bonus.type;
  return `${typeName} +${bonus.bonus}%`;
}

async function confirmSelect() {
  if (!selectedSect.value) return;

  if (props.mode === 'transfer') {
    if (selectedSect.value === props.currentSectType) {
      feedbackType.value = 'warning';
      feedbackMessage.value = '请选择新的门派。';
      return;
    }

    const result = await sectService.transferSect(selectedSect.value, true);
    feedbackType.value = result.success ? 'success' : 'warning';
    feedbackMessage.value = result.message;
    if (!result.success) {
      return;
    }
  } else {
    sectStore.joinSect(selectedSect.value);
  }

  emit('joined');
  emit('close');
}
</script>

<style scoped>
.sect-select-panel {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 20px;
}

.panel-header {
  text-align: center;
}

.panel-header h3 {
  margin: 0 0 8px 0;
  font-size: 18px;
  font-weight: 600;
  color: #0f0f0f;
}

.hint {
  margin: 0;
  font-size: 12px;
  color: rgba(17, 17, 17, 0.5);
}

.feedback-banner {
  padding: 10px 12px;
  border-radius: 10px;
  font-size: 12px;
}

.feedback-banner.success {
  background: rgba(22, 163, 74, 0.08);
  color: #166534;
}

.feedback-banner.warning {
  background: rgba(217, 119, 6, 0.08);
  color: #92400e;
}

.sects-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 16px;
}

.sect-card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 16px;
  background: #fff;
  border: 2px solid rgba(17, 17, 17, 0.08);
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.sect-card:hover {
  border-color: rgba(17, 17, 17, 0.2);
  background: rgba(17, 17, 17, 0.02);
}

.sect-card.selected {
  border-color: #0f0f0f;
  background: rgba(17, 17, 17, 0.03);
}

.sect-icon {
  width: 32px;
  height: 32px;
  text-align: center;
}

.sect-name {
  font-size: 16px;
  font-weight: 600;
  color: #0f0f0f;
  text-align: center;
}

.sect-style {
  font-size: 11px;
  color: rgba(17, 17, 17, 0.5);
  text-align: center;
  font-style: italic;
}

.sect-desc {
  font-size: 12px;
  color: rgba(17, 17, 17, 0.6);
  text-align: center;
  line-height: 1.4;
}

.sect-bonus {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid rgba(17, 17, 17, 0.08);
}

.bonus-title {
  font-size: 10px;
  font-weight: 600;
  color: rgba(17, 17, 17, 0.45);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.bonus-list {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 4px;
}

.bonus-item {
  font-size: 11px;
  padding: 2px 6px;
  background: rgba(17, 17, 17, 0.06);
  border-radius: 4px;
  color: #0f0f0f;
}

.sect-life-bonus {
  margin-top: 4px;
}

.life-bonus-item {
  display: block;
  margin-top: 4px;
  font-size: 11px;
  padding: 2px 6px;
  background: rgba(59, 130, 246, 0.1);
  border-radius: 4px;
  color: #3b82f6;
}

.selected-badge {
  position: absolute;
  top: 8px;
  right: 8px;
  padding: 4px 8px;
  background: #0f0f0f;
  color: #fff;
  font-size: 10px;
  font-weight: 600;
  border-radius: 4px;
}

.panel-footer {
  display: flex;
  justify-content: center;
  padding-top: 8px;
  border-top: 1px solid rgba(17, 17, 17, 0.08);
}

.btn-confirm {
  padding: 12px 48px;
  background: #0f0f0f;
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-confirm:hover:not(:disabled) {
  background: #333;
}

.btn-confirm:disabled {
  background: rgba(17, 17, 17, 0.1);
  color: rgba(17, 17, 17, 0.4);
  cursor: not-allowed;
}
</style>
