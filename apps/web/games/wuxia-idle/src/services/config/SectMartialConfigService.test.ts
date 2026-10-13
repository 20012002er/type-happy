import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SectType } from '@/types/sect';

describe('SectMartialConfigService', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('loads at least 3 martials for each sect', async () => {
    const { sectMartialConfigService } = await import('./SectMartialConfigService');
    await sectMartialConfigService.load();

    const sects = [
      SectType.少林,
      SectType.武当,
      SectType.峨眉,
      SectType.华山,
      SectType.丐帮,
    ];

    for (const sect of sects) {
      expect(sectMartialConfigService.getMartialsBySect(sect)).toHaveLength(3);
    }
  });

  it('evaluates martial unlock requirements against current sect progress', async () => {
    const { sectMartialConfigService } = await import('./SectMartialConfigService');
    await sectMartialConfigService.load();

    const martial = sectMartialConfigService.getMartialById('shaolin_ultimate_yijin');
    expect(martial).toBeTruthy();

    const locked = sectMartialConfigService.evaluateUnlock(
      martial!,
      {
        currentSect: SectType.少林,
        reputation: 1200,
        contribution: 1100,
        sectLevel: 2,
        unlockedMartials: [],
      }
    );
    expect(locked.canUnlock).toBe(false);

    const unlockable = sectMartialConfigService.evaluateUnlock(
      martial!,
      {
        currentSect: SectType.少林,
        reputation: 3800,
        contribution: 2600,
        sectLevel: 4,
        unlockedMartials: [],
      }
    );
    expect(unlockable.canUnlock).toBe(true);
  });
});
