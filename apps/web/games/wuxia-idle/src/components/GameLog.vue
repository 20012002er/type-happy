<template>
  <div class="log-panel-wrap">
    <div class="panel-header">
      <div class="header-actions">
        <button class="ghost-btn" :class="{ active: showFilter }" @click="toggleFilter">
          {{ showFilter ? '收起筛选' : '展开筛选' }}
        </button>
        <button class="ghost-btn" @click="clearLogs">清空</button>
        <button class="ghost-btn" @click="stopFollowAndTop">顶部</button>
        <button class="ghost-btn" @click="followLatest(true)">最新</button>
      </div>
    </div>

    

    <div class="stats-row">
      <div class="stat-chip">
        <span>总计</span>
        <strong>{{ logStats.total }}</strong>
      </div>
      <div class="stat-chip">
        <span>当前筛选</span>
        <strong>{{ filteredLogs.length }}</strong>
      </div>
      <label class="stat-chip follow-toggle">
        <input type="checkbox" v-model="autoStickBottom" />
        <span>跟随最新</span>
      </label>
    </div>

    <div class="log-body">
      <div class="log-list-wrapper" ref="scrollRef">
        <transition name="log-filter">
          <section v-if="showFilter" class="filter-panel">
              <div class="filter-group">
                <span class="group-label">类型</span>
                <div class="chip-group">
                  <label v-for="type in logTypes" :key="type" class="chip-option">
                    <input
                      type="checkbox"
                      :value="type"
                      :checked="currentFilter.types.includes(type)"
                      @change="toggleLogType(type)"
                    />
                    <span>{{ getLogTypeLabel(type) }}</span>
                  </label>
                </div>
              </div>

              <div class="filter-group">
                <span class="group-label">关键词</span>
                <div class="keyword-row">
                  <input
                    v-model="filterKeyword"
                    class="keyword-input"
                    type="text"
                    placeholder="支持模糊搜索，例如“胜利”"
                    @input="updateKeywordFilter"
                  />
                  <button class="ghost-btn" @click="resetFilter">重置</button>
                  <button class="ghost-btn" @click="exportLogs">导出</button>
                </div>
              </div>
          </section>
        </transition>
        <div class="log-scroll-content">
          <article
            v-for="(log, index) in displayLogs"
            :key="log.id || `log-${index}`"
            class="log-row"
            :class="['type-' + log.type]"
          >
            <header class="log-row-meta">
              <span class="log-type-chip">{{ getLogTypeLabel(log.type) }}</span>
              <span class="log-time-text">{{ gameLogStore.formatLogTime(log.timestamp) }}</span>
            </header>
            <div class="log-row-content">
              <InfoPopover v-if="log.data?.enemy" type="enemy" :enemy="log.data.enemy">
                {{ log.message }}
              </InfoPopover>
              <InfoPopover v-else-if="log.data?.item" type="item" :item="log.data.item">
                {{ log.message }}
              </InfoPopover>
              <template v-else>
                {{ log.message }}
              </template>
            </div>
          </article>
        </div>
        <div v-if="filteredLogs.length === 0" class="log-empty">
          <FileText class="empty-icon" />
          <p class="empty-text">暂无日志</p>
          <p class="empty-hint">触发任意操作即可在此查看实时记录。</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick, watch } from 'vue';
import { FileText } from 'lucide-vue-next';
import { useGameLogStore } from '@/stores/gameLogStore';
import { LogType } from '@/types/gameLog';
import type { GameLogEntry } from '@/types/gameLog';
import InfoPopover from './InfoPopover.vue';

// Props
interface Props {
  title?: string;
}

const props = withDefaults(defineProps<Props>(), {
  title: '游戏日志'
});

// Store
const gameLogStore = useGameLogStore();

// 响应式状态
const showFilter = ref(false);
const filterKeyword = ref('');
const autoStickBottom = ref(true);

// 计算属性
const filteredLogs = computed(() => gameLogStore.filteredLogs);
// 显示用快照：当未勾选“跟随最新”时冻结列表，避免新日志顶替视图
const displayLogs = ref<GameLogEntry[]>([]);
const logStats = computed(() => gameLogStore.logStats);
const currentFilter = computed(() => gameLogStore.currentFilter);
const latestTimestamp = computed(() => {
  if (logStats.value.total === 0) return '';
  return gameLogStore.formatLogTime(logStats.value.newestTimestamp);
});

