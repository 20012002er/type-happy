import { defineStore } from 'pinia';
import { ref } from 'vue';

interface LevelUpGains {
  hpIncrease: number;
  attackIncrease: number;
  defenseIncrease: number;
}

interface LevelUpAnimationData {
  fromLevel: number;
  toLevel: number;
  gains: LevelUpGains;
}

export const useLevelUpAnimationStore = defineStore('levelUpAnimation', () => {
  const showAnimation = ref(false);
  const animationData = ref<LevelUpAnimationData>({
    fromLevel: 1,
    toLevel: 2,
    gains: {
      hpIncrease: 0,
      attackIncrease: 0,
      defenseIncrease: 0
    }
  });

  // 触发升级动画
  const triggerLevelUpAnimation = (fromLevel: number, toLevel: number, gains: LevelUpGains) => {
    animationData.value = {
      fromLevel,
      toLevel,
      gains
    };
    showAnimation.value = true;
  };

  // 关闭升级动画
  const closeLevelUpAnimation = () => {
    showAnimation.value = false;
  };

  return {
    showAnimation,
    animationData,
    triggerLevelUpAnimation,
    closeLevelUpAnimation
  };
});
