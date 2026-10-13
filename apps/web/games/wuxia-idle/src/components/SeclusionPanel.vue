<template>
  <div class="seclusion-panel">
    <!-- 闭关进行中 -->
    <div
      v-if="isActive"
      class="active-session"
    >
      <SeclusionTimer />

      <!-- 闭关状态信息 -->
      <div class="session-info">
        <div class="seclusion-status">
          <DoorOpen class="status-icon" />
          <span class="status-text">{{ doNotDisturb ? '闭门谢客' : '对外开放' }}</span>
        </div>

        <!-- 休息提示 -->
        <div
          v-if="restPrompt.visible"
          class="rest-prompt"
        >
          <Coffee class="rest-icon" />
          <span class="rest-text">{{ restPrompt.message }}</span>
        </div>

        <!-- 叩门提示 -->
        <div
          v-if="knockPrompt.visible"
          class="knock-prompt"
        >
          <Hand class="knock-icon" />
          <span class="knock-text">{{ knockPrompt.message }}</span>
        </div>
      </div>

      <!-- 事件日志 -->
      <div
        v-if="eventHistory.length > 0"
        class="event-log"
      >
        <div class="log-title">闭关记录</div>
        <ul class="log-list">
          <li
            v-for="event in recentEvents"
            :key="event.timestamp"
            :class="['log-item', event.type]"
          >
            {{ event.message }}
          </li>
        </ul>
      </div>

      <!-- 操作按钮 -->
      <div class="action-buttons">
        <button
          class="btn-stop"
          @click="handleStop"
        >
          结束闭关
        </button>
      </div>
    </div>

    <!-- 闭关配置 -->
    <div
      v-else
      class="config-panel"
    >
      <div class="panel-header">
        <h2 class="panel-title">闭关修炼</h2>
        <p class="panel-subtitle">点香入定，心无旁骛</p>
      </div>

      <!-- 类型选择 -->
      <div class="type-section">
        <div class="section-label">
          <Scroll class="label-icon" />
          <span>选择功课</span>
        </div>
        <div class="type-cards">
          <button
            v-for="type in seclusionTypes"
            :key="type.id"
            :class="['type-card', { active: selectedType === type.id }]"
            @click="selectedType = type.id"
          >
            <div class="type-card-inner">
              <span class="type-icon">{{ type.icon }}</span>
              <div class="type-info">
                <span class="type-name">{{ t(type.name) }}</span>
                <span class="type-bonus">{{ getTypeBonus(type) }}</span>
              </div>
              <div
                v-if="selectedType === type.id"
                class="type-check"
              >
                ✓
              </div>
            </div>
          </button>
        </div>
      </div>

      <!-- 时长选择 -->
      <div class="duration-section">
        <div class="section-label">
          <Timer class="label-icon" />
          <span>选择时长</span>
        </div>
        <div class="duration-cards">
          <button
            v-for="option in durationOptions"
            :key="option.key"
            :class="['duration-card', { active: selectedDurationKey === option.key }]"
            @click="selectedDurationKey = option.key"
          >
            <div class="duration-icon">
              <Flame v-if="option.key === '一炷香' || option.key === '两炷香'" class="duration-flame" />
              <Moon v-else class="duration-moon" />
            </div>
            <span class="duration-name">{{ option.key }}</span>
            <span class="duration-time">{{ option.minutes }}分钟</span>
            <div
              v-if="selectedDurationKey === option.key"
              class="duration-check"
            >
              ✓
            </div>
          </button>
        </div>
      </div>

      <!-- 资源配置 -->
      <div class="resource-section">
        <div class="section-label">
          <Package class="label-icon" />
          <span>供奉之物（可选）</span>
          <span class="label-hint">每种+10%效率</span>
        </div>

        <div class="resource-display">
          <div
            v-for="(slot, index) in resourceSlots"
            :key="index"
            class="resource-slot-display"
            :class="{ filled: slot.itemId }"
          >
            <template v-if="slot.itemId">
              <CircleDot class="slot-icon" />
              <div class="slot-info">
                <span class="slot-name">{{ getResourceName(slot.itemId) }}</span>
                <span class="slot-qty">×{{ slot.quantity }}</span>
              </div>
              <button
                class="slot-remove"
                @click="clearSlot(index)"
              >
                ×
              </button>
            </template>
            <template v-else>
              <button
                class="slot-add"
                @click="openResourceSelector(index)"
              >
                <span class="add-icon">+</span>
                <span>供奉</span>
              </button>
            </template>
          </div>
        </div>

        <!-- 效率显示 -->
        <div
          class="efficiency-indicator"
          :class="{ boosted: hasResourceSelected }"
        >
          <div class="efficiency-bar">
            <div
              class="efficiency-fill"
              :style="{ width: `${efficiencyPercent}%` }"
            ></div>
          </div>
          <span class="efficiency-text">
            {{
              hasResourceSelected ? `效率 +${(efficiencyPercent - 100).toFixed(0)}%` : '基础效率'
            }}
          </span>
        </div>
      </div>

      <!-- 闭门谢客 -->
      <div class="dnd-section">
        <label class="dnd-toggle">
          <input
            type="checkbox"
            v-model="doNotDisturb"
          />
          <span class="toggle-slider"></span>
          <span class="toggle-label">
            <DoorOpen class="toggle-icon" />
            <span>闭门谢客</span>
          </span>
        </label>
        <p class="dnd-hint">开启后不显示打扰通知，专心修炼</p>
      </div>

      <!-- 预期收益 -->
      <div class="rewards-preview">
        <div class="rewards-header">
          <BarChart3 class="rewards-icon" />
          <span>此番预计收获</span>
        </div>
        <div class="rewards-grid">
          <div class="reward-item">
            <span class="reward-label">修为</span>
            <span class="reward-value">+{{ formatNumber(expectedExp) }}</span>
          </div>
          <div class="reward-item">
            <span class="reward-label">气血</span>
            <span class="reward-value">+{{ formatNumber(expectedHp) }}</span>
          </div>
          <div class="reward-item">
            <span class="reward-label">精力</span>
            <span class="reward-value">+{{ formatNumber(expectedEnergy) }}</span>
          </div>
          <div
            v-if="dropChance.show"
            class="reward-item special"
          >
            <span class="reward-label">{{ dropChance.label }}</span>
            <span class="reward-value">{{ dropChance.chance }}%</span>
          </div>
        </div>
      </div>

      <!-- 开始按钮 -->
      <div class="action-buttons">
        <button
          class="btn-start"
          :disabled="!canStart"
          @click="handleStart"
        >
          <Sparkles class="btn-icon" />
          <span>{{ canStart ? '开始闭关' : startBlockReason }}</span>
        </button>
      </div>
    </div>

    <!-- 资源选择弹窗 -->
    <CommonModal
      v-model="resourceSelectorVisible"
      title="选择供奉之物"
      :icon="Package"
      :width="480"
      :show-footer="false"
      @close="closeResourceSelector"
    >
      <template #default>
        <!-- 有资源时显示列表 -->
        <div
          v-if="availableResources.length > 0"
          class="resource-list"
        >
          <button
            v-for="item in availableResources"
            :key="item.id"
            :class="['resource-option', { disabled: !canUseResource(item.id) }]"
            :disabled="!canUseResource(item.id)"
            @click="selectResource(item.id)"
          >
            <Package class="option-icon" />
            <span class="option-name">{{ item.name }}</span>
            <span class="option-qty">×{{ getResourceQty(item.id) }}</span>
          </button>
        </div>
        <!-- 无资源时显示提示 -->
        <div
          v-else
          class="resource-empty"
        >
          <Mail class="empty-icon" />
          <div class="empty-text">暂无供奉之物</div>
          <div class="empty-hint">可通过采集、制造获得材料后供奉</div>
        </div>
      </template>
    </CommonModal>

    <!-- 江湖小剧场弹窗 -->
    <JianghuStoryModal
      :visible="showStoryModal"
      :story-event="storyModalData.storyEvent"
      :collectible="storyModalData.collectible"
      :exp-gained="storyModalData.expGained"
      :hp-gained="storyModalData.hpGained"
      :energy-gained="storyModalData.energyGained"
      :interrupt-count="storyModalData.interruptCount"
      :duration-minutes="storyModalData.durationMinutes"
      @close="handleStoryModalClose"
      @confirm="handleStoryModalConfirm"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { Package, Timer, Sword, Scroll, DoorOpen, Coffee, Hand, Flame, Moon, CircleDot, BarChart3, Bell, Ear, Sparkles, Mail } from 'lucide-vue-next';
