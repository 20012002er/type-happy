<template>
  <teleport to="body">
    <div v-show="visible" class="ctx-root" @contextmenu.prevent>
      <div class="ctx-backdrop" @click="close" @contextmenu.prevent />
      <div
        ref="menuRef"
        class="ctx-menu"
        :style="menuStyle"
        role="menu"
        @click.stop
        @contextmenu.prevent
      >
        <template v-for="(it, idx) in items" :key="it.id ?? idx">
          <div v-if="it.dividerBefore" class="ctx-divider" />
          <button
            class="ctx-item"
            :class="{ disabled: !!it.disabled, danger: !!it.danger }"
            :disabled="!!it.disabled"
            role="menuitem"
            @click="onSelect(it)"
          >
            <span class="ctx-label">{{ it.label }}</span>
            <span v-if="it.shortcut" class="ctx-shortcut">{{ it.shortcut }}</span>
          </button>
        </template>
      </div>
    </div>
  </teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue';

type MenuItem = {
  id: string
  label: string
  disabled?: boolean
  danger?: boolean
  shortcut?: string
  dividerBefore?: boolean
};

interface Props {
  visible: boolean
  items: MenuItem[]
  position: { x: number; y: number }
  width?: number
}

const props = withDefaults(defineProps<Props>(), {
  width: 200
});

const emit = defineEmits<{
  (e: 'update:visible', v: boolean): void
  (e: 'select', id: string): void
}>();

const menuRef = ref<HTMLElement | null>(null);

const close = () => emit('update:visible', false);

const clamp = (val: number, min: number, max: number) => Math.min(Math.max(val, min), max);

const menuStyle = computed(() => {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const w = props.width ?? 200;
  const h = (menuRef.value?.offsetHeight || 180);
  const margin = 8;
  const x = clamp(props.position.x, margin, vw - w - margin);
  const y = clamp(props.position.y, margin, vh - h - margin);
  return {
    position: 'fixed',
    top: `${y}px`,
    left: `${x}px`,
    width: `${w}px`
  } as Record<string, string>;
});

// 监听外部事件以关闭
const onKey = (e: KeyboardEvent) => {
  if (e.key === 'Escape') close();
};
const onScrollOrResize = () => {
  // 滚动/缩放时关闭，避免错位
  close();
};

watch(() => props.visible, async (v) => {
  if (v) await nextTick();
});

onMounted(() => {
  window.addEventListener('keydown', onKey, true);
  window.addEventListener('scroll', onScrollOrResize, true);
  window.addEventListener('resize', onScrollOrResize, true);
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey, true);
  window.removeEventListener('scroll', onScrollOrResize, true);
  window.removeEventListener('resize', onScrollOrResize, true);
});

function onSelect(it: MenuItem) {
  if (it.disabled) return;
  emit('select', it.id);
  close();
}
</script>

<style scoped>
.ctx-root {
  position: fixed;
  inset: 0;
  z-index: 1100; /* 高于 InfoPopover(1000) */
  pointer-events: none; /* 通过子层控制交互 */
}

.ctx-backdrop {
  position: absolute;
  inset: 0;
  background: transparent;
  pointer-events: auto; /* 接管外部点击以关闭 */
}

.ctx-menu {
  position: absolute;
  pointer-events: auto;
  background: #fff;
  border: 1px solid rgba(17, 17, 17, 0.16);
  border-radius: 12px;
  box-shadow: 0 18px 32px rgba(0, 0, 0, 0.08);
  padding: 6px;
}

.ctx-divider {
  height: 1px;
  background: rgba(17, 17, 17, 0.08);
  margin: 4px 6px;
}

.ctx-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  height: 34px;
  padding: 0 10px;
  border: none;
  background: transparent;
  cursor: pointer;
  border-radius: 8px;
  color: rgba(17, 17, 17, 0.9);
  font-size: 12.5px;
}

.ctx-item:hover:not(.disabled) {
  background: rgba(17, 17, 17, 0.06);
}

.ctx-item.disabled {
  color: rgba(17, 17, 17, 0.35);
  cursor: not-allowed;
}

.ctx-item.danger {
  color: #b00020;
}

.ctx-shortcut {
  color: rgba(17, 17, 17, 0.45);
  font-size: 11px;
}
</style>
