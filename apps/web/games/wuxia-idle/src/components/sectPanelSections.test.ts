import { describe, expect, it } from 'vitest';
import { getSectPanelSections } from './sectPanelSections';

describe('getSectPanelSections', () => {
  it('returns the default joined sections in stable order', () => {
    expect(getSectPanelSections()).toEqual([
      { key: 'overview', label: '总览' },
      { key: 'martials', label: '武学' },
      { key: 'contribution', label: '贡献' },
    ]);
  });
});