import { useSeclusionStore } from '@/stores/seclusionStore';
import { useMaterialsStore } from '@/stores/materialsStore';
import { useCombatStore } from '@/stores/combatStore';
import { seclusionService } from '@/services/SeclusionService';
import { SeclusionConfigService } from '@/services/config/SeclusionConfigService';
import type { SeclusionType, SeclusionTypeDefinition, DurationOption } from '@/types/seclusion';
import SeclusionTimer from '@/components/SeclusionTimer.vue';
import JianghuStoryModal from '@/components/JianghuStoryModal.vue';
import CommonModal from './common/CommonModal.vue';
import type { JianghuStoryEvent, CollectibleDrop } from '@/types/seclusion';
import i18n from '@/locales';

const t = (key: string) => (i18n as any).global.t(key);

const seclusionStore = useSeclusionStore();
const materialsStore = useMaterialsStore();
const combatStore = useCombatStore();

// 配置数据
const seclusionTypes = ref<SeclusionTypeDefinition[]>([]);
const durationOptions = ref<{ key: string; minutes: DurationOption }[]>([]);
const durationOptionsMap = ref<Record<string, number>>({});

// 选择状态
const selectedType = ref<SeclusionType>('practice');
const selectedDurationKey = ref<string>('一炷香');
const doNotDisturb = ref(false);
const resourceSlots = ref<{ itemId: string; quantity: number }[]>([
  { itemId: '', quantity: 1 },
  { itemId: '', quantity: 1 },
]);

