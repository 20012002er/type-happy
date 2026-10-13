import { describe, expect, it } from 'vitest';
import { normalizeGameView } from './gameViewRouting';

describe('normalizeGameView', () => {
  it('maps legacy sectContribution view to sect', () => {
    expect(normalizeGameView('sectContribution')).toBe('sect');
  });

  it('keeps unrelated views unchanged', () => {
    expect(normalizeGameView('achievements')).toBe('achievements');
  });
});
