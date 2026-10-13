import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useSectStore } from './sectStore';
import { SectType } from '@/types/sect';

describe('sectStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.clear();
  });

  it('uses a unified sect domain state for identity, reputation, contribution and martial unlocks', () => {
    const store = useSectStore();

    store.joinSect(SectType.少林);
    store.addSectReputation(SectType.少林, 120);
    store.addSectContribution(SectType.少林, 80);
    store.unlockMartial('shaolin_basic_fist');

    expect(store.sectType).toBe(SectType.少林);
    expect(store.sectReputation).toBe(120);
    expect(store.sectContribution).toBe(80);
    expect(store.unlockedSkills).toContain('shaolin_basic_fist');

    const progress = store.getSectProgress(SectType.少林);
    expect(progress.reputation).toBe(120);
    expect(progress.contribution.totalContribution).toBe(80);
    expect(progress.unlockedMartials).toContain('shaolin_basic_fist');
  });

  it('can restore legacy save data into unified sect progress', () => {
    const store = useSectStore();

    store.restoreFromSave({
      sectType: SectType.武当,
      sectReputation: 45,
      sectContribution: 30,
      sectLevel: 2,
      unlockedSkills: ['wudang_sword'],
      lastTransferTime: 123,
    });

    expect(store.sectType).toBe(SectType.武当);
    expect(store.getSectProgress(SectType.武当).reputation).toBe(45);
    expect(store.getSectProgress(SectType.武当).contribution.totalContribution).toBe(30);
    expect(store.getSectProgress(SectType.武当).unlockedMartials).toContain('wudang_sword');
  });

  it('tracks first victory rewards by sect and by day', () => {
    const store = useSectStore();

    store.joinSect(SectType.少林);

    const firstDay = new Date('2026-03-06T09:00:00Z').getTime();
    const nextDay = new Date('2026-03-07T09:00:00Z').getTime();

    expect(store.canClaimVictoryReward(SectType.少林, firstDay)).toBe(true);

    store.markVictoryRewardClaimed(SectType.少林, firstDay);

    expect(store.canClaimVictoryReward(SectType.少林, firstDay)).toBe(false);
    expect(store.canClaimVictoryReward(SectType.少林, nextDay)).toBe(true);
  });
});