// 普通列表滚动容器
const scrollRef = ref<HTMLElement | null>(null);

// 所有日志类型
const logTypes: LogType[] = [
  LogType.SYSTEM,
  LogType.ACTION,
  LogType.COMBAT,
  LogType.REWARD,
  LogType.LEVEL_UP,
  LogType.ERROR,
  LogType.INFO
];

// 获取日志类型标签
const getLogTypeLabel = (type: LogType): string => {
  const labels = {
    system: '系统',
    action: '动作',
    combat: '战斗',
    reward: '奖励',
    level_up: '升级',
    error: '错误',
    info: '信息'
  };
  return labels[type] || type;
};

// 切换日志类型过滤
const toggleLogType = (type: LogType) => {
  const types = [...currentFilter.value.types];
  const index = types.indexOf(type);
  
  if (index > -1) {
    types.splice(index, 1);
  } else {
    types.push(type);
  }
  
  gameLogStore.updateFilter({ types });
};

// 更新关键词过滤
const updateKeywordFilter = () => {
  gameLogStore.updateFilter({ 
    keyword: filterKeyword.value || undefined 
  });
};

// 重置过滤器
const resetFilter = () => {
  gameLogStore.resetFilter();
  filterKeyword.value = '';
};

// 清空日志
const clearLogs = () => {
  if (confirm('确定要清空所有日志吗？此操作不可恢复。')) {
    gameLogStore.clearAllLogs();
  }
};

// 滚动控制
const scrollToTop = () => {
  if (scrollRef.value) {
    scrollRef.value.scrollTop = 0;
  }
};

const scrollToBottom = () => {
  if (!scrollRef.value) return;
  const el = scrollRef.value;
  el.scrollTop = Math.max(0, el.scrollHeight - el.clientHeight);
};

const followLatest = (force = false) => {
  autoStickBottom.value = force ? true : autoStickBottom.value;
  if (autoStickBottom.value) {
    nextTick(() => scrollToTop());
  }
};

const stopFollowAndTop = () => {
  autoStickBottom.value = false;
  nextTick(() => scrollToTop());
};

