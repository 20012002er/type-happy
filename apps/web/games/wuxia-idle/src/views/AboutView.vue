<template>
  <div class="about-view">
    <header class="about-header">
      <h1>{{ t('ui.navigation.about') }}</h1>
      <router-link to="/" class="back-btn">返回游戏</router-link>
    </header>
    
    <main class="about-content">
      <section class="info-section">
        <h2>游戏介绍</h2>
        <p>这是一个文字优先的放置类游戏，支持多主题切换。</p>
        <p>通过简洁的黑白灰界面，专注于游戏内容本身。</p>
      </section>
      
      <section class="info-section">
        <h2>游戏特色</h2>
        <ul>
          <li>极简的黑白灰界面设计</li>
          <li>文字优先的游戏体验</li>
          <li>适合上班摸鱼的低调风格</li>
        </ul>
      </section>
      
      <section class="info-section">
        <h2>技术栈</h2>
        <ul>
          <li>Vue 3 + TypeScript</li>
          <li>Vite + Pinia</li>
          <li>Vue I18n (国际化)</li>
          <li>极简CSS设计</li>
        </ul>
      </section>
      
      <section class="info-section">
        <h2>版本信息</h2>
        <div class="version-info">
          <div class="version-item">
            <span>版本号:</span>
            <span class="mono">v0.1.0</span>
          </div>
          <div class="version-item">
            <span>构建时间:</span>
            <span class="mono">{{ new Date().toLocaleDateString() }}</span>
          </div>
          <div class="version-item">
            <span>当前主题:</span>
            <span class="mono">武侠世界</span>
          </div>
        </div>
      </section>
    </main>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
</script>

<style scoped>
.about-view {
  min-height: 100vh;
  background: var(--color-bg-primary);
  color: var(--color-text-primary);
}

.about-header {
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

.about-content {
  max-width: 800px;
  margin: 0 auto;
  padding: var(--spacing-lg);
}

.info-section {
  margin-bottom: var(--spacing-xl);
  padding-bottom: var(--spacing-lg);
  border-bottom: var(--border-width-thin) solid var(--color-border-light);
}

.info-section:last-child {
  border-bottom: none;
}

.info-section h2 {
  margin-bottom: var(--spacing-md);
  font-size: var(--font-size-lg);
}

.info-section p {
  margin-bottom: var(--spacing-sm);
  line-height: 1.6;
  color: var(--color-text-secondary);
}

.info-section ul {
  list-style: none;
  padding: 0;
}

.info-section li {
  margin-bottom: var(--spacing-sm);
  padding: var(--spacing-sm);
  border-left: var(--border-width-medium) solid var(--color-border-medium);
  background: var(--color-bg-secondary);
}

.version-info {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.version-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--spacing-sm);
  border: var(--border-width-thin) solid var(--color-border-light);
}

.mono {
  font-family: var(--font-family-mono);
  font-size: var(--font-size-sm);
  color: var(--color-text-primary);
  background: var(--color-bg-secondary);
  padding: var(--spacing-xs) var(--spacing-sm);
  border: var(--border-width-thin) solid var(--color-border-light);
}
</style>
