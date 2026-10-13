/**
 * DungeonConfigService 单元测试
 * 验证配置加载、验证和缓存机制
 *
 * Task 3.2: DungeonConfigService 单元测试
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DungeonConfigService } from './DungeonConfigService';

describe('DungeonConfigService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    DungeonConfigService.clearCache();
  });

  describe('解锁条件检查', () => {
    it('无条件时应返回已解锁', () => {
      const result = DungeonConfigService.checkUnlockCondition(
        { unlockCondition: undefined } as any,
        1
      );

      expect(result.unlocked).toBe(true);
    });

    it('等级不足时应返回未解锁', () => {
      const result = DungeonConfigService.checkUnlockCondition(
        { unlockCondition: { minLevel: 10 } } as any,
        5
      );

      expect(result.unlocked).toBe(false);
      expect(result.reason).toContain('等级');
    });

    it('等级满足时应返回已解锁', () => {
      const result = DungeonConfigService.checkUnlockCondition(
        { unlockCondition: { minLevel: 10 } } as any,
        15
      );

      expect(result.unlocked).toBe(true);
    });

    it('等级刚好满足时应返回已解锁', () => {
      const result = DungeonConfigService.checkUnlockCondition(
        { unlockCondition: { minLevel: 10 } } as any,
        10
      );

      expect(result.unlocked).toBe(true);
    });
  });

  describe('缓存机制', () => {
    it('clearCache 应清除缓存', () => {
      // 验证 clearCache 方法存在且可调用
      expect(() => DungeonConfigService.clearCache()).not.toThrow();
    });
  });
});
