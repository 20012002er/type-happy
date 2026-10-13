<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="modelValue"
        class="common-modal-overlay"
        :class="{ 'no-backdrop': !showBackdrop }"
        @click.self="handleOverlayClick"
      >
        <div
          class="common-modal"
          :class="[rarityClass, { 'has-icon': showIcon }]"
          :style="modalStyle"
        >
          <!-- 关闭按钮 -->
          <button
            v-if="closable"
            class="modal-close"
            @click="closeModal"
          >
            ×
          </button>

          <!-- 头部区域 -->
          <div
            v-if="showHeader"
            class="modal-header"
          >
            <div
              v-if="showIcon"
              class="modal-icon-wrapper"
            >
              <!-- 图标组件 -->
              <component
                v-if="showIconComponent && iconComponent"
                :is="iconComponent"
                class="modal-icon-svg"
              />
            </div>
            <div class="modal-title-section">
              <h3 class="modal-title">{{ title }}</h3>
              <span
                v-if="rarity"
                class="modal-rarity"
                :class="rarityClass"
              >
                {{ rarityText || getRarityName(rarity) }}
              </span>
            </div>
          </div>

          <!-- 描述/副标题 -->
          <div
            v-if="description"
            class="modal-description"
          >
            {{ description }}
          </div>

          <!-- 内容插槽 -->
          <div class="modal-body">
            <slot>
              <div
                v-if="!$slots.default"
                class="modal-empty"
              >
                内容区域
              </div>
            </slot>
          </div>

          <!-- 底部操作区 -->
          <div
            v-if="showFooter"
            class="modal-footer"
          >
            <slot name="footer">
              <div
                v-if="presetButtons"
                class="preset-buttons"
              >
                <button
                  v-if="showCancel"
                  class="action-btn cancel-btn"
                  @click="handleCancel"
                >
                  {{ cancelText }}
                </button>
                <button
                  v-if="showConfirm"
                  class="action-btn confirm-btn"
                  :class="confirmClass"
                  :disabled="confirmDisabled"
                  @click="handleConfirm"
                >
                  {{ confirmText }}
                </button>
              </div>
            </slot>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, watch, onMounted } from 'vue';
import type { Component } from 'vue';

export interface ModalButton {
  text: string;
  type?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
  onClick?: () => void;
}

// 图标组件（由外部传入）
const iconComponent = computed(() => props.icon as Component | null);

// 计算属性：是否应该显示图标
const showIconComponent = computed(() => {
  return props.showIcon && iconComponent.value;
});

interface Props {
  modelValue: boolean; // v-model 控制显示
  title: string; // 标题
  icon?: Component; // 图标组件
  description?: string; // 描述文字
  rarity?: 'common' | 'rare' | 'epic' | 'legendary' | 'mythic'; // 稀有度主题
  rarityText?: string; // 自定义稀有度显示文本
  width?: number | string; // 宽度
  maxWidth?: number | string; // 最大宽度
  closable?: boolean; // 是否显示关闭按钮
  closeOnOverlay?: boolean; // 点击遮罩是否关闭
  showBackdrop?: boolean; // 是否显示遮罩
  showHeader?: boolean; // 是否显示头部
  showFooter?: boolean; // 是否显示底部
  showIcon?: boolean; // 是否显示图标
  showConfirm?: boolean; // 是否显示确认按钮
  showCancel?: boolean; // 是否显示取消按钮
  confirmText?: string; // 确认按钮文字
  cancelText?: string; // 取消按钮文字
  confirmDisabled?: boolean; // 确认按钮是否禁用
  confirmClass?: string; // 确认按钮额外样式类
  presetButtons?: boolean; // 是否使用预设按钮
}

const props = withDefaults(defineProps<Props>(), {
  width: 480,
  maxWidth: '90vw',
  closable: true,
  closeOnOverlay: true,
  showBackdrop: true,
  showHeader: true,
  showFooter: true,
  showIcon: true,
  showConfirm: true,
  showCancel: true,
  confirmText: '确认',
  cancelText: '取消',
  confirmDisabled: false,
  confirmClass: '',
  presetButtons: true,
});

interface Emits {
  (e: 'update:modelValue', value: boolean): void;
  (e: 'close'): void;
  (e: 'confirm'): void;
  (e: 'cancel'): void;
}

const emit = defineEmits<Emits>();

// 计算属性：稀有度样式类
const rarityClass = computed(() => {
  if (!props.rarity) return '';
  return `rarity-${props.rarity}`;
});

// 计算属性：弹窗样式
const modalStyle = computed(() => ({
  width: typeof props.width === 'number' ? `${props.width}px` : props.width,
  maxWidth: typeof props.maxWidth === 'number' ? `${props.maxWidth}px` : props.maxWidth,
}));

