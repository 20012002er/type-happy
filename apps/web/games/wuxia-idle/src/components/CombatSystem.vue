<template>
  <div class="combat-panel" v-if="enemy">
    <div class="row">
      <div>敌人：{{ enemy.name }}</div>
      <div>等级：{{ enemy.stats.level }}</div>
      <div>生命：{{ enemy.stats.hp }}/{{ enemy.stats.maxHp }}</div>
    </div>
    <button class="btn" @click="start">开始战斗</button>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { usePlayerStore } from '@/stores/playerStore';
import { useCombatStore } from '@/stores/combatStore';
import { getEnemy } from '@/services/config/EnemyConfigService';

const playerStore = usePlayerStore();
const combatStore = useCombatStore();

// 简单示例：固定选择“山贼”（从配置加载）
const enemy = ref<any | null>(null);
onMounted(async () => {
  enemy.value = await getEnemy('bandit');
});

const start = async () => {
  if (!enemy.value) return;
  await combatStore.startCombat(playerStore.player, enemy.value);
};
</script>

<style scoped>
.combat-panel {
  border: var(--border-width-thin) solid var(--color-border-light);
  padding: var(--spacing-md);
  margin-top: var(--spacing-md);
}
.row { display: flex; gap: var(--spacing-md); margin-bottom: var(--spacing-sm); }
.btn {
  background: var(--color-bg-secondary);
  border: var(--border-width-thin) solid var(--color-border-medium);
  padding: var(--spacing-xs) var(--spacing-sm);
  cursor: pointer;
}
.btn:hover { background: var(--color-bg-hover); }
</style>


