<template>
  <div 
    v-if="visible"
    class="draggable-modal-backdrop"
    :class="{ 'no-backdrop': !showBackdrop }"
    @mousedown="handleBackdropClick"
  >
    <div
      ref="modalRef"
      class="draggable-modal"
      :style="modalStyle"
    >
      <!-- 拖拽头部 -->
      <div class="modal-header" @mousedown="startDrag">
        <div class="modal-title">
          <slot name="header">
            <h4>{{ title }}</h4>
          </slot>
        </div>
        <div class="modal-controls">
          <slot name="controls">
            <button 
              class="modal-control-btn"
              @click="toggleMinimize"
              v-if="minimizable"
            >
              {{ isMinimized ? '□' : '_' }}
            </button>
            <button 
              class="modal-control-btn"
              @click="closeModal"
              v-if="closable"
            >
              ✕
            </button>
          </slot>
        </div>
      </div>

      <!-- 内容区域 -->
      <div 
        v-show="!isMinimized"
        class="modal-body"
        :style="{ height: bodyHeight + 'px' }"
      >
        <slot>
          <p>默认内容</p>
        </slot>
      </div>

      <!-- 可调整大小的角落（可选） -->
      <div 
        v-if="resizable && !isMinimized"
        class="resize-handle"
        @mousedown="startResize"
      ></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue';

// Props 接口
interface Props {
  visible: boolean;              // 是否显示
  title?: string;                // 标题
  width?: number;                // 初始宽度
  height?: number;               // 初始高度
  minWidth?: number;             // 最小宽度
  minHeight?: number;            // 最小高度
  maxWidth?: number;             // 最大宽度  
  maxHeight?: number;            // 最大高度
  x?: number;                    // 初始X位置
  y?: number;                    // 初始Y位置
  draggable?: boolean;           // 是否可拖拽
  resizable?: boolean;           // 是否可调整大小
  minimizable?: boolean;         // 是否可最小化
  closable?: boolean;            // 是否可关闭
  modal?: boolean;               // 是否模态
  keepBounds?: boolean;          // 是否保持在视窗内
  showBackdrop?: boolean;        // 是否显示模糊背景
}

const props = withDefaults(defineProps<Props>(), {
  title: '弹窗',
  width: 300,
  height: 200,
  minWidth: 200,
  minHeight: 100,
  maxWidth: window.innerWidth * 0.9,
  maxHeight: window.innerHeight * 0.9,
  x: undefined,
  y: undefined,
  draggable: true,
  resizable: false,
  minimizable: true,
  closable: true,
  modal: false,
  keepBounds: true,
  showBackdrop: true
});

// Emits
interface Emits {
  (e: 'update:visible', value: boolean): void;
  (e: 'close'): void;
  (e: 'minimize', minimized: boolean): void;
  (e: 'move', position: { x: number; y: number }): void;
  (e: 'resize', size: { width: number; height: number }): void;
}

const emit = defineEmits<Emits>();

// 响应式状态
const modalRef = ref<HTMLElement>();
const currentX = ref(0);
const currentY = ref(0);
const currentWidth = ref(props.width);
const currentHeight = ref(props.height);
const isMinimized = ref(false);
const isDragging = ref(false);
const isResizing = ref(false);

// 拖拽相关状态
const dragStartX = ref(0);
const dragStartY = ref(0);
const dragStartPosX = ref(0);
const dragStartPosY = ref(0);

// 调整大小相关状态
const resizeStartX = ref(0);
const resizeStartY = ref(0);
const resizeStartWidth = ref(0);
const resizeStartHeight = ref(0);

// 计算属性
const modalStyle = computed(() => ({
  left: currentX.value + 'px',
  top: currentY.value + 'px',
  width: currentWidth.value + 'px',
  height: isMinimized.value ? 'auto' : currentHeight.value + 'px',
  cursor: isDragging.value ? 'move' : 'default'
}));

const bodyHeight = computed(() => {
  return currentHeight.value - 40; // 减去头部高度
});

