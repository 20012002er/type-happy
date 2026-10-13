import { defineStore } from 'pinia';
import { ref } from 'vue';

export const useAutoSettingsStore = defineStore('autoSettings', () => {
  const enabled = ref(true);
  const hpThresholdPercent = ref(0.3); // 30%
  const staminaThreshold = ref(20);
  const usePotionId = ref<string>('potion_small');
  const useFoodId = ref<string>('egg_soup');

  return {
    enabled,
    hpThresholdPercent,
    staminaThreshold,
    usePotionId,
    useFoodId
  };
});

