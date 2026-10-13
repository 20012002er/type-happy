<template>
  <div class="synth-card">
    <header class="synth-header">
      <div class="header-row">
        <span class="title">⭐ 装备合成</span>
        <span v-if="preview && preview.ok && preview.goldCost" class="cost">消耗 {{ preview.goldCost }} 金币</span>
      </div>
      <p class="subtitle">选择两件相同品质的装备，合成为更高一阶的兵器。</p>
    </header>

    <div class="synth-body">
      <div class="synth-flow">
        <div class="material-select">
          <label class="material-label">材料一</label>
          <select class="material-dropdown" v-model="selectedAId">
            <option :value="''">（选择装备）</option>
            <option v-for="it in candidatesForA" :key="it.id" :value="it.id">
              {{ it.name }}
            </option>
          </select>
        </div>

        <div class="operator">+</div>

        <div class="material-select">
          <label class="material-label">材料二</label>
          <select class="material-dropdown" v-model="selectedBId">
            <option :value="''">（选择装备）</option>
            <option v-for="it in candidatesForB" :key="it.id" :value="it.id">
              {{ it.name }}
            </option>
          </select>
        </div>

        <div class="operator">→</div>

        <div class="result-preview">
          <template v-if="selectedA && selectedB">
            <div v-if="preview && preview.ok" class="preview-success">
              <strong>{{ previewName || preview.outputBlueprintId }}</strong>
              <span v-if="preview.expectedBonuses" class="bonus-line">
                {{ formatBonus(preview.expectedBonuses) }}
              </span>
            </div>
            <div v-else class="preview-fail">
              {{ preview?.reason || '暂不可合成' }}
            </div>
          </template>
          <div v-else class="preview-empty">等待选择...</div>
        </div>

        <button class="synth-btn" :disabled="!canDoSynthesize" @click="onSynthesize">
          合成
        </button>
      </div>

      <p v-if="resultMsg" class="result-msg">{{ resultMsg }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useEquipmentStore } from '@/stores/equipmentStore';
import type { Item } from '@/types/equipment';
import { getBlueprint } from '@/services/config/EquipmentBlueprintService';

const es = useEquipmentStore();

const candidates = computed<Item[]>(() => (es.inventory || []).filter(it => !!it.blueprintId));

const selectedAId = ref<string>('');
const selectedBId = ref<string>('');

const selectedA = computed<Item | undefined>(() => candidates.value.find(i => i.id === selectedAId.value));
const selectedB = computed<Item | undefined>(() => candidates.value.find(i => i.id === selectedBId.value));

const candidatesForA = computed<Item[]>(() => selectedB.value ? candidates.value.filter(i => i.id !== selectedB.value!.id) : candidates.value);
const candidatesForB = computed<Item[]>(() => selectedA.value ? candidates.value.filter(i => i.id !== selectedA.value!.id) : candidates.value);

const preview = ref<{
  ok: boolean;
  reason?: string;
  outputBlueprintId?: string;
  expectedBonuses?: Record<string, number>;
  goldCost?: number;
} | null>(null);

const previewName = ref<string>('');
const resultMsg = ref<string>('');

const resetPreview = () => {
  preview.value = null;
  previewName.value = '';
};

watch([selectedAId, selectedBId], async () => {
  resultMsg.value = '';
  resetPreview();
  const a = selectedA.value;
  const b = selectedB.value;
  if (!a || !b || a.id === b.id) return;
  const p = await es.canSynthesize(a, b);
  preview.value = p as any;
  if (p && p.ok && p.outputBlueprintId) {
    const bp = await getBlueprint(p.outputBlueprintId);
    if (bp) previewName.value = bp.name;
  }
});

const canDoSynthesize = computed<boolean>(() => {
  if (!selectedA.value || !selectedB.value) return false;
  if (selectedA.value.id === selectedB.value.id) return false;
  return !!(preview.value && preview.value.ok);
});

const formatBonus = (bonuses: Record<string, number>) => {
  const parts: string[] = [];
  if (bonuses.attack) parts.push(`攻+${bonuses.attack}`);
  if (bonuses.defense) parts.push(`防+${bonuses.defense}`);
  if (bonuses.hp) parts.push(`命+${bonuses.hp}`);
  return parts.join(' ');
};

const onSynthesize = async () => {
  const a = selectedA.value;
  const b = selectedB.value;
  if (!a || !b) return;
  const res = await es.synthesize(a, b);
  resultMsg.value = res.message;
  if (res.success) {
    selectedAId.value = '';
    selectedBId.value = '';
    resetPreview();
  }
};
</script>

<style scoped>
.synth-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
  background: #fff;
  border: 1px solid rgba(17, 17, 17, 0.12);
  border-radius: 12px;
  padding: 14px 16px;
  min-width: 0;
}

.synth-header {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

.title {
  font-size: 14px;
  font-weight: 600;
  color: #111;
}

.cost {
  font-size: 12px;
  color: rgba(17, 17, 17, 0.55);
}

.subtitle {
  margin: 0;
  font-size: 12px;
  color: rgba(17, 17, 17, 0.55);
}

.synth-body {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.synth-flow {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.material-select {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 180px;
}

.material-label {
  font-size: 12px;
  color: rgba(17, 17, 17, 0.55);
}

.material-dropdown {
  padding: 6px 8px;
  font-size: 12px;
  color: #111;
  border-radius: 8px;
  border: 1px solid rgba(17, 17, 17, 0.14);
  background: #fff;
  min-width: 170px;
}

.material-dropdown:focus {
  outline: none;
  border-color: rgba(17, 17, 17, 0.35);
}

.operator {
  font-size: 14px;
  font-weight: 600;
  color: rgba(17, 17, 17, 0.5);
}

.result-preview {
  flex: 1;
  min-width: 160px;
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid rgba(17, 17, 17, 0.1);
  background: rgba(249, 249, 248, 0.7);
  font-size: 12px;
  color: #111;
}

.preview-success {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.preview-success strong {
  font-weight: 600;
}

.bonus-line {
  color: rgba(17, 17, 17, 0.6);
}

.preview-fail {
  color: rgba(179, 38, 30, 0.78);
}

.preview-empty {
  color: rgba(17, 17, 17, 0.45);
  font-style: italic;
}

.synth-btn {
  padding: 6px 16px;
  border-radius: 8px;
  border: 1px solid #111;
  background: #111;
  color: #fff;
  font-size: 12px;
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;
  white-space: nowrap;
}

.synth-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  background: rgba(17, 17, 17, 0.1);
  color: rgba(17, 17, 17, 0.4);
  border-color: rgba(17, 17, 17, 0.1);
}

.synth-btn:not(:disabled):hover {
  background: #fff;
  color: #111;
}

.result-msg {
  margin: 0;
  font-size: 11.5px;
  color: rgba(17, 17, 17, 0.7);
  padding: 6px 8px;
  border-radius: 8px;
  border: 1px solid rgba(17, 17, 17, 0.12);
  background: rgba(17, 17, 17, 0.04);
}

@media (max-width: 960px) {
  .synth-flow {
    flex-direction: column;
    align-items: stretch;
  }

  .material-select,
  .result-preview,
  .synth-btn {
    width: 100%;
  }
}
</style>