// 导出日志
const exportLogs = () => {
  try {
    const logData = gameLogStore.exportLogs('text');
    const blob = new Blob([logData], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `game-logs-${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    gameLogStore.addSystemLog('日志导出完成');
  } catch (error) {
    gameLogStore.addErrorLog('日志导出失败: ' + error);
  }
};

const toggleFilter = () => {
  showFilter.value = !showFilter.value;
};

// 生命周期
onMounted(() => {
  // 初始化默认日志
  if (gameLogStore.logs.length === 0) {
    gameLogStore.initializeDefaultLogs();
  }
  
  nextTick(() => {
    // 初始化显示快照
    displayLogs.value = [...filteredLogs.value];
    scrollToTop();
  });
});

// 当源列表变化时，根据“跟随最新”同步或冻结
watch(
  () => filteredLogs.value,
  (next, prev) => {
    if (autoStickBottom.value) {
      displayLogs.value = [...next];
      nextTick(() => scrollToTop());
    } else {
      // 当源列表缩短（清空/过滤改变）时仍需同步以避免显示脏数据
      if (next.length < displayLogs.value.length) {
        displayLogs.value = [...next];
      }
    }
  },
  { deep: true }
);

// 勾选“跟随最新”后，立刻同步并跳转到“最新”（顶部）
watch(autoStickBottom, (val) => {
  if (val) {
    displayLogs.value = [...filteredLogs.value];
    nextTick(() => scrollToTop());
  }
});
</script>

<style scoped>
.log-panel-wrap {
  display: flex;
  flex-direction: column;
  padding: clamp(12px, 1.4vw, 18px);
  gap: 12px;
  height: 100%;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  align-items: flex-start;
}

.header-text h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
}

.panel-eyebrow {
  margin: 0 0 4px;
  font-size: 11px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgba(17, 17, 17, 0.5);
}

.header-actions {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.ghost-btn {
  border: 1px solid rgba(17, 17, 17, 0.2);
  background: #fff;
  color: #111;
  border-radius: 999px;
  padding: 4px 12px;
  font-size: 11px;
  line-height: 1.2;
  cursor: pointer;
  transition: border-color 0.2s ease, color 0.2s ease, background 0.2s ease;
}

.ghost-btn:hover,
.ghost-btn.active {
  border-color: rgba(17, 17, 17, 0.5);
  color: #000;
  background: rgba(17, 17, 17, 0.04);
}

.filter-panel {
  background: #fff;
  border: 1px solid rgba(17, 17, 17, 0.08);
  border-radius: 12px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  position: sticky;
  top: 0;
  z-index: 2;
  border-bottom: 1px solid rgba(17, 17, 17, 0.08);
}

.filter-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.group-label {
  font-size: 12px;
  color: rgba(17, 17, 17, 0.6);
}

.chip-group {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.chip-option {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: 1px solid rgba(17, 17, 17, 0.12);
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 11px;
  background: #fefcf7;
  cursor: pointer;
}

.chip-option input {
  accent-color: #111;
}

.keyword-row {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.keyword-input {
  flex: 1;
  min-width: 160px;
  border-radius: 999px;
  border: 1px solid rgba(17, 17, 17, 0.2);
  padding: 7px 12px;
  font-size: 12px;
  background: #fff;
}

.stats-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

.stat-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border-radius: 10px;
  background: rgba(17, 17, 17, 0.04);
  font-size: 11px;
  border: 1px solid rgba(17, 17, 17, 0.06);
}

.stat-chip strong {
  font-size: 13px;
  font-weight: 600;
}

.follow-toggle {
  cursor: pointer;
  gap: 6px;
}

.follow-toggle input {
  accent-color: #111;
}

.log-body {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.log-list-wrapper {
  position: relative;
  border-radius: 14px;
  border: 1px solid rgba(17, 17, 17, 0.08);
  background: #fff;
  overflow-y: auto;
  overflow-x: hidden;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.log-scroll-content {
  padding: 6px;
}

.log-row {
  background: rgba(249, 247, 241, 0.9);
  border: 1px solid rgba(17, 17, 17, 0.05);
  border-radius: 10px;
  padding: 10px 12px;
  margin-bottom: 6px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  transition: border-color 0.2s ease, transform 0.2s ease;
}

.log-row:hover {
  border-color: rgba(17, 17, 17, 0.18);
  transform: translateY(-1px);
}

.log-row-meta {
  display: flex;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 4px;
  font-size: 11px;
  color: rgba(17, 17, 17, 0.6);
  font-family: var(--font-family-mono);
}

.log-type-chip {
  padding: 2px 6px;
  border-radius: 999px;
  background: rgba(17, 17, 17, 0.08);
  color: rgba(17, 17, 17, 0.8);
}

.log-row-content {
  font-size: 13px;
  color: #111;
  line-height: 1.45;
  word-break: break-word;
}

.log-row.type-combat {
  border-color: rgba(255, 87, 34, 0.2);
}

.log-row.type-reward {
  border-color: rgba(26, 188, 156, 0.25);
}

.log-row.type-error {
  border-color: rgba(231, 76, 60, 0.25);
}

.log-empty {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: rgba(17, 17, 17, 0.5);
  gap: 4px;
}

.empty-icon {
  width: 32px;
  height: 32px;
  color: rgba(17, 17, 17, 0.3);
}

.empty-text {
  font-weight: 600;
}

.empty-hint {
  font-size: 12px;
}

.log-filter-enter-active,
.log-filter-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.log-filter-enter-from,
.log-filter-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}

@media (max-width: 768px) {
  .panel-header {
    flex-direction: column;
  }

  .header-actions {
    width: 100%;
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 6px;
  }

  .ghost-btn {
    width: 100%;
    text-align: center;
  }

  .keyword-row {
    flex-direction: column;
  }

  .keyword-input {
    width: 100%;
  }

  .stats-row {
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  }
}

@media (max-width: 380px) {
  .header-actions {
    grid-template-columns: 1fr;
  }
}
</style>
