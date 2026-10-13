<!--
  战斗配置面板 - 简洁显示 + 弹窗编辑
-->
<template>
<div class="combat-settings-compact">
  <!-- 显示状态：只读文本 -->
  <div class="auto-group">
    <div class="auto-item" @click="openEditModal">
      <Heart class="auto-icon" />
      <span class="auto-text">{{ getHealDisplayText() }}</span>
      <button class="edit-btn">编辑</button>
    </div>

    <div class="auto-item" @click="openEditModal">
      <Zap class="auto-icon" />
      <span class="auto-text">{{ getStaminaDisplayText() }}</span>
      <button class="edit-btn">编辑</button>
    </div>

    <div class="auto-item" @click="openEditModal">
      <RefreshCw class="auto-icon" />
      <span class="auto-text">{{ getEnergyDisplayText() }}</span>
      <button class="edit-btn">编辑</button>
    </div>

    <!-- 技能槽 -->
    <div class="auto-item" @click="openSkillModal">
      <Swords class="auto-icon" />
      <span class="auto-text">{{ getSkillDisplayText() }}</span>
      <button class="edit-btn">编辑</button>
    </div>
  </div>

  <!-- 自动恢复编辑弹窗 -->
  <CommonModal
    v-model="editModalVisible"
    title="战斗自动恢复设置"
    :icon="Heart"
    :width="480"
    :show-footer="false"
  >
    <template #default>
      <!-- 回血设置 -->
      <div class="setting-section">
        <div class="section-label">
          <Heart class="label-icon" />
          <span>自动回血</span>
        </div>
        <div class="setting-row">
          <span class="setting-hint">低于</span>
          <select v-model.number="editSettings.autoHeal.threshold" class="setting-select">
            <option :value="0">-</option>
            <option :value="30">30%</option>
            <option :value="50">50%</option>
            <option :value="70">70%</option>
          </select>
          <span class="setting-hint">使用</span>
        </div>
        <div class="setting-row">
          <select v-model="editSettings.autoHeal.materialId" class="setting-select material">
            <option value="">不使用</option>
            <option v-for="m in availableHealingMaterials" :key="m.id" :value="m.id">
              {{ m.name }} +{{ m.healAmount }}HP (剩{{ m.quantity }})
            </option>
          </select>
        </div>
      </div>

      <!-- 回体设置 -->
      <div class="setting-section">
        <div class="section-label">
          <Zap class="label-icon" />
          <span>自动回体</span>
        </div>
        <div class="setting-row">
          <span class="setting-hint">低于</span>
          <select v-model.number="editSettings.autoStamina.threshold" class="setting-select">
            <option :value="0">-</option>
            <option :value="20">20%</option>
            <option :value="40">40%</option>
            <option :value="60">60%</option>
          </select>
          <span class="setting-hint">使用</span>
        </div>
        <div class="setting-row">
          <select v-model="editSettings.autoStamina.materialId" class="setting-select material">
            <option value="">不使用</option>
            <option v-for="m in availableStaminaMaterials" :key="m.id" :value="m.id">
              {{ m.name }} +{{ m.staminaAmount }} (剩{{ m.quantity }})
            </option>
          </select>
        </div>
      </div>

      <!-- 回内力设置 -->
      <div class="setting-section">
        <div class="section-label">
          <RefreshCw class="label-icon" />
          <span>自动回内力</span>
        </div>
        <div class="setting-row">
          <span class="setting-hint">低于</span>
          <select v-model.number="editSettings.autoEnergy.threshold" class="setting-select">
            <option :value="0">-</option>
            <option :value="20">20%</option>
            <option :value="40">40%</option>
            <option :value="60">60%</option>
          </select>
          <span class="setting-hint">使用</span>
        </div>
        <div class="setting-row">
          <select v-model="editSettings.autoEnergy.materialId" class="setting-select material">
            <option value="">不使用</option>
            <option v-for="m in availableEnergyMaterials" :key="m.id" :value="m.id">
              {{ m.name }} +{{ m.energyAmount }} (剩{{ m.quantity }})
            </option>
          </select>
        </div>
      </div>
    </template>

    <template #footer>
      <div class="modal-actions">
        <button class="btn-cancel" @click="editModalVisible = false">取消</button>
        <button class="btn-confirm" @click="saveFromModal">保存</button>
      </div>
    </template>
  </CommonModal>

  <!-- 技能槽编辑弹窗 -->
  <CommonModal
    v-model="skillModalVisible"
    title="自动战斗技能"
    :icon="Swords"
    :width="480"
    :show-footer="false"
  >
    <template #default>
      <div class="skill-slots-edit">
        <div v-for="(skillId, index) in editSkillSettings" :key="index" class="skill-slot-edit">
          <select v-model="editSkillSettings[index]" class="skill-select">
            <option value="">空位 {{ index + 1 }}</option>
            <option v-for="s in availableSkills" :key="s.id" :value="s.id">
              {{ s.name }}
            </option>
          </select>
          <button v-if="skillId" class="slot-remove" @click="editSkillSettings[index] = ''">×</button>
        </div>
      </div>
      <p class="skill-hint">最多选择 2 个技能</p>
    </template>

    <template #footer>
      <div class="modal-actions">
        <button class="btn-cancel" @click="skillModalVisible = false">取消</button>
        <button class="btn-confirm" @click="saveSkillSettings">保存</button>
      </div>
    </template>
  </CommonModal>