// 休息提示状态
const restPrompt = ref({
  visible: false,
  message: '',
  timer: null as number | null,
});

// 叩门提示状态
const knockPrompt = ref({
  visible: false,
  message: '',
  timer: null as number | null,
});

// 资源选择弹窗
const resourceSelector = ref({
  visible: false,
  slotIndex: -1,
});

// 资源选择弹窗显示状态
const resourceSelectorVisible = computed({
  get: () => resourceSelector.value.visible,
  set: (value: boolean) => {
    resourceSelector.value.visible = value;
  },
});

// 实际分钟数
const selectedDuration = computed(() => durationOptionsMap.value[selectedDurationKey.value] || 25);

// 计算属性
const isActive = computed(() => seclusionStore.isActive);
const eventHistory = computed(() => seclusionStore.eventHistory);
const recentEvents = computed(() => eventHistory.value.slice(-5).reverse());

// 江湖小剧场
const showStoryModal = ref(false);
const storyModalData = ref({
  storyEvent: null as JianghuStoryEvent | null,
  collectible: null as CollectibleDrop | null,
  expGained: 0,
  hpGained: 0,
  energyGained: 0,
  interruptCount: 0,
  durationMinutes: 25,
});

// 可用资源
const availableResources = computed(() => {
  const items: { id: string; name: string; quality: string }[] = [];
  const stacks = materialsStore.list();

  console.log('[SeclusionPanel] materialsStore.list():', stacks);
  console.log('[SeclusionPanel] stacks.length:', stacks.length);

  if (stacks.length === 0) {
    console.log('[SeclusionPanel] 无材料 - 需要先通过采集/制造获得材料');
    return items;
  }

  let hasAvailable = false;
  for (const stack of stacks) {
    console.log(`[SeclusionPanel] 材料: ${stack.id}, qty: ${stack.qty}, name: ${stack.name}`);
    if (stack.qty > 0) {
      hasAvailable = true;
      items.push({
        id: stack.id,
        name: stack.name || stack.id,
        quality: 'common',
      });
    }
  }

  if (!hasAvailable) {
    console.log('[SeclusionPanel] 所有材料数量都为0');
  }

  return items;
});

// 效率计算
const calculatedEfficiency = computed(() => {
  let bonusPercent = 0;
  for (const slot of resourceSlots.value) {
    if (slot.itemId && slot.quantity > 0) {
      const baseBonus = 10;
      const quantityBonus = Math.min(slot.quantity, 5) * 2;
      bonusPercent += baseBonus + quantityBonus;
    }
  }
  return 1 + bonusPercent / 100;
});

const efficiencyPercent = computed(() => calculatedEfficiency.value * 100);
const hasResourceSelected = computed(() =>
  resourceSlots.value.some(s => s.itemId && s.quantity > 0)
);

