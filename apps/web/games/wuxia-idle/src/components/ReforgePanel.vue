<template>
  <div class="reforge-card">
    <header class="reforge-header">
      <div class="header-row">
        <span class="title"><Hammer class="title-icon" /> 装备洗炼</span>
        <span v-if="target" class="cost">预计花费 {{ price }} 金币</span>
      </div>
      <p class="subtitle">消耗金币重抽全部篆纹，目前版本不支持锁定词条。</p>
    </header>

    <div class="reforge-content">
      <div class="selector-group">
        <label class="selector-label" for="reforge-select">选择装备</label>
        <div class="selector-controls">
          <select id="reforge-select" v-model="selectedId" class="selector-input">
            <option value="">（选择要洗炼的装备）</option>
            <option v-for="it in candidates" :key="it.id" :value="it.id">
              {{ it.name }}（{{ it.slot }}）
            </option>
          </select>
          <button class="action-btn" :disabled="!canReforge" @click="doReforge">
            开始洗炼
          </button>
        </div>
      </div>

      <div v-if="target" class="preview-card">
        <div class="preview-row">
          <span class="label">名称</span>
          <span class="value">{{ target.name }}</span>
        </div>
        <div class="preview-row">
          <span class="label">部位</span>
          <span class="value">{{ target.slot }}</span>
        </div>
        <div class="preview-row">
          <span class="label">当前篆纹</span>
          <span class="value">{{ formattedAffixes }}</span>
        </div>
        <div class="preview-row">
          <span class="label">当前加成</span>
          <span class="value">{{ formatBonus(target) }}</span>
        </div>
      </div>

      <div v-else class="empty-preview">请选择装备查看详情和费用。</div>

      <p v-if="feedback" :class="['feedback', feedbackType]">{{ feedback }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { Hammer, RefreshCw } from 'lucide-vue-next';
import { useEquipmentStore } from '@/stores/equipmentStore';
import { ReforgeService } from '@/services/reforge/ReforgeService';
import { configService, ConfigType } from '@/services/config';

const es = useEquipmentStore();
const selectedId = ref<string>('');
const target = ref<any>(null);
const rules = ref<any>(null);
const feedback = ref('');
const feedbackType = ref<'success' | 'error'>('success');

const candidates = computed(() => es.inventory.filter(it => it.slot));

const loadRules = async () => {
  rules.value = await configService.loadConfig<any>(ConfigType.REFORGE_RULES);
};
loadRules();

watch(selectedId, () => {
  target.value = es.inventory.find(x => x.id === selectedId.value) || null;
  feedback.value = '';
});

const calcPrice = (it: any) => {
  if (!rules.value || !it) return 0;
  const count = (it.affixes?.length || 0);
  const base = rules.value?.cost?.gold?.base || 0;
  const per = rules.value?.cost?.gold?.perAffix || 0;
  return base + count * per;
};

const price = computed(() => calcPrice(target.value));
const canReforge = computed(() => Boolean(target.value));

const formattedAffixes = computed(() => {
  if (!target.value) return '—';
  const affixes = target.value.affixes || [];
  return affixes.length ? affixes.join('、') : '（无）';
});

const formatBonus = (it: any) => {
  const b = it?.bonuses || {};
  const parts: string[] = [];
  if (b.attack) parts.push(`攻+${b.attack}`);
  if (b.defense) parts.push(`防+${b.defense}`);
  if (b.hp) parts.push(`命+${b.hp}`);
  return parts.join(' ') || '—';
};

const doReforge = async () => {
  if (!selectedId.value) return;
  feedback.value = '';
  const res = await ReforgeService.reforge(selectedId.value);
  if (res.ok) {
    target.value = es.inventory.find(x => x.id === selectedId.value) || null;
    feedbackType.value = 'success';
    feedback.value = '洗炼完成，装备篆纹已刷新。';
  } else {
    feedbackType.value = 'error';
    feedback.value = res.reason || '洗炼失败，请稍后重试。';
  }
};
</script>

<style scoped>
.reforge-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
  background: #fff;
  border: 1px solid rgba(17, 17, 17, 0.12);
  border-radius: 12px;
  padding: 14px 16px;
  min-width: 0;
}

.reforge-header {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  min-width: 0;
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

.reforge-content {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.selector-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.selector-label {
  font-size: 12px;
  color: rgba(17, 17, 17, 0.55);
}

.selector-controls {
  display: flex;
  gap: 8px;
  align-items: center;
}

.selector-input {
  flex: 1;
  padding: 6px 8px;
  border: 1px solid rgba(17, 17, 17, 0.14);
  border-radius: 8px;
  background: #fff;
  font-size: 12px;
  color: #111;
}

.selector-input:focus {
  outline: none;
  border-color: rgba(17, 17, 17, 0.35);
}

.action-btn {
  padding: 6px 12px;
  border-radius: 8px;
  border: 1px solid #111;
  background: #111;
  color: #fff;
  font-size: 12px;
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;
}

.action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  background: rgba(17, 17, 17, 0.1);
  color: rgba(17, 17, 17, 0.4);
  border-color: rgba(17, 17, 17, 0.1);
}

.action-btn:not(:disabled):hover {
  background: #fff;
  color: #111;
}

.preview-card {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px 12px;
  padding: 10px 12px;
  border: 1px solid rgba(17, 17, 17, 0.1);
  border-radius: 10px;
  background: rgba(249, 249, 248, 0.7);
  font-size: 12px;
  color: #111;
}

.preview-row {
  display: contents;
}

.label {
  font-weight: 500;
  color: rgba(17, 17, 17, 0.6);
}

.value {
  color: #111;
  word-break: break-all;
}

.empty-preview {
  font-size: 12px;
  color: rgba(17, 17, 17, 0.45);
  padding: 12px;
  border: 1px dashed rgba(17, 17, 17, 0.12);
  border-radius: 10px;
  text-align: center;
}

.feedback {
  margin: 0;
  font-size: 11.5px;
  padding: 6px 8px;
  border-radius: 8px;
  border: 1px solid transparent;
}

.feedback.success {
  color: rgba(17, 17, 17, 0.7);
  border-color: rgba(17, 17, 17, 0.12);
  background: rgba(17, 17, 17, 0.04);
}

.feedback.error {
  color: #b3261e;
  border-color: rgba(179, 38, 30, 0.18);
  background: rgba(179, 38, 30, 0.08);
}

@media (max-width: 960px) {
  .selector-controls {
    flex-direction: column;
    align-items: stretch;
  }

  .action-btn {
    width: 100%;
  }

  .preview-card {
    grid-template-columns: 1fr;
  }
}
</style>