</div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { Heart, Zap, RefreshCw, Swords, X } from 'lucide-vue-next';
import { useMaterialsStore } from '@/stores/materialsStore';
import { usePlayerStore } from '@/stores/playerStore';
import { ConsumableService } from '@/services/consumableService';
import { martialService } from '@/services/martialService';
import type { Move } from '@/types/martial';
import CommonModal from '@/components/common/CommonModal.vue';

interface CombatSettings {
  autoHeal: {
    threshold: number;
    materialId: string;
  };
  autoStamina: {
    threshold: number;
    materialId: string;
  };
  autoEnergy: {
    threshold: number;
    materialId: string;
  };
  activeSkills: string[];
}

const materialsStore = useMaterialsStore();
const playerStore = usePlayerStore();

const STORAGE_KEY = 'wuxia_combat_settings';

const settings = ref<CombatSettings>({
  autoHeal: {
    threshold: 0,
    materialId: ''
  },
  autoStamina: {
    threshold: 0,
    materialId: ''
  },
  autoEnergy: {
    threshold: 0,
    materialId: ''
  },
  activeSkills: []
});

// 编辑弹窗状态
const editModalVisible = ref(false);
const editSettings = ref<CombatSettings>({ ...settings.value });

// 打开编辑弹窗
function openEditModal() {
  editSettings.value = JSON.parse(JSON.stringify(settings.value));
  editModalVisible.value = true;
}

// 保存设置
function saveFromModal() {
  settings.value = JSON.parse(JSON.stringify(editSettings.value));
  saveSettings();
  editModalVisible.value = false;
}

// 获取显示文本
function getHealDisplayText(): string {
  if (!settings.value.autoHeal.materialId) return '不自动回血';
  const m = availableHealingMaterials.value.find(m => m.id === settings.value.autoHeal.materialId);
  const threshold = settings.value.autoHeal.threshold;
  if (!m) return '不自动回血';
  return `低于${threshold || '-'}% 使用 ${m.name}`;
}

function getStaminaDisplayText(): string {
  if (!settings.value.autoStamina.materialId) return '不自动回体';
  const m = availableStaminaMaterials.value.find(m => m.id === settings.value.autoStamina.materialId);
  const threshold = settings.value.autoStamina.threshold;
  if (!m) return '不自动回体';
  return `低于${threshold || '-'}% 使用 ${m.name}`;
}

