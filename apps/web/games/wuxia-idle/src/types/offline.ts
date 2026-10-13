/**
 * 离线收益系统类型定义
 */

// 离线活动类型
export enum OfflineActivityType {
  NONE = 'none',
  GATHERING = 'gathering',      // 采集（采药、伐木、钓鱼、采矿）
  MEDITATION = 'meditation',     // 打坐修炼
  MARTIAL = 'martial',           // 武学修炼
  COMBAT = 'combat'              // 战斗
}

// 离线状态快照（保存到存档）
export interface OfflineSnapshot {
  lastActiveTime: number;        // 最后活跃时间戳
  activeActivity?: {
    type: OfflineActivityType;   // 活动类型
    data: any;                   // 活动相关数据
  };
}

// 离线收益结果
export interface OfflineReward {
  // 离线时长信息
  offlineTimeMs: number;         // 实际离线时长（毫秒）
  cappedTimeMs: number;          // 计算收益的时长（被上限限制后，毫秒）
  efficiency: number;            // 离线效率（0-1）
  
  // 收益详情
  rewards: {
    // 采集收益
    gatheredItems?: {
      resourceId: string;
      resourceName: string;
      quantity: number;
    }[];
    
    // 经验收益
    skillExp?: {
      skillType: string;
      exp: number;
    }[];
    
    // 角色总经验
    totalExp?: number;
    
    // 其他收益
    gold?: number;
    reputation?: number;
  };
  
  // 消息
  message: string;
  detailedMessages: string[];
}

// 离线收益配置
export interface OfflineConfig {
  version: string;
  offlineTime: {
    baseMaxHours: number;
    minOfflineMinutes: number;
    efficiency: number;
  };
  upgrades: OfflineUpgrade[];
  activityRules: {
    gathering: ActivityRule;
    meditation: ActivityRule;
    martial: ActivityRule;
    combat: ActivityRule;
  };
}

export interface OfflineUpgrade {
  id: string;
  name: string;
  description: string;
  additionalHours: number;
  cost: number;
  unlockLevel: number;
}

export interface ActivityRule {
  enabled: boolean;
  efficiency?: number;
  consumeQueue?: boolean;
  maxIterations?: number;
}

