/**
 * 真相碎片类型定义
 * 主线剧情系统的核心数据结构
 */

/**
 * 门派类型枚举
 */
export enum SectType {
  少林 = '少林',
  武当 = '武当',
  峨眉 = '峨眉',
  华山 = '华山',
  丐帮 = '丐帮',
}

/**
 * 真相碎片分类
 */
export enum TruthFragmentCategory {
  少林 = '少林',
  武当 = '武当',
  峨眉 = '峨眉',
  华山 = '华山',
  丐帮 = '丐帮',
  通用 = '通用',
}

/**
 * 真相碎片获取方式
 */
export enum FragmentSourceType {
  任务奖励 = 'task_reward',
  探索发现 = 'exploration',
  战斗掉落 = 'combat_drop',
  NPC赠送 = 'npc_gift',
  地点互动 = 'location_interaction',
  剧情触发 = 'story_trigger',
}

/**
 * 真相碎片接口
 */
export interface TruthFragment {
  id: string; // 碎片唯一ID
  name: string; // 碎片名称
  description: string; // 碎片描述
  category: TruthFragmentCategory; // 所属门派分类
  sourceType: FragmentSourceType; // 获取方式
  sourceId: string; // 来源ID（如任务ID、地点ID）
  requirements?: {
    // 获取条件
    level?: number; // 等级要求
    reputation?: number; // 声望要求
    completedFragments?: string[]; // 需要先完成的碎片
    location?: string; // 需要在特定地点
  };
  hints?: string[]; // 获取提示
  storyContent: string; // 碎片包含的剧情内容
  rewards?: {
    // 获取时的奖励
    exp?: number;
    gold?: number;
    reputation?: number;
  };
}

/**
 * 玩家已收集的碎片
 */
export interface CollectedFragment {
  fragmentId: string;
  collectedAt: number; // 收集时间
  read: boolean; // 是否已阅读
}

/**
 * 玩家碎片集合
 */
export interface FragmentCollection {
  collectedFragments: CollectedFragment[];
  totalCollected: number; // 已收集总数
  lastCollectedAt?: number; // 最后收集时间
}

/**
 * 主线章节状态
 */
export enum ChapterStatus {
  LOCKED = 'locked', // 未解锁
  AVAILABLE = 'available', // 可进行
  IN_PROGRESS = 'in_progress', // 进行中
  COMPLETED = 'completed', // 已完成
}

/**
 * 主线章节配置
 */
export interface MainStoryChapter {
  id: number; // 章节编号 (1-5)
  name: string; // 章节名称
  description: string; // 章节描述
  requiredReputation: number; // 解锁所需声望
  requiredLevel: number; // 解锁所需等级
  requiredFragments: number; // 解锁所需碎片数
  fragmentsRequired: string[]; // 必须收集的碎片ID
  fragmentsOptional: string[]; // 可选收集的碎片ID
  storyNodes: StoryNode[]; // 剧情节点
  rewards?: {
    // 章节完成奖励
    exp?: number;
    gold?: number;
    reputation?: number;
    title?: string; // 解锁称号
    item?: { id: string; quantity: number };
  };
}

/**
 * 剧情节点类型
 */
export enum StoryNodeType {
  DIALOGUE = 'dialogue', // 对话
  EVENT = 'event', // 事件
  CHOICE = 'choice', // 选择分支
  REWARD = 'reward', // 奖励
  CUTSCENE = 'cutscene', // 过场
  UNLOCK = 'unlock', // 解锁内容
}

/**
 * 剧情节点
 */
export interface StoryNode {
  id: string; // 节点ID
  type: StoryNodeType; // 节点类型
  content: string; // 节点内容
  speaker?: string; // 说话者
  nextNode?: string; // 下一节点ID
  choices?: StoryChoice[]; // 选择项（分支节点使用）
  triggerCondition?: {
    // 触发条件
    fragmentRequired?: string; // 需要收集的碎片
    chapterComplete?: number; // 需要完成的章节
    levelRequired?: number; // 等级要求
  };
}

/**
 * 选择分支
 */
export interface StoryChoice {
  id: string; // 选择ID
  text: string; // 选择文案
  nextNode: string; // 选择后的节点
  consequence?: string; // 选择后果描述
}

/**
 * 主线进度
 */
export interface MainStoryProgress {
  currentChapter: number; // 当前章节 (0=未开始)
  completedChapters: number[]; // 已完成的章节
  currentNodeId: string; // 当前节点ID
  fragmentCollection: FragmentCollection; // 碎片收集状态
  storyFlags: Record<string, boolean>; // 剧情标记（用于分支判定）
  lastChapterAt?: number; // 最后完成章节的时间
}

/**
 * 剧情事件类型（用于事件系统）
 */
export type MainStoryEventType =
  | 'fragment.collected'
  | 'chapter.unlocked'
  | 'chapter.started'
  | 'chapter.completed'
  | 'node.completed'
  | 'choice.made'
  | 'story.flag.set';

/**
 * 剧情事件载荷
 */
export interface MainStoryEventPayload {
  type: MainStoryEventType;
  fragmentId?: string;
  chapterId?: number;
  nodeId?: string;
  choiceId?: string;
  flagKey?: string;
  flagValue?: boolean;
}