function getEnergyDisplayText(): string {
  if (!settings.value.autoEnergy.materialId) return '不自动回内力';
  const m = availableEnergyMaterials.value.find(m => m.id === settings.value.autoEnergy.materialId);
  const threshold = settings.value.autoEnergy.threshold;
  if (!m) return '不自动回内力';
  return `低于${threshold || '-'}% 使用 ${m.name}`;
}

// 技能槽弹窗状态
const skillModalVisible = ref(false);
const editSkillSettings = ref<string[]>(['', '']);

function openSkillModal() {
  editSkillSettings.value = [...settings.value.activeSkills];
  while (editSkillSettings.value.length < 2) {
    editSkillSettings.value.push('');
  }
  skillModalVisible.value = true;
}

function saveSkillSettings() {
  settings.value.activeSkills = editSkillSettings.value.filter(s => s);
  saveSettings();
  skillModalVisible.value = false;
}

function getSkillDisplayText(): string {
  const skills = settings.value.activeSkills;
  if (!skills.length) return '未装备技能';
  const names = skills.map(id => {
    const s = availableSkills.value.find(s => s.id === id);
    return s?.name || id;
  });
  return names.join('、');
}

// 所有可回血的消耗品（从配置获取）
const healingConsumables = ref<Array<{id: string; name: string; healAmount: number}>>([]);
// 所有可回体的消耗品（从配置获取）
const staminaConsumables = ref<Array<{id: string; name: string; staminaAmount: number}>>([]);
// 所有可回内力的消耗品（从配置获取）
const energyConsumables = ref<Array<{id: string; name: string; energyAmount: number}>>([]);

// 获取库存中能回血的消耗品
const availableHealingMaterials = computed(() => {
  const inventory = materialsStore.stacks;
  const result: Array<{id: string; name: string; quantity: number; healAmount: number}> = [];
  
  for (const consumable of healingConsumables.value) {
    const stack = inventory[consumable.id];
    if (stack && stack.qty > 0) {
      result.push({
        id: consumable.id,
        name: consumable.name,
        quantity: stack.qty,
        healAmount: consumable.healAmount
      });
    }
  }
  
  return result;
});

// 获取库存中能回体的消耗品
const availableStaminaMaterials = computed(() => {
  const inventory = materialsStore.stacks;
  const result: Array<{id: string; name: string; quantity: number; staminaAmount: number}> = [];
  
  for (const consumable of staminaConsumables.value) {
    const stack = inventory[consumable.id];
    if (stack && stack.qty > 0) {
      result.push({
        id: consumable.id,
        name: consumable.name,
        quantity: stack.qty,
        staminaAmount: consumable.staminaAmount
      });
    }
  }
  
  return result;
});

// 获取库存中能回内力的消耗品
const availableEnergyMaterials = computed(() => {
  const inventory = materialsStore.stacks;
  const result: Array<{id: string; name: string; quantity: number; energyAmount: number}> = [];
  
  for (const consumable of energyConsumables.value) {
    const stack = inventory[consumable.id];
    if (stack && stack.qty > 0) {
      result.push({
        id: consumable.id,
        name: consumable.name,
        quantity: stack.qty,
        energyAmount: consumable.energyAmount
      });
    }
  }
  
  return result;
});

// 可用技能列表（从已学招数里筛选）
const availableSkills = ref<Move[]>([]);
let isLoadingSkills = false;

/**
 * 检查技能是否已被选中
 */
function isSkillSelected(skillId: string, currentIndex: number): boolean {
  return settings.value.activeSkills.some((id, index) => 
    id === skillId && index !== currentIndex
  );
}

/**
 * 添加技能位
 */
function addSkillSlot(): void {
  if (settings.value.activeSkills.length < 2) {
    settings.value.activeSkills.push('');
    saveSettings();
  }
}

/**
 * 移除技能
 */
function removeSkill(index: number): void {
  settings.value.activeSkills.splice(index, 1);
  saveSettings();
}

/**
 * 根据玩家已学招数刷新技能列表
 */
