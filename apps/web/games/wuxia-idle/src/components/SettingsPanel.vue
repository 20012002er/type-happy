<template>
  <div class="settings-panel">
    <header class="panel-header">
      <h2>{{ t('ui.settings.title') }}</h2>
    </header>
    <section class="setting-section">
      <h3>叙事模式</h3>
      <p class="hint">调整战斗日志的叙事风格</p>
      <div class="narrative-options">
        <label
          v-for="option in narrativeOptions"
          :key="option.value"
          class="radio-option"
          :class="{ active: narrativeLevel === option.value }"
        >
          <input
            type="radio"
            :value="option.value"
            v-model="narrativeLevel"
            @change="handleNarrativeChange"
          />
          <span class="option-label">{{ option.label }}</span>
          <span class="option-desc">{{ option.desc }}</span>
        </label>
      </div>
    </section>
    <section class="setting-section">
      <h3>{{ t('ui.settings.auto_save') }}</h3>
      <div class="actions">
        <button class="btn" @click="handleExport">导出存档</button>
        <button class="btn" @click="handleImport">导入存档</button>
      </div>
    </section>
    <section class="setting-section">
      <h3>{{ t('ui.settings.reset_game') }}</h3>
      <button class="btn danger" @click="resetGame">{{ t('ui.settings.reset_game') }}</button>
      <p class="hint">{{ t('ui.dialogs.confirm_reset') }}</p>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { SaveManager } from '@/services/storage/SaveManager';
import { narrativeLogService } from '@/services/NarrativeLogService';
import type { NarrativeLevel } from '@/types/narrative';

const { t } = useI18n();

// 叙事模式选项
const narrativeOptions = [
  { value: 'off', label: '关闭', desc: '原有简洁格式' },
  { value: 'brief', label: '简洁', desc: '简短的战斗描述' },
  { value: 'normal', label: '标准', desc: '适中的叙事风格' },
  { value: 'drama', label: '戏剧', desc: '小说化的详细描写' }
];

const narrativeLevel = ref<NarrativeLevel>('normal');

onMounted(async () => {
  await narrativeLogService.init();
  narrativeLevel.value = narrativeLogService.getLevel();
});

const handleNarrativeChange = () => {
  narrativeLogService.setLevel(narrativeLevel.value);
};

const handleExport = async () => {
  const mgr = new SaveManager('local');
  const payload = await mgr.export();
  const blob = new Blob([payload], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `wuxia-save-${new Date().toISOString().slice(0,10)}.save`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

const handleImport = async () => {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.save,text/plain';
  input.onchange = async () => {
    const f = input.files && input.files[0];
    if (!f) return;
    const text = await f.text();
    const mgr = new SaveManager('local');
    const ok = await mgr.import(text.trim());
    if (ok) {
      alert('存档导入成功');
      location.reload();
    } else {
      alert('存档导入失败，文件可能已损坏');
    }
  };
  input.click();
};

const resetGame = () => {
  if (confirm(t('ui.dialogs.confirm_reset'))) {
    localStorage.clear();
    location.reload();
  }
};
</script>

<style scoped>
.settings-panel { padding: 18px 20px; display: flex; flex-direction: column; gap: 16px; }
.panel-header h2 { font-size: 18px; font-weight: 700; margin: 0; }
.setting-section { border: 1px solid rgba(17,17,17,0.1); border-radius: 12px; padding: 14px; background: #fff; display: flex; flex-direction: column; gap: 10px; }
.setting-section h3 { font-size: 14px; margin: 0; }
.actions { display: flex; gap: 10px; }
.btn { border: 1px solid #111; background: #111; color: #fff; border-radius: 8px; padding: 8px 12px; cursor: pointer; font-weight: 600; font-size: 13px; }
.btn:hover { background: #fff; color: #111; }
.btn.danger { border-color: #c0392b; background: #c0392b; }
.btn.danger:hover { background: #fff; color: #c0392b; }
.hint { font-size: 12px; color: rgba(17,17,17,0.65); margin: 0; }

/* 叙事模式选项 */
.narrative-options {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.radio-option {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border: 1px solid rgba(17,17,17,0.1);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.radio-option:hover {
  border-color: rgba(17,17,17,0.2);
  background: rgba(17,17,17,0.02);
}

.radio-option.active {
  border-color: #111;
  background: rgba(17,17,17,0.04);
}

.radio-option input[type="radio"] {
  margin: 0;
  accent-color: #111;
}

.option-label {
  font-size: 14px;
  font-weight: 600;
  color: #111;
  min-width: 50px;
}

.option-desc {
  font-size: 12px;
  color: rgba(17,17,17,0.6);
}
</style>