// 预期收益
const expectedExp = computed(() => {
  const type = seclusionTypes.value.find(t => t.id === selectedType.value);
  if (!type) return 0;
  const seconds = selectedDuration.value * 60;
  return Math.floor(
    type.baseExpPerTick * type.primaryBonus.multiplier * calculatedEfficiency.value * seconds
  );
});

const expectedHp = computed(() => {
  const seconds = selectedDuration.value * 60;
  return Math.floor(0.5 * calculatedEfficiency.value * seconds);
});

const expectedEnergy = computed(() => {
  const seconds = selectedDuration.value * 60;
  return Math.floor(0.3 * calculatedEfficiency.value * seconds);
});

// 掉落概率（简化显示）
const dropChance = computed(() => {
  const type = seclusionTypes.value.find(t => t.id === selectedType.value);
  if (!type) return { show: false, label: '', chance: '0' };
  const rarity = type.primaryBonus.type === 'insight' ? 'rare' : 'fine';
  return {
    show: true,
    label: rarity === 'rare' ? '绝学概率' : '上乘概率',
    chance: rarity === 'rare' ? '5' : '15',
  };
});

// 是否可以开始
const canStart = computed(() => {
  if (combatStore.inCombat) return false;
  if (isActive.value) return false;
  for (const slot of resourceSlots.value) {
    if (slot.itemId && slot.quantity > 0) {
      if (!materialsStore.has(slot.itemId, slot.quantity)) {
        return false;
      }
    }
  }
  return true;
});

const startBlockReason = computed(() => {
  if (combatStore.inCombat) return '战斗中';
  if (isActive.value) return '闭关中';
  return '资源不足';
});

// 监听闭关状态
let previousActiveState = isActive.value;

watch(
  isActive,
  (newActive, oldActive) => {
    if (oldActive && !newActive) {
      handleSessionEnd();
    }
    if (!oldActive && newActive) {
      startRestPrompts();
    }
  },
  { immediate: true }
);

function handleSessionEnd() {
  const session = seclusionStore.currentSession;
  if (!session) return;
  const durationMinutes = Math.round(session.plannedDurationMs / 60000);
  storyModalData.value = {
    storyEvent: session.storyEvent || null,
    collectible: session.collectibleDrops?.[0] || null,
    expGained: seclusionStore.accumulatedExp,
    hpGained: seclusionStore.accumulatedHp,
    energyGained: seclusionStore.accumulatedEnergy,
    interruptCount: session.interruptCount,
    durationMinutes,
  };
  showStoryModal.value = true;
}

function handleStoryModalClose() {
  showStoryModal.value = false;
}

function handleStoryModalConfirm() {
  showStoryModal.value = false;
}

// 休息提示
function startRestPrompts() {
  const prompts = [
    { time: 5, message: '小憩片刻，喝口茶' },
    { time: 15, message: '起身活动，擦擦剑' },
    { time: 25, message: '吐纳换气，调息片刻' },
    { time: 40, message: '稍作歇息，润润喉' },
  ];

  prompts.forEach(p => {
    const timer = setTimeout(
      () => {
        if (isActive.value && !seclusionStore.isPaused) {
          showRestPrompt(p.message);
        }
      },
      p.time * 60 * 1000
    ) as unknown as number;
  });
}

function showRestPrompt(message: string) {
  restPrompt.value = { visible: true, message, timer: null as number | null };
  setTimeout(() => {
    restPrompt.value.visible = false;
  }, 8000);
}

// 叩门提示（模拟外部事件）
function showKnockPrompt() {
  if (!doNotDisturb.value || !isActive.value) return;
  const messages = ['门外有人叩门', '隐约听见门外有动静', '似乎有人来访'];
  const message = messages[Math.floor(Math.random() * messages.length)];
  knockPrompt.value = { visible: true, message, timer: null as number | null };
  setTimeout(() => {
    knockPrompt.value.visible = false;
  }, 5000);
}

// 辅助函数
function getTypeBonus(type: SeclusionTypeDefinition): string {
  const bonusType = type.primaryBonus.type;
  const multiplier = type.primaryBonus.multiplier;
  const bonusNames: Record<string, string> = {
    exp: '经验',
    attribute: '属性',
    insight: '悟性',
  };
  return `${bonusNames[bonusType] || bonusType}×${multiplier}`;
}

function getResourceName(itemId: string): string {
  const material = materialsStore.getMaterial(itemId);
  return material?.name || itemId;
}