async function refreshAvailableSkills(): Promise<void> {
  if (isLoadingSkills) return;
  isLoadingSkills = true;
  try {
    const player = playerStore.player;
    if (!player?.martial || (player.martial.learnedMoveIds ?? []).length === 0) {
      availableSkills.value = [];
      sanitizeActiveSkills(new Set());
    } else {
      const moves = await martialService.getLearnedMoves(player);
      availableSkills.value = moves;
      sanitizeActiveSkills(new Set(moves.map(mv => mv.id)));
    }
  } catch (error) {
    console.error('[CombatSettings] 加载技能失败:', error);
    availableSkills.value = [];
    sanitizeActiveSkills(new Set());
  } finally {
    isLoadingSkills = false;
  }
}

/**
 * 将已失效的技能槽置空
 */
function sanitizeActiveSkills(validIds: Set<string>): void {
  let changed = false;

  if (settings.value.activeSkills.length > 2) {
    settings.value.activeSkills.splice(2);
    changed = true;
  }

  for (let i = 0; i < settings.value.activeSkills.length; i++) {
    const id = settings.value.activeSkills[i];
    if (id && !validIds.has(id)) {
      settings.value.activeSkills[i] = '';
      changed = true;
    }
  }
  if (changed) saveSettings();
}

/**
 * 保存设置（自动保存）
 */
function saveSettings(): void {
  try {
    const payload: CombatSettings = {
      ...settings.value,
      activeSkills: settings.value.activeSkills.slice(0, 2)
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (error) {
    console.error('[CombatSettings] 保存失败:', error);
  }
}

/**
 * 加载设置
 */
function loadSettings(): void {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      settings.value = {
        ...settings.value,
        ...parsed,
        activeSkills: Array.isArray(parsed.activeSkills) ? parsed.activeSkills.slice(0, 2) : settings.value.activeSkills
      };
    }
    refreshAvailableSkills();
  } catch (error) {
    console.error('[CombatSettings] 加载失败:', error);
  }
}

/**
 * 加载可回血和回体的消耗品列表
 */
async function loadConsumables(): Promise<void> {
  try {
    // 加载回血物品
    const healingItems = await ConsumableService.getHealingConsumables();
    healingConsumables.value = await Promise.all(
      healingItems.map(async (item) => ({
        id: item.id,
        name: item.name,
        healAmount: await ConsumableService.getHealAmount(item.id)
      }))
    );
    console.log('[CombatSettings] 加载回血消耗品:', healingConsumables.value.length);
    
    // 加载回体物品
    const staminaItems = await ConsumableService.getStaminaConsumables();
    staminaConsumables.value = await Promise.all(
      staminaItems.map(async (item) => ({
        id: item.id,
        name: item.name,
        staminaAmount: await ConsumableService.getStaminaAmount(item.id)
      }))
    );
    console.log('[CombatSettings] 加载回体消耗品:', staminaConsumables.value.length);
    
    // 🆕 加载回内力物品
    const energyItems = await ConsumableService.getEnergyConsumables();
    energyConsumables.value = await Promise.all(
      energyItems.map(async (item) => ({
        id: item.id,
        name: item.name,
        energyAmount: await ConsumableService.getEnergyAmount(item.id)
      }))
    );
    console.log('[CombatSettings] 加载回体消耗品:', staminaConsumables.value.length);
  } catch (error) {
    console.error('[CombatSettings] 加载消耗品失败:', error);
    healingConsumables.value = [];
    staminaConsumables.value = [];
    energyConsumables.value = [];
  }
}

onMounted(() => {
  loadSettings();
  loadConsumables();
});

watch(
  () => (playerStore.player.martial?.learnedMoveIds ?? []).slice(),
  () => refreshAvailableSkills(),
  { immediate: true }
);
</script>

<style scoped>
.combat-settings-compact {
  display: grid;
  grid-template-columns: minmax(0, 0.62fr) minmax(0, 0.38fr);
  gap: 12px;
}

.auto-group {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 8px;
  align-items: center;
}

.skill-group {
  height: 100%;
  padding: 10px;
  border-radius: 10px;
  border: 1px solid rgba(17, 17, 17, 0.1);
  background: rgba(249, 249, 248, 0.55);
}