// 方法：获取稀有度名称
function getRarityName(rarity: string): string {
  const names: Record<string, string> = {
    common: '普通',
    rare: '稀有',
    epic: '珍贵',
    legendary: '传说',
    mythic: '神话',
  };
  return names[rarity] || rarity;
}

// 方法：关闭弹窗
function closeModal() {
  emit('update:modelValue', false);
  emit('close');
}

// 方法：点击遮罩
function handleOverlayClick() {
  if (props.closeOnOverlay && props.closable) {
    closeModal();
  }
}

// 方法：确认
function handleConfirm() {
  emit('confirm');
}

// 方法：取消
function handleCancel() {
  emit('cancel');
  closeModal();
}

// 监听显示状态
watch(
  () => props.modelValue,
  visible => {
    if (visible) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
  }
);

// 生命周期
onMounted(() => {
  if (props.modelValue) {
    document.body.style.overflow = 'hidden';
  }
});
</script>

<style scoped>
/* 遮罩层 */
.common-modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(2px);
}

.common-modal-overlay.no-backdrop {
  background: transparent;
  backdrop-filter: none;
}

/* 弹窗主体 */
.common-modal {
  position: relative;
  width: v-bind(width);
  max-width: v-bind('maxWidth');
  max-height: calc(100vh - 40px);
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  background: #fff;
  border-radius: 20px;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.2);
  animation: modalSlideIn 0.25s ease-out;
}

.common-modal.has-icon {
  border-top: 4px solid #111;
}

.common-modal.rarity-legendary {
  border-top-color: #d97706;
}

.common-modal.rarity-mythic {
  border-top-color: #dc2626;
}

.common-modal.rarity-epic {
  border-top-color: #9333ea;
}

.common-modal.rarity-rare {
  border-top-color: #3b82f6;
}

/* 关闭按钮 */
.modal-close {
  position: absolute;
  top: 16px;
  right: 16px;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
  color: rgba(17, 17, 17, 0.5);
  background: transparent;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s ease;
  z-index: 10;
}

.modal-close:hover {
  color: #111;
  background: rgba(17, 17, 17, 0.06);
}

/* 头部区域 */
.modal-header {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 24px 28px 16px;
}

.modal-icon-wrapper {
  flex-shrink: 0;
}

.modal-icon {
  font-size: 48px;
  width: 72px;
  height: 72px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(17, 17, 17, 0.04);
  border-radius: 16px;
}

.modal-icon-svg {
  width: 48px;
  height: 48px;
  color: #111;
}

.modal-title-section {
  flex: 1;
  min-width: 0;
}

.modal-title {
  margin: 0 0 8px 0;
  font-size: 20px;
  font-weight: 600;
  color: #0f0f0f;
  line-height: 1.3;
}

.modal-rarity {
  display: inline-block;
  padding: 4px 12px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
}

.modal-rarity.rarity-common {
  background: rgba(17, 17, 17, 0.08);
  color: rgba(17, 17, 17, 0.7);
}

.modal-rarity.rarity-rare {
  background: rgba(59, 130, 246, 0.12);
  color: #2563eb;
}

.modal-rarity.rarity-epic {
  background: rgba(147, 51, 234, 0.12);
  color: #9333ea;
}

.modal-rarity.rarity-legendary {
  background: rgba(217, 119, 6, 0.12);
  color: #d97706;
}

.modal-rarity.rarity-mythic {
  background: rgba(220, 38, 38, 0.12);
  color: #dc2626;
}

/* 描述文字 */
.modal-description {
  padding: 0 28px 16px;
  font-size: 14px;
  color: rgba(17, 17, 17, 0.6);
  line-height: 1.6;
}

/* 内容区域 */
.modal-body {
  flex: 1;
  padding: 0 28px 20px;
  overflow-y: auto;
  min-height: 0;
}

.modal-empty {
  padding: 40px 20px;
  text-align: center;
  color: rgba(17, 17, 17, 0.4);
}

/* 底部按钮区 */
.modal-footer {
  padding: 16px 28px 24px;
  border-top: 1px solid rgba(17, 17, 17, 0.08);
}

.preset-buttons {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
}

/* 操作按钮样式 */
.action-btn {
  flex: 1;
  max-width: 160px;
  padding: 12px 20px;
  font-size: 14px;
  font-weight: 600;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.15s ease;
  border: none;
}

.action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 取消按钮 */
.cancel-btn {
  color: #666;
  background: rgba(17, 17, 17, 0.06);
  border: 1px solid rgba(17, 17, 17, 0.15);
}

.cancel-btn:hover:not(:disabled) {
  color: #111;
  border-color: rgba(17, 17, 17, 0.3);
  background: rgba(17, 17, 17, 0.04);
}

/* 确认按钮 - 黑色（默认） */
.confirm-btn {
  color: #fff;
  background: #111;
}