// 初始化位置
const initializePosition = () => {
  if (props.x !== undefined && props.y !== undefined) {
    currentX.value = props.x;
    currentY.value = props.y;
  } else {
    // 默认居中
    currentX.value = (window.innerWidth - currentWidth.value) / 2;
    currentY.value = (window.innerHeight - currentHeight.value) / 2;
  }
  
  // 确保在视窗范围内
  constrainToBounds();
};

// 约束到边界
const constrainToBounds = () => {
  if (!props.keepBounds) return;
  
  const maxX = window.innerWidth - currentWidth.value;
  const maxY = window.innerHeight - (isMinimized.value ? 40 : currentHeight.value);
  
  currentX.value = Math.max(0, Math.min(currentX.value, maxX));
  currentY.value = Math.max(0, Math.min(currentY.value, maxY));
};

// 开始拖拽
const startDrag = (event: MouseEvent) => {
  if (!props.draggable || isResizing.value) return;
  
  event.preventDefault();
  isDragging.value = true;
  
  dragStartX.value = event.clientX;
  dragStartY.value = event.clientY;
  dragStartPosX.value = currentX.value;
  dragStartPosY.value = currentY.value;
  
  document.addEventListener('mousemove', handleDrag);
  document.addEventListener('mouseup', stopDrag);
  
  // 添加全局样式
  document.body.style.userSelect = 'none';
  document.body.style.cursor = 'move';
};

// 处理拖拽
const handleDrag = (event: MouseEvent) => {
  if (!isDragging.value) return;
  
  const deltaX = event.clientX - dragStartX.value;
  const deltaY = event.clientY - dragStartY.value;
  
  currentX.value = dragStartPosX.value + deltaX;
  currentY.value = dragStartPosY.value + deltaY;
  
  constrainToBounds();
  
  emit('move', { x: currentX.value, y: currentY.value });
};

// 停止拖拽
const stopDrag = () => {
  isDragging.value = false;
  
  document.removeEventListener('mousemove', handleDrag);
  document.removeEventListener('mouseup', stopDrag);
  
  // 恢复全局样式
  document.body.style.userSelect = '';
  document.body.style.cursor = '';
};

// 开始调整大小
const startResize = (event: MouseEvent) => {
  if (!props.resizable) return;
  
  event.preventDefault();
  event.stopPropagation();
  
  isResizing.value = true;
  
  resizeStartX.value = event.clientX;
  resizeStartY.value = event.clientY;
  resizeStartWidth.value = currentWidth.value;
  resizeStartHeight.value = currentHeight.value;
  
  document.addEventListener('mousemove', handleResize);
  document.addEventListener('mouseup', stopResize);
  
  document.body.style.userSelect = 'none';
  document.body.style.cursor = 'nw-resize';
};

// 处理调整大小
const handleResize = (event: MouseEvent) => {
  if (!isResizing.value) return;
  
  const deltaX = event.clientX - resizeStartX.value;
  const deltaY = event.clientY - resizeStartY.value;
  
  let newWidth = resizeStartWidth.value + deltaX;
  let newHeight = resizeStartHeight.value + deltaY;
  
  // 应用尺寸限制
  newWidth = Math.max(props.minWidth, Math.min(newWidth, props.maxWidth));
  newHeight = Math.max(props.minHeight, Math.min(newHeight, props.maxHeight));
  
  currentWidth.value = newWidth;
  currentHeight.value = newHeight;
  
  // 确保不会超出视窗
  constrainToBounds();
  
  emit('resize', { width: newWidth, height: newHeight });
};

// 停止调整大小
const stopResize = () => {
  isResizing.value = false;
  
  document.removeEventListener('mousemove', handleResize);
  document.removeEventListener('mouseup', stopResize);
  
  document.body.style.userSelect = '';
  document.body.style.cursor = '';
};

// 最小化切换
const toggleMinimize = () => {
  isMinimized.value = !isMinimized.value;
  emit('minimize', isMinimized.value);
  
  // 最小化后重新约束边界
  nextTick(() => {
    constrainToBounds();
  });
};