function getResourceQty(itemId: string): number {
  const material = materialsStore.getMaterial(itemId);
  return material?.qty || 0;
}

function canUseResource(itemId: string): boolean {
  return getResourceQty(itemId) > 0;
}

function formatNumber(num: number): string {
  if (num >= 1000) return (num / 1000).toFixed(1) + 'k';
  return num.toString();
}

// 资源选择
function openResourceSelector(index: number) {
  resourceSelector.value = { visible: true, slotIndex: index };
}

function closeResourceSelector() {
  resourceSelector.value = { visible: false, slotIndex: -1 };
}

function selectResource(itemId: string) {
  const idx = resourceSelector.value.slotIndex;
  if (idx >= 0 && idx < resourceSlots.value.length) {
    resourceSlots.value[idx].itemId = itemId;
    resourceSlots.value[idx].quantity = 1;
  }
  closeResourceSelector();
}

function clearSlot(index: number) {
  resourceSlots.value[index].itemId = '';
  resourceSlots.value[index].quantity = 1;
}

// 开始/停止
async function handleStart() {
  const resources = resourceSlots.value
    .filter(s => s.itemId && s.quantity > 0)
    .map(s => ({ itemId: s.itemId, quantity: s.quantity }));

  await seclusionService.startSeclusion({
    type: selectedType.value,
    durationMinutes: selectedDuration.value as DurationOption,
    resources,
    doNotDisturb: doNotDisturb.value,
  });
}

async function handleStop() {
  await seclusionService.stopSeclusion();
}

// 初始化
onMounted(async () => {
  seclusionTypes.value = await SeclusionConfigService.getSeclusionTypes();
  const options = await SeclusionConfigService.getDurationOptionsArray();
  durationOptions.value = options;
  durationOptionsMap.value = await SeclusionConfigService.getDurationOptions();

  if (options.length > 0) {
    selectedDurationKey.value = options[0].key;
  }

  // 模拟叩门事件（实际应接入通知系统）
  setInterval(() => {
    if (Math.random() < 0.1) {
      showKnockPrompt();
    }
  }, 60000);
});

onUnmounted(() => {
  if (restPrompt.value.timer) {
    clearTimeout(restPrompt.value.timer);
  }
  if (knockPrompt.value.timer) {
    clearTimeout(knockPrompt.value.timer);
  }
});
</script>

<style scoped>
.seclusion-panel {
  padding: 20px;
  background: linear-gradient(180deg, #faf9f7 0%, #f5f3ef 100%);
  min-height: 100%;
  min-width: 380px;
}

/* 头部 */
.panel-header {
  text-align: center;
  margin-bottom: 24px;
}

.panel-title {
  font-size: 1.6rem;
  font-weight: 300;
  color: #1a1a1a;
  margin: 0 0 6px 0;
  letter-spacing: 0.2em;
}

.panel-subtitle {
  font-size: 0.85rem;
  color: #888;
  margin: 0;
  letter-spacing: 0.1em;
}

/* 标签 */
.section-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.9rem;
  color: #555;
  margin-bottom: 12px;
}

.label-icon {
  width: 1rem;
  height: 1rem;
}

.label-hint {
  margin-left: auto;
  font-size: 0.75rem;
  color: #999;
}

/* 类型选择 */
.type-section {
  margin-bottom: 24px;
}

