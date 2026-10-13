/**
 * 队列恢复服务
 * 
 * 职责：在页面刷新后，恢复队列状态到 QueueManager
 * 
 * 调用时机：存档加载完成后
 * 
 * 设计说明：
 * - 不直接操作 AutoRunner（由 QueueManager 统一管理）
 * - 只负责检查队列状态并调用 QueueManager 的 restoreTask
 * - 避免循环依赖和职责混乱
 */

import { useGatherQueueStore } from '@/stores/gatherQueueStore';
import { useSmithingQueueStore } from '@/stores/smithingQueueStore';
import { useCookingQueueStore } from '@/stores/cookingQueueStore';
import { useLeatherworkingQueueStore } from '@/stores/leatherworkingQueueStore';
import { useAlchemyQueueStore } from '@/stores/alchemyQueueStore';
import { useQueueManager } from '@/services/QueueManagerService';
import { useMeditationQueueStore } from '@/stores/meditationQueueStore';

/**
 * 恢复所有队列状态
 * 
 * 工作流程：
 * 1. 检查各个队列Store是否有正在运行的任务
 * 2. 如果有，通过 QueueManager 恢复任务
 * 3. QueueManager 会自动处理 AutoRunner 的启动
 * 
 * ⚠️ 注意：同一时间只能有一个队列运行
 * 优先级：采集 > 铸造 > 烹饪 > 炼丹
 */
export function restoreAllQueues(): void {
  console.log('[QueueRestoreService] 开始恢复队列状态...');
  
  const { restoreTask } = useQueueManager();
  const meditationQueueStore = useMeditationQueueStore();
  const gatherQueueStore = useGatherQueueStore();
  const smithingQueueStore = useSmithingQueueStore();
  const cookingQueueStore = useCookingQueueStore();
  const leatherworkingQueueStore = useLeatherworkingQueueStore();
  const alchemyQueueStore = useAlchemyQueueStore();
  
  let restored = false;
  
  // 优先级1: 恢复打坐队列
  if (meditationQueueStore.isMeditating && meditationQueueStore.currentMeditation) {
    console.log('[QueueRestoreService] 发现打坐队列任务，开始恢复...');
    restoreTask(meditationQueueStore.createQueueTask());
    console.log('[QueueRestoreService] 打坐队列恢复成功');
    restored = true;
  }

  // 优先级2: 恢复采集队列（仅在没有更高优先级任务时）
  if (gatherQueueStore.isGathering && gatherQueueStore.currentGathering) {
    console.log('[QueueRestoreService] 发现采集队列任务，开始恢复...');
    
    // 通过 QueueManager 恢复任务（会自动启动 AutoRunner）
    restoreTask(gatherQueueStore.createQueueTask());
    
    console.log('[QueueRestoreService] 采集队列恢复成功:', gatherQueueStore.currentGathering.resourceName);
    restored = true;
  }
  
  // 优先级3: 恢复铸造队列（仅在没有更高优先级任务时）
  if (!restored && smithingQueueStore.isSmithing && smithingQueueStore.currentSmithing) {
    console.log('[QueueRestoreService] 发现铸造队列任务，开始恢复...');
    
    // 通过 QueueManager 恢复任务（会自动启动 AutoRunner）
    restoreTask(smithingQueueStore.createQueueTask());
    
    console.log('[QueueRestoreService] 铸造队列恢复成功:', smithingQueueStore.currentSmithing.recipeName);
    restored = true;
  }
  
  // 优先级4: 恢复制皮队列（仅在没有更高优先级任务时）
  if (!restored && leatherworkingQueueStore.isWorking && leatherworkingQueueStore.current) {
    console.log('[QueueRestoreService] 发现制皮队列任务，开始恢复...');
    restoreTask(leatherworkingQueueStore.createQueueTask());
    console.log('[QueueRestoreService] 制皮队列恢复成功:', leatherworkingQueueStore.current.recipeName);
    restored = true;
  }

  // 优先级5: 恢复烹饪队列（仅在没有其他任务时）
  if (!restored && cookingQueueStore.isCooking && cookingQueueStore.currentCooking) {
    console.log('[QueueRestoreService] 发现烹饪队列任务，开始恢复...');
    
    // 通过 QueueManager 恢复任务（会自动启动 AutoRunner）
    restoreTask(cookingQueueStore.createQueueTask());
    
    console.log('[QueueRestoreService] 烹饪队列恢复成功:', cookingQueueStore.currentCooking.recipeName);
    restored = true;
  }
  
  // 优先级6: 恢复炼丹队列（仅在没有其他任务时）
  if (!restored && alchemyQueueStore.isAlchemizing && alchemyQueueStore.currentAlchemy) {
    console.log('[QueueRestoreService] 发现炼丹队列任务，开始恢复...');
    
    // 通过 QueueManager 恢复任务（会自动启动 AutoRunner）
    restoreTask(alchemyQueueStore.createQueueTask());
    
    console.log('[QueueRestoreService] 炼丹队列恢复成功:', alchemyQueueStore.currentAlchemy.recipeName);
    restored = true;
  }
  
  if (!restored) {
    console.log('[QueueRestoreService] 没有需要恢复的队列任务');
  }
}
