<template>
  <section class="detail-card" :class="variantClass">
    <header v-if="showHeader" class="detail-card__header">
      <div class="detail-card__title">
        <slot name="icon" />
        <span>{{ title }}</span>
      </div>
      <div class="detail-card__meta">
        <slot name="meta">
          <span v-if="status" class="detail-card__status">{{ status }}</span>
          <span v-if="subtitle" class="detail-card__subtitle">{{ subtitle }}</span>
        </slot>
      </div>
    </header>

    <div class="detail-card__body">
      <slot />
    </div>

    <footer v-if="$slots.footer" class="detail-card__footer">
      <slot name="footer" />
    </footer>
  </section>
</template>

<script setup lang="ts">
import { computed, useSlots } from 'vue';

interface Props {
  title?: string;
  subtitle?: string;
  status?: string;
  dense?: boolean;
  bordered?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  title: '',
  subtitle: '',
  status: '',
  dense: false,
  bordered: true
});

const showHeader = computed(() => {
  return props.title || props.subtitle || props.status || !!useSlots().meta || !!useSlots().icon;
});

const variantClass = computed(() => ({
  'detail-card--dense': props.dense,
  'detail-card--bordered': props.bordered
}));
</script>

<style scoped>
.detail-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 20px;
  background: var(--panel-bg, #ffffff);
  color: #1a1a1a;
  border-radius: 12px;
  border: 1px solid rgba(17, 17, 17, 0.08);
  box-shadow: 0 12px 24px rgba(0, 0, 0, 0.08);
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.detail-card--dense {
  padding: 16px;
  gap: 10px;
}

.detail-card--bordered:hover {
  border-color: rgba(17, 17, 17, 0.15);
  box-shadow: 0 18px 32px rgba(0, 0, 0, 0.12);
}

.detail-card__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.detail-card__title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 18px;
  font-weight: 600;
  letter-spacing: 0.5px;
}

.detail-card__meta {
  display: flex;
  flex-direction: column;
  gap: 4px;
  align-items: flex-end;
  text-align: right;
  font-size: 13px;
  color: rgba(17, 17, 17, 0.55);
}

.detail-card__status {
  font-size: 12px;
  letter-spacing: 1px;
  text-transform: uppercase;
  color: rgba(17, 17, 17, 0.6);
}

.detail-card__subtitle {
  font-size: 12px;
  color: rgba(17, 17, 17, 0.5);
}

.detail-card__body {
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-size: 14px;
  line-height: 1.6;
  color: rgba(26, 26, 26, 0.85);
}

.detail-card__footer {
  margin-top: 4px;
}
</style>

