<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref } from 'vue'

const props = withDefaults(
  defineProps<{
    title: string
    description?: string
    lines?: readonly string[]
    confirmLabel?: string
    busy?: boolean
    error?: string
  }>(),
  { description: '', lines: () => [], confirmLabel: '确认', busy: false, error: '' },
)
const emit = defineEmits<{ cancel: []; confirm: [] }>()
const panel = ref<HTMLElement | null>(null)
const cancelButton = ref<HTMLButtonElement | null>(null)
let previousFocus: HTMLElement | null = null

function cancel(): void {
  if (!props.busy) emit('cancel')
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    event.preventDefault()
    cancel()
    return
  }
  if (event.key !== 'Tab' || !panel.value) return
  const focusable = Array.from(
    panel.value.querySelectorAll<HTMLElement>('button:not(:disabled), [href], input:not(:disabled)'),
  )
  if (focusable.length === 0) return
  const first = focusable[0]
  const last = focusable[focusable.length - 1]
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first.focus()
  }
}

onMounted(async () => {
  previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
  await nextTick()
  cancelButton.value?.focus()
})
onUnmounted(() => previousFocus?.focus())
</script>

<template>
  <Teleport to="body">
    <div class="farm-dialog__backdrop" @mousedown.self="cancel">
      <section
        ref="panel"
        class="farm-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="farm-dialog-title"
        :aria-describedby="description ? 'farm-dialog-description' : undefined"
        @keydown="onKeydown"
      >
        <p class="farm-dialog__eyebrow">FARM LEDGER · 操作复核</p>
        <h2 id="farm-dialog-title">{{ title }}</h2>
        <p v-if="description" id="farm-dialog-description">{{ description }}</p>
        <ul v-if="lines.length" class="farm-dialog__lines">
          <li v-for="line in lines" :key="line">{{ line }}</li>
        </ul>
        <p v-if="error" class="farm-dialog__error" role="alert">{{ error }}</p>
        <div class="farm-dialog__actions">
          <button ref="cancelButton" type="button" class="farm-dialog__cancel" :disabled="busy" @click="cancel">
            取消，不执行
          </button>
          <button type="button" class="farm-dialog__confirm" :disabled="busy" @click="emit('confirm')">
            {{ busy ? '正在保存…' : confirmLabel }}
          </button>
        </div>
      </section>
    </div>
  </Teleport>
</template>

<style scoped>
.farm-dialog__backdrop {
  position: fixed;
  z-index: 1000;
  inset: 0;
  display: grid;
  place-items: center;
  box-sizing: border-box;
  padding: 20px;
  background: rgb(20 34 27 / 62%);
}

.farm-dialog {
  width: min(520px, 100%);
  max-height: min(720px, calc(100vh - 40px));
  box-sizing: border-box;
  overflow-y: auto;
  padding: 30px;
  border: 2px solid #24352d;
  border-radius: 4px 20px 4px 20px;
  color: #24352d;
  background: #fffdf6;
  box-shadow: 9px 9px 0 rgb(20 34 27 / 32%);
  font-family: 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif;
}

.farm-dialog__eyebrow {
  margin: 0 0 8px;
  color: #167965;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.14em;
}

.farm-dialog h2 {
  margin: 0;
  font-family: 'STKaiti', 'KaiTi', 'FangSong', serif;
  font-size: 30px;
}

.farm-dialog p {
  line-height: 1.7;
}

.farm-dialog__lines {
  display: grid;
  gap: 9px;
  margin: 20px 0;
  padding: 16px 16px 16px 34px;
  border-top: 1px dashed #b9ab87;
  border-bottom: 1px dashed #b9ab87;
  background: #f5f0e3;
  line-height: 1.55;
}

.farm-dialog__error {
  padding: 12px;
  color: #873d2e;
  background: #fff0e9;
}

.farm-dialog__actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 24px;
}

.farm-dialog button {
  min-height: 44px;
  padding: 10px 16px;
  border: 1px solid #0d5749;
  border-radius: 7px 12px 7px 12px;
  font: inherit;
  font-weight: 750;
  cursor: pointer;
}

.farm-dialog button:focus-visible {
  outline: 3px solid #e5a929;
  outline-offset: 3px;
}

.farm-dialog button:disabled {
  opacity: 0.5;
  cursor: wait;
}

.farm-dialog__cancel {
  color: #24352d;
  background: transparent;
}

.farm-dialog__confirm {
  color: #fffdf6;
  background: #167965;
  box-shadow: 3px 3px 0 #0d5749;
}

@media (max-width: 480px) {
  .farm-dialog {
    padding: 24px 20px;
  }

  .farm-dialog__actions {
    flex-direction: column-reverse;
  }

  .farm-dialog__actions button {
    width: 100%;
  }
}

@media (prefers-reduced-motion: reduce) {
  .farm-dialog * {
    animation: none !important;
    transition: none !important;
  }
}
</style>
