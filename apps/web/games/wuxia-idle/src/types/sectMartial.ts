import type { SectType } from './sect';

export type SectMartialTier = 'basic' | 'advanced' | 'ultimate';

export interface SectMartialUnlockRequirements {
  minReputation: number;
  minContribution: number;
  minSectLevel: number;
}

export interface SectMartial {
  id: string;
  sectType: SectType;
  name: string;
  tier: SectMartialTier;
  description: string;
  effects: string[];
  unlockRequirements: SectMartialUnlockRequirements;
}

export interface SectMartialConfig {
  martials: SectMartial[];
}

export interface SectMartialProgressSnapshot {
  currentSect: SectType | null;
  reputation: number;
  contribution: number;
  sectLevel: number;
  unlockedMartials: string[];
}
