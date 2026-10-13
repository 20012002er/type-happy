import { computed } from 'vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('sectContributionConfig', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('在配置异步加载完成后应驱动 computed 自动更新', async () => {
    const { sectContributionConfig } = await import('./sectContributionConfig');

    const viewState = computed(() => ({
      levelName: sectContributionConfig.getLevelByContribution(70)?.name ?? null,
      rewardCount: sectContributionConfig.getAvailableRewards('shaolin').length,
      gainCount: sectContributionConfig.getAvailableGains(1).length,
    }));

    expect(viewState.value).toEqual({
      levelName: null,
      rewardCount: 0,
      gainCount: 0,
    });

    await sectContributionConfig.load();

    expect(viewState.value).toEqual({
      levelName: '初入门派',
      rewardCount: 8,
      gainCount: 3,
    });
  });
});