.skill-header {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12.5px;
  font-weight: 600;
  color: rgba(17, 17, 17, 0.75);
}

.skill-note {
  font-size: 11px;
  color: rgba(17, 17, 17, 0.45);
}

.skills {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.skill-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.skill-remove,
.skill-add {
  width: 24px;
  height: 24px;
  border-radius: 6px;
  border: 1px solid rgba(17, 17, 17, 0.14);
  background: #fff;
  font-size: 14px;
  cursor: pointer;
  transition: background 0.15s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.remove-icon {
  width: 14px;
  height: 14px;
}

.skill-remove:hover,
.skill-add:hover {
  background: rgba(17, 17, 17, 0.05);
}

@media (max-width: 1100px) {
  .combat-settings-compact {
    grid-template-columns: 1fr;
  }
}

/* 新样式：只读显示 + 编辑弹窗 */
.auto-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid rgba(17, 17, 17, 0.1);
  background: rgba(249, 249, 248, 0.6);
  cursor: pointer;
  transition: all 0.2s ease;
}

.auto-item:hover {
  border-color: rgba(17, 17, 17, 0.25);
  background: rgba(249, 249, 248, 0.9);
}

.auto-icon {
  width: 18px;
  height: 18px;
  color: #111;
  flex-shrink: 0;
}

.auto-text {
  flex: 1;
  font-size: 13px;
  color: rgba(17, 17, 17, 0.75);
}

.edit-btn {
  padding: 4px 10px;
  border-radius: 6px;
  border: 1px solid rgba(17, 17, 17, 0.15);
  background: #fff;
  font-size: 11px;
  color: rgba(17, 17, 17, 0.6);
  cursor: pointer;
  transition: all 0.15s ease;
}

.edit-btn:hover {
  border-color: rgba(17, 17, 17, 0.3);
  color: #111;
}

/* 弹窗内设置样式 */
.setting-section {
  margin-bottom: 20px;
}

.section-label {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 10px;
  font-size: 14px;
  font-weight: 600;
  color: #111;
}

.label-icon {
  width: 16px;
  height: 16px;
}

.setting-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.setting-hint {
  font-size: 12px;
  color: rgba(17, 17, 17, 0.55);
  white-space: nowrap;
}

.setting-select {
  padding: 8px 10px;
  border-radius: 8px;
  border: 1px solid rgba(17, 17, 17, 0.14);
  background: #fff;
  font-size: 13px;
  color: #111;
}

.setting-select.material {
  flex: 1;
}

.modal-actions {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
}

.btn-cancel {
  padding: 10px 20px;
  border-radius: 10px;
  border: 1px solid rgba(17, 17, 17, 0.15);
  background: #fff;
  font-size: 14px;
  color: rgba(17, 17, 17, 0.7);
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-cancel:hover {
  border-color: rgba(17, 17, 17, 0.3);
  color: #111;
}

.btn-confirm {
  padding: 10px 24px;
  border-radius: 10px;
  border: none;
  background: #111;
  font-size: 14px;
  font-weight: 600;
  color: #fff;
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-confirm:hover {
  background: #333;
}

/* 技能槽编辑样式 */
.skill-slots-edit {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.skill-slot-edit {
  display: flex;
  gap: 8px;
}

.skill-select {
  flex: 1;
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid rgba(17, 17, 17, 0.14);
  background: #fff;
  font-size: 13px;
}

.slot-remove {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  border: 1px solid rgba(17, 17, 17, 0.14);
  background: #fff;
  font-size: 16px;
  color: rgba(17, 17, 17, 0.5);
  cursor: pointer;
  transition: all 0.15s ease;
}

.slot-remove:hover {
  border-color: rgba(17, 17, 17, 0.3);
  color: #111;
}

.skill-hint {
  margin-top: 12px;
  font-size: 12px;
  color: rgba(17, 17, 17, 0.5);
  text-align: center;
}
</style>
