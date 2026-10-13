import type { ReputationSaveEntry } from '@/stores/reputationStore';
import type { ContributionLog, PlayerSectContribution } from '@/types/sectContribution';
import type { PlayerSectData, SectProgressData, SectType } from '@/types/sect';

function createDefaultContribution(sectType: SectType): PlayerSectContribution {
  return {
    sectType,
    totalContribution: 0,
    currentLevel: 1,
    lastPrayerTime: 0,
    todayTaskCount: 0,
    todayBattleCount: 0,
    lastUpdateTime: Date.now(),
  };
}

function createProgress(
  sectType: SectType,
  legacySect: PlayerSectData | null | undefined,
  contribution: PlayerSectContribution | undefined,
  reputation: number
): SectProgressData {
  const defaultContribution = createDefaultContribution(sectType);
  const isActiveLegacySect = legacySect?.sectType === sectType;

  return {
    sectType,
    reputation,
    sectLevel: isActiveLegacySect ? (legacySect?.sectLevel ?? 1) : 1,
    contribution: {
      sectType,
      totalContribution:
        contribution?.totalContribution ?? (isActiveLegacySect ? (legacySect?.sectContribution ?? 0) : 0),
      currentLevel: contribution?.currentLevel ?? defaultContribution.currentLevel,
      lastPrayerTime: contribution?.lastPrayerTime ?? defaultContribution.lastPrayerTime,
      todayTaskCount: contribution?.todayTaskCount ?? defaultContribution.todayTaskCount,
      todayBattleCount: contribution?.todayBattleCount ?? defaultContribution.todayBattleCount,
      lastUpdateTime: contribution?.lastUpdateTime ?? defaultContribution.lastUpdateTime,
    },
    contributionLogs: [],
    unlockedMartials: isActiveLegacySect ? (legacySect?.unlockedSkills ?? []) : [],
  };
}

function hasMeaningfulContribution(contribution: PlayerSectContribution | undefined): boolean {
  if (!contribution) return false;

  return (
    (contribution.totalContribution ?? 0) > 0 ||
    (contribution.currentLevel ?? 1) > 1 ||
    (contribution.lastPrayerTime ?? 0) > 0 ||
    (contribution.todayTaskCount ?? 0) > 0 ||
    (contribution.todayBattleCount ?? 0) > 0
  );
}

function hasMeaningfulReputation(
  reputation: Pick<ReputationSaveEntry, 'sectReputations'> | null | undefined,
  sectType: SectType
): boolean {
  return (reputation?.sectReputations?.[sectType] ?? 0) > 0;
}

function hasMeaningfulLegacySect(sect: PlayerSectData | null | undefined): sect is PlayerSectData & { sectType: SectType } {
  if (!sect?.sectType) return false;

  return (
    (sect.sectReputation ?? 0) > 0 ||
    (sect.sectContribution ?? 0) > 0 ||
    (sect.sectLevel ?? 1) > 1 ||
    (sect.unlockedSkills?.length ?? 0) > 0 ||
    (sect.lastTransferTime ?? 0) > 0
  );
}

export function mergeLegacySectData(
  sect: PlayerSectData | null | undefined,
  contribution: Record<string, PlayerSectContribution> | null | undefined,
  reputation: Pick<ReputationSaveEntry, 'sectReputations'> | null | undefined
): PlayerSectData {
  const contributionKeys = Object.keys(contribution ?? {}).filter(key =>
    hasMeaningfulContribution(contribution?.[key])
  );
  const reputationKeys = Object.keys(reputation?.sectReputations ?? {}).filter(key =>
    hasMeaningfulReputation(reputation, key as SectType)
  );
  const trustedLegacySect = hasMeaningfulLegacySect(sect) ? sect : null;
  const legacySectKey = trustedLegacySect?.sectType ? [trustedLegacySect.sectType] : [];

  const allSectKeys = [...new Set([...legacySectKey, ...contributionKeys, ...reputationKeys])] as SectType[];

  const inferredSectType =
    trustedLegacySect?.sectType ??
    (contributionKeys[0] as SectType | undefined) ??
    (reputationKeys[0] as SectType | undefined) ??
    null;

  const sectProgress = Object.fromEntries(
    allSectKeys.map(sectType => {
      const mergedReputation =
        reputation?.sectReputations?.[sectType] ??
        (trustedLegacySect?.sectType === sectType ? (trustedLegacySect.sectReputation ?? 0) : 0);

      return [
        sectType,
        createProgress(sectType, trustedLegacySect, contribution?.[sectType], mergedReputation),
      ];
    })
  );

  const activeProgress = inferredSectType ? sectProgress[inferredSectType] : null;

  return {
    sectType: inferredSectType,
    sectReputation: activeProgress?.reputation ?? 0,
    sectContribution: activeProgress?.contribution.totalContribution ?? 0,
    sectLevel: activeProgress?.sectLevel ?? 1,
    unlockedSkills: activeProgress?.unlockedMartials ?? [],
    lastTransferTime: trustedLegacySect?.lastTransferTime ?? 0,
    sectProgress,
  };
}
