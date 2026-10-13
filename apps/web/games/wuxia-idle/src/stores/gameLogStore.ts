/**
 * 游戏日志状态管理Store
 * 管理所有游戏操作日志
 */

import { defineStore } from 'pinia';
import { ref, computed, readonly } from 'vue';
import type { GameLogEntry, LogFilter, LogStats } from '@/types/gameLog';
import { LogType } from '@/types/gameLog';

export const useGameLogStore = defineStore('gameLog', () => {
  // ===== 状态定义 =====

  const logs = ref<GameLogEntry[]>([]);
  const maxLogCount = ref(1000); // 最大日志条数，防止内存溢出
  const currentFilter = ref<LogFilter>({
    types: ['system', 'action', 'combat', 'reward', 'level_up', 'error', 'info'] as LogType[],
  });

  // ===== 计算属性 =====

  // 过滤后的日志列表
  const filteredLogs = computed(() => {
    let filtered = logs.value;

    // 按类型过滤
    if (currentFilter.value.types.length > 0) {
      filtered = filtered.filter(log => currentFilter.value.types.includes(log.type));
    }

    // 按时间范围过滤
    if (currentFilter.value.timeRange) {
      const { start, end } = currentFilter.value.timeRange;
      filtered = filtered.filter(log => log.timestamp >= start && log.timestamp <= end);
    }

    // 按关键词过滤
    if (currentFilter.value.keyword) {
      const keyword = currentFilter.value.keyword.toLowerCase();
      filtered = filtered.filter(log => log.message.toLowerCase().includes(keyword));
    }

    return filtered;
  });

  // 日志统计信息
  const logStats = computed((): LogStats => {
    const stats: LogStats = {
      total: logs.value.length,
      byType: {
        system: 0,
        action: 0,
        combat: 0,
        reward: 0,
        level_up: 0,
        error: 0,
        story: 0,
        info: 0,
      },
      oldestTimestamp: 0,
      newestTimestamp: 0,
    };

    if (logs.value.length > 0) {
      stats.oldestTimestamp = logs.value[logs.value.length - 1].timestamp;
      stats.newestTimestamp = logs.value[0].timestamp;

      logs.value.forEach(log => {
        stats.byType[log.type]++;
      });
    }

    return stats;
  });

  // ===== 核心方法 =====

  /**
   * 添加日志条目
   */
  const addLog = (type: LogType, message: string, data?: any): GameLogEntry => {
    const logEntry: GameLogEntry = {
      id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      type,
      message,
      data,
    };

    // 新日志添加到开头（最新的在上面）
    logs.value.unshift(logEntry);

    // 限制日志数量，删除最老的日志
    if (logs.value.length > maxLogCount.value) {
      logs.value = logs.value.slice(0, maxLogCount.value);
    }

    return logEntry;
  };

  /**
   * 便捷的日志添加方法
   */
  const addSystemLog = (message: string, data?: any) => addLog(LogType.SYSTEM, message, data);
  const addActionLog = (message: string, data?: any) => addLog(LogType.ACTION, message, data);
  const addCombatLog = (message: string, data?: any) => addLog(LogType.COMBAT, message, data);
  const addRewardLog = (message: string, data?: any) => addLog(LogType.REWARD, message, data);
  const addLevelUpLog = (message: string, data?: any) => addLog(LogType.LEVEL_UP, message, data);
  const addErrorLog = (message: string, data?: any) => addLog(LogType.ERROR, message, data);
  const addInfoLog = (message: string, data?: any) => addLog(LogType.INFO, message, data);
  const addStoryLog = (message: string, data?: any) => addLog(LogType.STORY, message, data);

  /**
   * 清空所有日志
   */
  const clearAllLogs = () => {
    logs.value = [];
    addSystemLog('日志已清空');
  };

  /**
   * 清空指定类型的日志
   */
  const clearLogsByType = (type: LogType) => {
    const beforeCount = logs.value.length;
    logs.value = logs.value.filter(log => log.type !== type);
    const afterCount = logs.value.length;
    const removedCount = beforeCount - afterCount;

    if (removedCount > 0) {
      addSystemLog(`已清空${removedCount}条${type}类型日志`);
    }
  };

  /**
   * 清空过期日志（超过指定天数）
   */
  const clearExpiredLogs = (days: number = 7) => {
    const expireTime = Date.now() - days * 24 * 60 * 60 * 1000;
    const beforeCount = logs.value.length;
    logs.value = logs.value.filter(log => log.timestamp > expireTime);
    const afterCount = logs.value.length;
    const removedCount = beforeCount - afterCount;

    if (removedCount > 0) {
      addSystemLog(`已清理${removedCount}条${days}天前的日志`);
    }
  };

  /**
   * 获取指定数量的最新日志
   */
  const getRecentLogs = (count: number = 50): GameLogEntry[] => {
    return filteredLogs.value.slice(0, count);
  };

  /**
   * 更新过滤条件
   */
  const updateFilter = (filter: Partial<LogFilter>) => {
    currentFilter.value = { ...currentFilter.value, ...filter };
  };

  /**
   * 重置过滤条件
   */
  const resetFilter = () => {
    currentFilter.value = {
      types: ['system', 'action', 'combat', 'reward', 'level_up', 'error', 'info'] as LogType[],
    };
  };

  /**
   * 格式化时间显示
   */
  const formatLogTime = (timestamp: number): string => {
    const date = new Date(timestamp);
    const now = new Date();

    const pad = (n: number, len: number = 2) => String(n).padStart(len, '0');
    const Y = date.getFullYear();
    const M = pad(date.getMonth() + 1);
    const D = pad(date.getDate());
    const h = pad(date.getHours());
    const m = pad(date.getMinutes());
    const s = pad(date.getSeconds());
    const ms = pad(date.getMilliseconds(), 3);

    // 同一年显示 "MM-DD HH:mm:ss.SSS"，否则显示 "YYYY-MM-DD HH:mm:ss.SSS"
    if (date.getFullYear() === now.getFullYear()) {
      return `${M}-${D} ${h}:${m}:${s}.${ms}`;
    }

    return `${Y}-${M}-${D} ${h}:${m}:${s}.${ms}`;
  };

  /**
   * 导出日志数据
   */
  const exportLogs = (format: 'json' | 'text' = 'json'): string => {
    if (format === 'json') {
      return JSON.stringify(filteredLogs.value, null, 2);
    } else {
      return filteredLogs.value
        .map(log => `[${formatLogTime(log.timestamp)}] [${log.type.toUpperCase()}] ${log.message}`)
        .join('\n');
    }
  };

  // 初始化默认日志
  const initializeDefaultLogs = () => {
    addSystemLog('游戏启动完成');
    addInfoLog('欢迎来到武侠世界！开始你的江湖之路吧！');
    addInfoLog('提示：使用右上角调试面板可以快速测试各种功能');
  };

  // ===== 返回store接口 =====

  return {
    // 状态
    logs: readonly(logs),
    maxLogCount,
    currentFilter,

    // 计算属性
    filteredLogs,
    logStats,

    // 方法
    addLog,
    addSystemLog,
    addActionLog,
    addCombatLog,
    addRewardLog,
    addLevelUpLog,
    addErrorLog,
    addInfoLog,
    addStoryLog,
    clearAllLogs,
    clearLogsByType,
    clearExpiredLogs,
    getRecentLogs,
    updateFilter,
    resetFilter,
    formatLogTime,
    exportLogs,
    initializeDefaultLogs,
  };
});