.type-cards {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.type-card {
  background: #fff;
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 12px;
  padding: 14px 16px;
  cursor: pointer;
  transition: all 0.2s ease;
  text-align: left;
}

.type-card:hover {
  border-color: rgba(0, 0, 0, 0.2);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.type-card.active {
  border-color: #1a1a1a;
  background: rgba(0, 0, 0, 0.02);
}

.type-card-inner {
  display: flex;
  align-items: center;
  gap: 12px;
}

.type-icon {
  font-size: 1.5rem;
}

.type-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.type-name {
  font-size: 1rem;
  font-weight: 500;
  color: #1a1a1a;
}

.type-bonus {
  font-size: 0.75rem;
  color: #888;
}

.type-check {
  width: 22px;
  height: 22px;
  background: #1a1a1a;
  color: #fff;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.8rem;
}

/* 时长选择 */
.duration-section {
  margin-bottom: 24px;
}

.duration-cards {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}

.duration-card {
  background: #fff;
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 12px;
  padding: 14px 10px;
  cursor: pointer;
  transition: all 0.2s ease;
  text-align: center;
  position: relative;
}

.duration-card:hover {
  border-color: rgba(0, 0, 0, 0.2);
}

.duration-card.active {
  border-color: #1a1a1a;
  background: rgba(0, 0, 0, 0.02);
}

.duration-icon {
  font-size: 1.3rem;
  margin-bottom: 6px;
}

.duration-name {
  display: block;
  font-size: 0.9rem;
  font-weight: 500;
  color: #1a1a1a;
}

.duration-time {
  display: block;
  font-size: 0.7rem;
  color: #999;
  margin-top: 2px;
}

.duration-check {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 18px;
  height: 18px;
  background: #1a1a1a;
  color: #fff;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.7rem;
}

/* 资源配置 */
.resource-section {
  margin-bottom: 24px;
}

.resource-display {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-bottom: 12px;
}

.resource-slot-display {
  background: #fff;
  border: 1px dashed rgba(0, 0, 0, 0.2);
  border-radius: 10px;
  padding: 12px;
  min-height: 60px;
  display: flex;
  align-items: center;
  gap: 10px;
}

.resource-slot-display.filled {
  border-style: solid;
  border-color: rgba(0, 0, 0, 0.1);
}

.slot-icon {
  width: 20px;
  height: 20px;
  color: #666;
}

.slot-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.slot-name {
  font-size: 0.85rem;
  color: #1a1a1a;
}

.slot-qty {
  font-size: 0.7rem;
  color: #888;
}

.slot-remove {
  width: 24px;
  height: 24px;
  border: none;
  background: rgba(0, 0, 0, 0.06);
  border-radius: 50%;
  color: #888;
  cursor: pointer;
  font-size: 0.9rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

.slot-remove:hover {
  background: rgba(0, 0, 0, 0.12);
  color: #333;
}

.slot-add {
  width: 100%;
  height: 100%;
  border: none;
  background: transparent;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  color: #aaa;
  cursor: pointer;
  font-size: 0.85rem;
}

.slot-add:hover {
  color: #666;
}

.add-icon {
  font-size: 1.1rem;
}

/* 效率指示器 */
.efficiency-indicator {
  display: flex;
  align-items: center;
  gap: 12px;
}

.efficiency-bar {
  flex: 1;
  height: 6px;
  background: rgba(0, 0, 0, 0.08);
  border-radius: 3px;
  overflow: hidden;
}

.efficiency-fill {
  height: 100%;
  background: linear-gradient(90deg, #c4a574 0%, #a08050 100%);
  border-radius: 3px;
  transition: width 0.3s ease;
}

.efficiency-indicator.boosted .efficiency-fill {
  background: linear-gradient(90deg, #4ade80 0%, #22c55e 100%);
}

.efficiency-text {
  font-size: 0.8rem;
  color: #888;
  white-space: nowrap;
}

.efficiency-indicator.boosted .efficiency-text {
  color: #22c55e;
}

/* 闭门谢客 */
.dnd-section {
  background: #fff;
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 12px;
  padding: 14px 16px;
  margin-bottom: 24px;
}

.dnd-toggle {
  display: flex;
  align-items: center;
  gap: 12px;
  cursor: pointer;
}

.dnd-toggle input {
  display: none;
}

.toggle-slider {
  width: 44px;
  height: 24px;
  background: rgba(0, 0, 0, 0.15);
  border-radius: 12px;
  position: relative;
  transition: background 0.2s;
}

.toggle-slider::after {
  content: '';
  position: absolute;
  top: 2px;
  left: 2px;
  width: 20px;
  height: 20px;
  background: #fff;
  border-radius: 50%;
  transition: transform 0.2s;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}

.dnd-toggle input:checked + .toggle-slider {
  background: #1a1a1a;
}

.dnd-toggle input:checked + .toggle-slider::after {
  transform: translateX(20px);
}

.toggle-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.95rem;
  color: #1a1a1a;
}

.toggle-icon {
  width: 18px;
  height: 18px;
  margin-right: 4px;
}

.dnd-hint {
  margin: 10px 0 0 56px;
  font-size: 0.75rem;
  color: #999;
}

/* 预期收益 */
.rewards-preview {
  background: linear-gradient(135deg, rgba(0, 0, 0, 0.03) 0%, rgba(0, 0, 0, 0.06) 100%);
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 24px;
}

.rewards-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  font-size: 0.85rem;
  color: #666;
}

.rewards-icon {
  width: 18px;
  height: 18px;
}

.rewards-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}

.reward-item {
  text-align: center;
  padding: 10px;
  background: rgba(255, 255, 255, 0.5);
  border-radius: 8px;
}

.reward-item.special {
  background: rgba(212, 165, 116, 0.15);
}

.reward-label {
  display: block;
  font-size: 0.7rem;
  color: #888;
  margin-bottom: 4px;
}

.reward-value {
  display: block;
  font-size: 1rem;
  font-weight: 500;
  color: #1a1a1a;
}

.reward-item.special .reward-value {
  color: #a08050;
}

/* 操作按钮 */
.action-buttons {
  margin-top: 8px;
}

.btn-start,
.btn-stop {
  width: 100%;
  padding: 16px 24px;
  border: none;
  border-radius: 12px;
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
}

.btn-start {
  background: linear-gradient(135deg, #1a1a1a 0%, #333 100%);
  color: #fff;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.btn-start:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
}

.btn-start:disabled {
  background: rgba(0, 0, 0, 0.3);
  cursor: not-allowed;
}

.btn-icon {
  width: 20px;
  height: 20px;
}

.btn-stop {
  background: #fff;
  color: #1a1a1a;
  border: 1px solid rgba(0, 0, 0, 0.15);
}

/* 闭关进行中状态 */
.active-session {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.session-info {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.seclusion-status {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  background: rgba(0, 0, 0, 0.04);
  border-radius: 8px;
  font-size: 0.85rem;
  color: #666;
}

.status-icon {
  width: 18px;
  height: 18px;
  color: #666;
}

/* 休息提示 */
.rest-prompt {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  background: linear-gradient(135deg, rgba(74, 222, 128, 0.1) 0%, rgba(34, 197, 94, 0.15) 100%);
  border: 1px solid rgba(74, 222, 128, 0.3);
  border-radius: 10px;
  animation: fadeInUp 0.3s ease;
}

.rest-icon {
  width: 20px;
  height: 20px;
  color: #166534;
}

.rest-text {
  font-size: 0.9rem;
  color: #166534;
}

/* 叩门提示 */
.knock-prompt {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  background: linear-gradient(135deg, rgba(251, 191, 36, 0.1) 0%, rgba(245, 158, 11, 0.15) 100%);
  border: 1px solid rgba(251, 191, 36, 0.3);
  border-radius: 10px;
  animation: fadeInUp 0.3s ease;
}

.knock-icon {
  width: 20px;
  height: 20px;
  color: #b45309;
}

.knock-text {
  font-size: 0.9rem;
  color: #92400e;
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* 事件日志 */
.event-log {
  background: #fff;
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 10px;
  padding: 14px;
}

.log-title {
  font-size: 0.85rem;
  font-weight: 500;
  color: #666;
  margin-bottom: 10px;
}

.log-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.log-item {
  font-size: 0.8rem;
  padding: 8px 10px;
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.03);
}

.log-item.positive {
  background: rgba(74, 222, 128, 0.1);
  color: #166534;
}

.log-item.negative {
  background: rgba(239, 68, 68, 0.1);
  color: #991b1b;
}

.log-item.breakthrough {
  background: rgba(251, 191, 36, 0.15);
  color: #92400e;
}

/* 资源选择弹窗内容样式 */
.resource-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.resource-option {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  background: #f9f9f9;
  border: 1px solid rgba(0, 0, 0, 0.06);
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s;
  text-align: left;
  width: 100%;
}

.resource-option:hover:not(:disabled) {
  background: #fff;
  border-color: rgba(0, 0, 0, 0.15);
}

.resource-option:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.option-icon {
  width: 1.2rem;
  height: 1.2rem;
}

.option-name {
  flex: 1;
  font-size: 14px;
  color: #1a1a1a;
}

.option-qty {
  font-size: 13px;
  color: #888;
}

.resource-empty {
  text-align: center;
  padding: 40px 20px;
}

.empty-icon {
  width: 48px;
  height: 48px;
  color: #999;
  margin-bottom: 12px;
}

.empty-text {
  font-size: 16px;
  font-weight: 600;
  color: #1a1a1a;
  margin-bottom: 8px;
}

.empty-hint {
  font-size: 13px;
  color: #888;
}
</style>
