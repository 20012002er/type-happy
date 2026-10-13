import JSON5 from 'json5';
import SECT_MARTIALS_RAW from '@/assets/configs/sect-martials.json5?raw';
import { ref } from 'vue';
import type {
  SectMartial,
  SectMartialConfig,
  SectMartialProgressSnapshot,
} from '@/types/sectMartial';
import type { SectType } from '@/types/sect';

interface UnlockEvaluation {
  canUnlock: boolean;
  reasons: string[];
}

class SectMartialConfigService {
  private config: SectMartialConfig | null = null;
  private loaded = ref(false);

  async load(): Promise<void> {
    if (this.loaded.value) return;

    this.config = JSON5.parse(SECT_MARTIALS_RAW) as SectMartialConfig;
    this.loaded.value = true;
  }

  getMartialsBySect(sectType: SectType): SectMartial[] {
    if (!this.loaded.value || !this.config) return [];
    return this.config.martials.filter(martial => martial.sectType === sectType);
  }

  getMartialById(id: string): SectMartial | undefined {
    if (!this.loaded.value || !this.config) return undefined;
    return this.config.martials.find(martial => martial.id === id);
  }

  evaluateUnlock(
    martial: SectMartial,
    progress: SectMartialProgressSnapshot
  ): UnlockEvaluation {
    const reasons: string[] = [];

    if (progress.currentSect !== martial.sectType) {
      reasons.push('当前门派不匹配');
    }

    if (progress.reputation < martial.unlockRequirements.minReputation) {
      reasons.push('门派声望不足');
    }

    if (progress.contribution < martial.unlockRequirements.minContribution) {
      reasons.push('门派贡献不足');
    }

    if (progress.sectLevel < martial.unlockRequirements.minSectLevel) {
      reasons.push('门派等级不足');
    }

    return {
      canUnlock: reasons.length === 0,
      reasons,
    };
  }
}

export const sectMartialConfigService = new SectMartialConfigService();
