export interface SectJoinGuidance {
  canJoin: boolean;
  currentLevel: number;
  requiredLevel: number;
  levelsRemaining: number;
  progressText: string;
}

export function getSectJoinGuidance(
  currentLevel: number,
  requiredLevel: number = 10
): SectJoinGuidance {
  const levelsRemaining = Math.max(0, requiredLevel - currentLevel);
  const canJoin = levelsRemaining === 0;

  return {
    canJoin,
    currentLevel,
    requiredLevel,
    levelsRemaining,
    progressText: canJoin
      ? '已满足加入门派条件'
      : `当前 ${currentLevel} 级，达到 ${requiredLevel} 级后可加入门派`,
  };
}
