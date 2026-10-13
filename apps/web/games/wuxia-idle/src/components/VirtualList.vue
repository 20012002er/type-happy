<template>
  <div 
    ref="containerRef"
    class="virtual-list-container"
    @scroll="handleScroll"
  >
    <!-- 顶部占位区域 -->
    <div 
      class="virtual-spacer" 
      :style="{ height: offsetY + 'px' }"
    ></div>
    
    <!-- 可见区域渲染的条目 -->
    <div
      v-for="(item, index) in visibleItems" 
      :key="getItemKey ? getItemKey(item, startIndex + index) : startIndex + index"
      class="virtual-list-item"
      :style="{ height: itemHeight + 'px' }"
    >
      <slot 
        :item="item" 
        :index="startIndex + index"
        :isFirst="startIndex + index === 0"
        :isLast="startIndex + index === items.length - 1"
      >
        {{ item }}
      </slot>
    </div>
    
    <!-- 底部占位区域 -->
    <div 
      class="virtual-spacer" 
      :style="{ height: (items.length - endIndex) * itemHeight + 'px' }"
    ></div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue';

// Props定义
interface Props {
  items: any[];                    // 数据列表
  itemHeight: number;              // 每个条目的高度
  containerHeight?: number;        // 容器高度，不设置则自动计算
  buffer?: number;                 // 缓冲区条目数量
  getItemKey?: (item: any, index: number) => string | number; // 获取key的函数
}

const props = withDefaults(defineProps<Props>(), {
  containerHeight: 0,
  buffer: 5,
  getItemKey: undefined
});

// 响应式状态
const containerRef = ref<HTMLElement>();
const scrollTop = ref(0);
const clientHeight = ref(0);

// 计算属性
const actualContainerHeight = computed(() => {
  return props.containerHeight || clientHeight.value;
});

// 可见区域的开始和结束索引
const startIndex = computed(() => {
  const index = Math.floor(scrollTop.value / props.itemHeight) - props.buffer;
  return Math.max(0, index);
});

const endIndex = computed(() => {
  const index = Math.ceil((scrollTop.value + actualContainerHeight.value) / props.itemHeight) + props.buffer;
  return Math.min(props.items.length, index);
});

// 可见的条目列表
const visibleItems = computed(() => {
  return props.items.slice(startIndex.value, endIndex.value);
});

// 顶部偏移量
const offsetY = computed(() => {
  return startIndex.value * props.itemHeight;
});

// 事件处理
const handleScroll = () => {
  if (containerRef.value) {
    scrollTop.value = containerRef.value.scrollTop;
  }
};

// 更新容器尺寸
const updateContainerSize = () => {
  if (containerRef.value && !props.containerHeight) {
    clientHeight.value = containerRef.value.clientHeight;
  }
};

// 滚动到指定位置
const scrollToIndex = (index: number, position: 'top' | 'center' | 'bottom' = 'top') => {
  if (!containerRef.value || index < 0 || index >= props.items.length) return;
  
  let targetScrollTop = index * props.itemHeight;
  
  if (position === 'center') {
    targetScrollTop -= actualContainerHeight.value / 2 - props.itemHeight / 2;
  } else if (position === 'bottom') {
    targetScrollTop -= actualContainerHeight.value - props.itemHeight;
  }
  
  containerRef.value.scrollTop = Math.max(0, targetScrollTop);
};

// 滚动到顶部
const scrollToTop = () => {
  if (containerRef.value) {
    containerRef.value.scrollTop = 0;
  }
};

// 滚动到底部
const scrollToBottom = () => {
  if (containerRef.value) {
    const maxScrollTop = props.items.length * props.itemHeight - actualContainerHeight.value;
    containerRef.value.scrollTop = Math.max(0, maxScrollTop);
  }
};

// 监听数据变化，自动滚动到底部（适合聊天日志）
const autoScrollToBottom = ref(true);

watch(() => props.items.length, (newLength, oldLength) => {
  if (autoScrollToBottom.value && newLength > oldLength) {
    nextTick(() => {
      scrollToBottom();
    });
  }
});

// 生命周期
onMounted(() => {
  updateContainerSize();
  
  // 监听窗口大小变化
  window.addEventListener('resize', updateContainerSize);
  
  // 如果有初始数据，滚动到底部
  if (props.items.length > 0) {
    nextTick(() => {
      scrollToBottom();
    });
  }
});

onUnmounted(() => {
  window.removeEventListener('resize', updateContainerSize);
});

// 暴露方法给父组件
defineExpose({
  scrollToIndex,
  scrollToTop,
  scrollToBottom,
  autoScrollToBottom
});
</script>

<style scoped>
.virtual-list-container {
  height: 100%;
  overflow-y: auto;
  overflow-x: hidden;
  position: relative;
}

.virtual-spacer {
  width: 100%;
  flex-shrink: 0;
}

.virtual-list-item {
  width: 100%;
  flex-shrink: 0;
  overflow: hidden;
}

/* 滚动条样式 */
.virtual-list-container::-webkit-scrollbar {
  width: 6px;
}

.virtual-list-container::-webkit-scrollbar-track {
  background: var(--color-bg-secondary);
}

.virtual-list-container::-webkit-scrollbar-thumb {
  background: var(--color-border-medium);
  border-radius: 3px;
}

.virtual-list-container::-webkit-scrollbar-thumb:hover {
  background: var(--color-border-dark);
}
</style>
