import { describe, expect, it } from 'vitest';
import { mergeLegacySectData } from './sectSaveMigration';
import { SectType } from '@/types/sect';

describe('mergeLegacySectData', () => {
  it('merges legacy sect, contribution and reputation data into unified sect progress', () => {
    const merged = mergeLegacySectData(
      {
        sectType: SectType.少林,
        sectReputation: 30,
        sectContribution: 20,
        sectLevel: 2,
        unlockedSkills: ['shaolin_legacy_skill'],
        lastTransferTime: 99,
      },
      {
        shaolin: {
          sectType: 'shaolin',
          totalContribution: 70,
          currentLevel: 1,
          lastPrayerTime: 0,
          todayTaskCount: 0,
          todayBattleCount: 1,
          lastUpdateTime: 10,
        },
      },
      {
        sectReputations: {
          shaolin: 90,
        },
      }
    );

    expect(merged.sectType).toBe(SectType.少林);
    expect(merged.sectReputation).toBe(90);
    expect(merged.sectContribution).toBe(70);
    expect(merged.sectProgress?.shaolin.reputation).toBe(90);
    expect(merged.sectProgress?.shaolin.contribution.totalContribution).toBe(70);
    expect(merged.sectProgress?.shaolin.unlockedMartials).toContain('shaolin_legacy_skill');
  });

  it('can infer current sect from contribution data when legacy sectType is missing', () => {
    const merged = mergeLegacySectData(
      {
        sectType: null,
        sectReputation: 0,
        sectContribution: 0,
        sectLevel: 1,
        unlockedSkills: [],
        lastTransferTime: 0,
      },
      {
        wudang: {
          sectType: 'wudang',
          totalContribution: 55,
          currentLevel: 1,
          lastPrayerTime: 0,
          todayTaskCount: 0,
          todayBattleCount: 0,
          lastUpdateTime: 8,
        },
      },
      {
        sectReputations: {
          wudang: 44,
        },
      }
    );

    expect(merged.sectType).toBe(SectType.武当);
    expect(merged.sectProgress?.wudang.reputation).toBe(44);
    expect(merged.sectProgress?.wudang.contribution.totalContribution).toBe(55);
  });

  it('does not infer a sect from empty legacy contribution placeholders', () => {
    const merged = mergeLegacySectData(
      {
        sectType: null,
        sectReputation: 0,
        sectContribution: 0,
        sectLevel: 1,
        unlockedSkills: [],
        lastTransferTime: 0,
      },
      {
        shaolin: {
          sectType: 'shaolin',
          totalContribution: 0,
          currentLevel: 1,
          lastPrayerTime: 0,
          todayTaskCount: 0,
          todayBattleCount: 0,
          lastUpdateTime: 0,
        },
      },
      {
        sectReputations: {},
      }
    );

    expect(merged.sectType).toBeNull();
    expect(merged.sectProgress).toEqual({});
  });

  it('clears a corrupted sectType that has no real join evidence', () => {
    const merged = mergeLegacySectData(
      {
        sectType: SectType.少林,
        sectReputation: 0,
        sectContribution: 0,
        sectLevel: 1,
        unlockedSkills: [],
        lastTransferTime: 0,
      },
      {
        shaolin: {
          sectType: 'shaolin',
          totalContribution: 0,
          currentLevel: 1,
          lastPrayerTime: 0,
          todayTaskCount: 0,
          todayBattleCount: 0,
          lastUpdateTime: 0,
        },
      },
      {
        sectReputations: {},
      }
    );

    expect(merged.sectType).toBeNull();
    expect(merged.sectProgress).toEqual({});
  });
});
