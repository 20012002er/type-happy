<template>
  <div class="settings-view">
    <header class="settings-header">
      <h1>{{ t('ui.settings.title') }}</h1>
      <router-link to="/" class="back-btn">返回游戏</router-link>
    </header>
    
    <main class="settings-content">
      <section class="setting-section">
        <h2>{{ t('ui.settings.auto_save') }}</h2>
        <div class="import-export">
          <button class="plain-btn" @click="handleExport">导出存档</button>
          <button class="plain-btn" @click="handleImport">导入存档</button>
        </div>
      </section>
      
      <section class="setting-section">
        <h2>{{ t('ui.settings.reset_game') }}</h2>
        <button class="danger-btn" @click="resetGame">
          {{ t('ui.settings.reset_game') }}
        </button>
        <p class="warning-text">
          {{ t('ui.dialogs.confirm_reset') }}
        </p>
      </section>
    </main>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { SaveManager } from '@/services/storage/SaveManager';

const { t } = useI18n();

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
.settings-view {
  min-height: 100vh;
  background: var(--color-bg-primary);
  color: var(--color-text-primary);
}
.import-export { display: flex; gap: var(--spacing-sm); }
.plain-btn { background: #fff; color: #000; border: 1px solid #000; padding: var(--spacing-xs) var(--spacing-sm); cursor: pointer; }
.plain-btn:hover { background: #fff; }

.settings-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--spacing-md);
  border-bottom: var(--border-width-thin) solid var(--color-border-medium);
}

.back-btn {
  padding: var(--spacing-sm) var(--spacing-md);
  border: var(--border-width-thin) solid var(--color-border-medium);
  background: var(--color-bg-primary);
  color: var(--color-text-primary);
  text-decoration: none;
}

.back-btn:hover {
  background: var(--color-bg-hover);
}

.settings-content {
  max-width: 600px;
  margin: 0 auto;
  padding: var(--spacing-lg);
}

.setting-section {
  margin-bottom: var(--spacing-xl);
  padding-bottom: var(--spacing-lg);
  border-bottom: var(--border-width-thin) solid var(--color-border-light);
}

.setting-section:last-child {
  border-bottom: none;
}

.setting-section h2 {
  margin-bottom: var(--spacing-md);
  font-size: var(--font-size-lg);
}

.theme-options {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.theme-option {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm);
  border: var(--border-width-thin) solid var(--color-border-light);
  cursor: pointer;
}

.theme-option:hover {
  background: var(--color-bg-hover);
}

.theme-info {
  display: flex;
  flex-direction: column;
}

.theme-info small {
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
}

.checkbox-option {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  cursor: pointer;
}

.danger-btn {
  padding: var(--spacing-sm) var(--spacing-md);
  border: var(--border-width-thin) solid var(--color-border-dark);
  background: var(--color-bg-primary);
  color: var(--color-text-primary);
  cursor: pointer;
}

.danger-btn:hover {
  background: var(--color-bg-secondary);
}

.warning-text {
  margin-top: var(--spacing-sm);
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}
</style>
