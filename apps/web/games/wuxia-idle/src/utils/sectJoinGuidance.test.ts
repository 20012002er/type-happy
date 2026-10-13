import { describe, expect, it } from 'vitest';
import { getSectJoinGuidance } from './sectJoinGuidance';

describe('getSectJoinGuidance', () => {
  it('returns locked guidance when player level is below requirement', () => {
    const guidance = getSectJoinGuidance(7, 10);

    expect(guidance.canJoin).toBe(false);
    expect(guidance.currentLevel).toBe(7);
    expect(guidance.requiredLevel).toBe(10);
    expect(guidance.levelsRemaining).toBe(3);
    expect(guidance.progressText).toBe('当前 7 级，达到 10 级后可加入门派');
  });

  it('returns unlocked guidance once player reaches requirement', () => {
    const guidance = getSectJoinGuidance(10, 10);

    expect(guidance.canJoin).toBe(true);
    expect(guidance.levelsRemaining).toBe(0);
    expect(guidance.progressText).toBe('已满足加入门派条件');
  });
});
