/**
 * 游戏日志系统类型定义
 */

// 日志条目类型
export enum LogType {
  SYSTEM = 'system', // 系统消息
  ACTION = 'action', // 动作执行
  COMBAT = 'combat', // 战斗相关
  REWARD = 'reward', // 奖励获得
  LEVEL_UP = 'level_up', // 升级消息
  ERROR = 'error', // 错误消息
  STORY = 'story', // 主线剧情
  INFO = 'info', // 信息提示
}

// 日志条目接口
export interface GameLogEntry {
  id: string; // 唯一标识
  timestamp: number; // 时间戳
  type: LogType; // 日志类型
  message: string; // 消息内容
  data?: any; // 附加数据
}

// 日志过滤配置
export interface LogFilter {
  types: LogType[]; // 显示的日志类型
  timeRange?: {
    // 时间范围
    start: number;
    end: number;
  };
  keyword?: string; // 关键词过滤
}

// 日志统计信息
export interface LogStats {
  total: number; // 总条数
  byType: Record<LogType, number>; // 按类型统计
  oldestTimestamp: number; // 最早时间
  newestTimestamp: number; // 最新时间
}