.confirm-btn:hover:not(:disabled) {
  background: #333;
}

/* 确认按钮 - 稀有度主题色 */
.confirm-btn.rarity-rare {
  background: #2563eb;
}

.confirm-btn.rarity-rare:hover:not(:disabled) {
  background: #1d4ed8;
}

.confirm-btn.rarity-epic {
  background: #9333ea;
}

.confirm-btn.rarity-epic:hover:not(:disabled) {
  background: #7c3aed;
}

.confirm-btn.rarity-legendary {
  background: #d97706;
}

.confirm-btn.rarity-legendary:hover:not(:disabled) {
  background: #b45309;
}

.confirm-btn.rarity-mythic {
  background: #dc2626;
}

.confirm-btn.rarity-mythic:hover:not(:disabled) {
  background: #b91c1c;
}

/* 解锁按钮样式（绿色） */
.confirm-btn.unlock-btn {
  background: #16a34a;
}

.confirm-btn.unlock-btn:hover:not(:disabled) {
  background: #15803d;
}

.confirm-btn.unlock-btn:disabled {
  background: rgba(17, 17, 17, 0.1);
  color: rgba(17, 17, 17, 0.4);
}

/* 动画 */
@keyframes modalSlideIn {
  from {
    opacity: 0;
    transform: scale(0.95) translateY(-10px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

/* 过渡样式 */
.modal-enter-active,
.modal-leave-active {
  transition: all 0.2s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from .common-modal,
.modal-leave-to .common-modal {
  transform: scale(0.95) translateY(-10px);
}

/* 响应式 */
@media (max-width: 640px) {
  .common-modal-overlay {
    padding: 16px;
    align-items: flex-end;
  }

  .common-modal {
    width: 100%;
    max-height: calc(100vh - 32px);
    border-radius: 16px 16px 0 0;
  }

  .modal-header {
    padding: 20px 20px 12px;
  }

  .modal-icon {
    font-size: 40px;
    width: 60px;
    height: 60px;
  }

  .modal-icon-svg {
    width: 40px;
    height: 40px;
  }

  .modal-title {
    font-size: 18px;
  }

  .modal-description {
    padding: 0 20px 12px;
  }

  .modal-body {
    padding: 0 20px 16px;
  }

  .modal-footer {
    padding: 12px 20px 20px;
  }

  .preset-buttons {
    flex-direction: column-reverse;
  }

  .action-btn {
    max-width: none;
  }
}

/* slot 内容的按钮样式 - 限定在 modal-footer 内避免污染 */
.modal-footer :deep(.preset-buttons) {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
}

.modal-footer :deep(.action-btn) {
  flex: 1;
  max-width: 160px;
  padding: 12px 20px;
  font-size: 14px;
  font-weight: 600;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.15s ease;
  border: none;
}

.modal-footer :deep(.action-btn:disabled) {
  opacity: 0.5;
  cursor: not-allowed;
}

.modal-footer :deep(.cancel-btn) {
  color: #666;
  background: rgba(17, 17, 17, 0.06);
  border: 1px solid rgba(17, 17, 17, 0.15);
}

.modal-footer :deep(.cancel-btn:hover:not(:disabled)) {
  color: #111;
  border-color: rgba(17, 17, 17, 0.3);
  background: rgba(17, 17, 17, 0.04);
}

.modal-footer :deep(.confirm-btn) {
  color: #fff;
  background: #111;
}

.modal-footer :deep(.confirm-btn:hover:not(:disabled)) {
  background: #333;
}

.modal-footer :deep(.confirm-btn.rarity-rare) {
  background: #2563eb;
}

.modal-footer :deep(.confirm-btn.rarity-rare:hover:not(:disabled)) {
  background: #1d4ed8;
}

.modal-footer :deep(.confirm-btn.rarity-epic) {
  background: #9333ea;
}

.modal-footer :deep(.confirm-btn.rarity-epic:hover:not(:disabled)) {
  background: #7c3aed;
}

.modal-footer :deep(.confirm-btn.rarity-legendary) {
  background: #d97706;
}

.modal-footer :deep(.confirm-btn.rarity-legendary:hover:not(:disabled)) {
  background: #b45309;
}

.modal-footer :deep(.confirm-btn.rarity-mythic) {
  background: #dc2626;
}

.modal-footer :deep(.confirm-btn.rarity-mythic:hover:not(:disabled)) {
  background: #b91c1c;
}

.modal-footer :deep(.confirm-btn.unlock-btn) {
  background: #16a34a;
}

.modal-footer :deep(.confirm-btn.unlock-btn:hover:not(:disabled)) {
  background: #15803d;
}

.modal-footer :deep(.confirm-btn.unlock-btn:disabled) {
  background: rgba(17, 17, 17, 0.1);
  color: rgba(17, 17, 17, 0.4);
}
</style>