// 关闭弹窗
const closeModal = () => {
  emit('update:visible', false);
  emit('close');
};

// 处理背景点击
const handleBackdropClick = (event: MouseEvent) => {
  if (props.modal && event.target === event.currentTarget) {
    closeModal();
  }
};

// 监听窗口大小变化
const handleWindowResize = () => {
  constrainToBounds();
};

// 监听visible变化
watch(() => props.visible, (newVisible) => {
  if (newVisible) {
    nextTick(() => {
      initializePosition();
    });
  }
});

// 生命周期
onMounted(() => {
  if (props.visible) {
    initializePosition();
  }
  
  window.addEventListener('resize', handleWindowResize);
});

onUnmounted(() => {
  // 清理事件监听器
  document.removeEventListener('mousemove', handleDrag);
  document.removeEventListener('mouseup', stopDrag);
  document.removeEventListener('mousemove', handleResize);
  document.removeEventListener('mouseup', stopResize);
  
  window.removeEventListener('resize', handleWindowResize);
  
  // 恢复全局样式
  document.body.style.userSelect = '';
  document.body.style.cursor = '';
});

// 暴露方法
defineExpose({
  minimize: toggleMinimize,
  close: closeModal,
  move: (x: number, y: number) => {
    currentX.value = x;
    currentY.value = y;
    constrainToBounds();
  },
  resize: (width: number, height: number) => {
    currentWidth.value = width;
    currentHeight.value = height;
    constrainToBounds();
  },
  center: () => {
    currentX.value = (window.innerWidth - currentWidth.value) / 2;
    currentY.value = (window.innerHeight - currentHeight.value) / 2;
    constrainToBounds();
  }
});
</script>

<style scoped>
.draggable-modal-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 1000;
  background-color: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(2px);
  pointer-events: auto;
}

.draggable-modal-backdrop.no-backdrop {
  background-color: transparent;
  backdrop-filter: none;
  pointer-events: none;
}

.draggable-modal {
  position: absolute;
  background: #fff;
  border-radius: 20px;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.2);
  display: flex;
  flex-direction: column;
  z-index: 1001;
  pointer-events: auto;
  overflow: hidden;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24px 28px 16px;
  border-top: 4px solid #111;
  cursor: move;
  user-select: none;
}

.modal-title h4 {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: #0f0f0f;
}

.modal-controls {
  display: flex;
  gap: 6px;
}

.modal-control-btn {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  border: none;
  background: transparent;
  color: rgba(17, 17, 17, 0.5);
  cursor: pointer;
  font-size: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s ease;
}

.modal-control-btn:hover {
  background: rgba(17, 17, 17, 0.06);
  color: #111;
}

.modal-body {
  flex: 1;
  padding: 0 28px 20px;
  overflow: auto;
  min-height: 0;
}

.resize-handle {
  position: absolute;
  right: 0;
  bottom: 0;
  width: 16px;
  height: 16px;
  cursor: nw-resize;
  background: linear-gradient(
    -45deg,
    transparent 0%,
    transparent 45%,
    rgba(17, 17, 17, 0.25) 45%,
    rgba(17, 17, 17, 0.25) 65%,
    transparent 65%
  );
  border-bottom-right-radius: 20px;
}

.resize-handle:hover {
  background: linear-gradient(
    -45deg,
    transparent 0%,
    transparent 45%,
    rgba(17, 17, 17, 0.4) 45%,
    rgba(17, 17, 17, 0.4) 65%,
    transparent 65%
  );
}

/* 响应式适配 */
@media (max-width: 768px) {
  .draggable-modal {
    max-width: calc(100vw - 20px);
    max-height: calc(100vh - 20px);
    border-radius: 16px;
  }

  .modal-header {
    padding: 20px 20px 12px;
  }

  .modal-body {
    padding: 0 20px 16px;
  }
}

/* 动画效果 */
.draggable-modal-backdrop {
  animation: fadeIn 0.2s ease-out;
}

.draggable-modal {
  animation: modalSlideIn 0.25s ease-out;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

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
</style>
