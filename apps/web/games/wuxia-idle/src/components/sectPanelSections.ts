export type SectPanelSectionKey = 'overview' | 'martials' | 'contribution';

export interface SectPanelSection {
  key: SectPanelSectionKey;
  label: string;
}

export function getSectPanelSections(): SectPanelSection[] {
  return [
    { key: 'overview', label: '总览' },
    { key: 'martials', label: '武学' },
    { key: 'contribution', label: '贡献' },
  ];
}
