<!--
  多敌人战斗展示组件
  网格卡片展示敌人状态
-->
<template>
  <div class="multi-enemy-battle">
    <div v-if="enemies.length === 0" class="empty-state">
      <Swords class="empty-icon" />
      <div class="empty-text">{{ emptyText }}</div>
    </div>

    <div v-else class="enemies-grid">
      <div
        v-for="enemy in enemies"
        :key="enemy.instanceId"
        class="enemy-card"
        :class="getEnemyClass(enemy)"
      >
        <!-- 敌人头部 -->
        <div class="enemy-header">
          <component :is="getTierIcon(enemy.tier)" class="enemy-tier" :class="enemy.tier" />
          <span class="enemy-name">{{ enemy.name }}</span>
          <span class="enemy-level">Lv.{{ enemy.stats.level }}</span>
        </div>

        <!-- HP 条 -->
        <div class="hp-bar-container">
          <div
            class="hp-bar"
            :style="{ width: getHpPercent(enemy) + '%' }"
            :class="getHpClass(enemy)"
          ></div>
          <span class="hp-text">
            {{ enemy.stats.hp }} / {{ enemy.stats.maxHp }}
          </span>
        </div>

        <!-- 属性信息 -->
        <div class="enemy-stats">
          <div class="stat-item">
            <Swords class="stat-icon" />
            <span class="stat-value">{{ enemy.stats.attack }}</span>
          </div>
          <div class="stat-item">
            <Shield class="stat-icon" />
            <span class="stat-value">{{ enemy.stats.defense }}</span>
          </div>
        </div>

        <!-- 伤害飘字 -->
        <transition-group name="damage-float" tag="div" class="damage-floats">
          <div
            v-for="dmg in getDamageFloats(enemy.instanceId)"
            :key="dmg.id"
            class="damage-float"
            :class="{ crit: dmg.isCrit }"
          >
            {{ dmg.isCrit ? '暴击!' : '' }} -{{ dmg.value }}
          </div>
        </transition-group>

        <!-- 击败标记 -->
        <div v-if="enemy.stats.hp <= 0" class="defeated-overlay">
          <span class="defeated-text">已击败</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { Swords, Shield, Star, User, Crown } from 'lucide-vue-next';
import type { RuntimeEnemy, DungeonPhase } from '@/types/dungeon';

interface DamageFloat {
  id: string;
  value: number;
  isCrit: boolean;
}

const props = defineProps<{
  enemies: RuntimeEnemy[];
  phase: DungeonPhase;
}>();

const damageFloats = ref<Map<string, DamageFloat[]>>(new Map());
let floatIdCounter = 0;

const emptyText = computed(() => {
  switch (props.phase) {
    case 'preparing': return '准备进入战斗...';
    case 'between': return '准备下一波敌人...';
    case 'settlement': return '战斗结束，结算中...';
    case 'finished': return '恭喜通关！';
    case 'failed': return '挑战失败';
    case 'stopped': return '已撤退';
    default: return '等待战斗开始';
  }
});

const getTierIcon = (tier: string) => {
  switch (tier) {
    case 'boss': return Crown;
    case 'elite': return Star;
    default: return User;
  }
};

const getEnemyClass = (enemy: RuntimeEnemy) => {
  return {
    'is-boss': enemy.tier === 'boss',
    'is-elite': enemy.tier === 'elite',
    'is-defeated': enemy.stats.hp <= 0
  };
};

const getHpPercent = (enemy: RuntimeEnemy) => {
  if (enemy.stats.maxHp <= 0) return 0;
  return Math.max(0, Math.min(100, (enemy.stats.hp / enemy.stats.maxHp) * 100));
};

const getHpClass = (enemy: RuntimeEnemy) => {
  const percent = getHpPercent(enemy);
  if (percent <= 20) return 'hp-critical';
  if (percent <= 50) return 'hp-low';
  return 'hp-normal';
};

const getDamageFloats = (instanceId: string) => {
  return damageFloats.value.get(instanceId) ?? [];
};

// 添加伤害飘字
const addDamageFloat = (instanceId: string, value: number, isCrit: boolean = false) => {
  const floats = damageFloats.value.get(instanceId) ?? [];
  const newFloat: DamageFloat = {
    id: `float_${floatIdCounter++}`,
    value,
    isCrit
  };
  floats.push(newFloat);
  damageFloats.value.set(instanceId, floats);

  // 1秒后移除
  setTimeout(() => {
    const currentFloats = damageFloats.value.get(instanceId) ?? [];
    const idx = currentFloats.findIndex(f => f.id === newFloat.id);
    if (idx !== -1) {
      currentFloats.splice(idx, 1);
      damageFloats.value.set(instanceId, currentFloats);
    }
  }, 1000);
};

// 监听敌人 HP 变化来触发伤害飘字
const previousHp = ref<Map<string, number>>(new Map());

watch(
  () => props.enemies,
  (newEnemies) => {
    for (const enemy of newEnemies) {
      const prevHp = previousHp.value.get(enemy.instanceId);
      if (prevHp !== undefined && prevHp > enemy.stats.hp) {
        const damage = prevHp - enemy.stats.hp;
        // 简单判断是否暴击（伤害超过平均值的1.5倍）
        const isCrit = damage > enemy.stats.maxHp * 0.15;
        addDamageFloat(enemy.instanceId, damage, isCrit);
      }
      previousHp.value.set(enemy.instanceId, enemy.stats.hp);
    }
  },
  { deep: true }
);

// 暴露方法供外部调用
defineExpose({
  addDamageFloat
});
</script>

<style scoped>
.multi-enemy-battle {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
}

.empty-icon {
  width: 48px;
  height: 48px;
  opacity: 0.3;
  color: rgba(17, 17, 17, 0.5);
}

.empty-text {
  font-size: 14px;
  color: rgba(17, 17, 17, 0.5);
}

.enemies-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 14px;
}

.enemy-card {
  position: relative;
  background: #fff;
  border: 1px solid rgba(17, 17, 17, 0.12);
  border-radius: 12px;
  padding: 14px;
  transition: all 0.2s ease;
}

.enemy-card.is-boss {
  border-color: rgba(234, 179, 8, 0.5);
  background: linear-gradient(135deg, rgba(234, 179, 8, 0.05) 0%, #fff 100%);
}

.enemy-card.is-elite {
  border-color: rgba(139, 92, 246, 0.4);
  background: linear-gradient(135deg, rgba(139, 92, 246, 0.03) 0%, #fff 100%);
}

.enemy-card.is-defeated {
  opacity: 0.5;
}

.enemy-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.enemy-tier {
  width: 16px;
  height: 16px;
}

.enemy-name {
  flex: 1;
  font-size: 14px;
  font-weight: 600;
  color: #111;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.enemy-level {
  font-size: 11px;
  color: rgba(17, 17, 17, 0.5);
  padding: 2px 6px;
  background: rgba(17, 17, 17, 0.05);
  border-radius: 4px;
}

.hp-bar-container {
  position: relative;
  height: 20px;
  background: rgba(17, 17, 17, 0.08);
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 10px;
}

.hp-bar {
  height: 100%;
  transition: width 0.3s ease;
  border-radius: 4px;
}

.hp-normal {
  background: linear-gradient(90deg, #22c55e 0%, #16a34a 100%);
}

.hp-low {
  background: linear-gradient(90deg, #eab308 0%, #ca8a04 100%);
}

.hp-critical {
  background: linear-gradient(90deg, #ef4444 0%, #dc2626 100%);
}

.hp-text {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 500;
  color: #111;
  text-shadow: 0 0 2px rgba(255, 255, 255, 0.8);
}

.enemy-stats {
  display: flex;
  gap: 12px;
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
}

.stat-icon {
  width: 14px;
  height: 14px;
  color: rgba(17, 17, 17, 0.5);
}

.stat-value {
  color: #111;
  font-weight: 500;
}

/* 伤害飘字 */
.damage-floats {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  pointer-events: none;
}

.damage-float {
  position: absolute;
  font-size: 16px;
  font-weight: 700;
  color: #dc2626;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
  white-space: nowrap;
}

.damage-float.crit {
  font-size: 20px;
  color: #f59e0b;
}

.damage-float-enter-active {
  animation: float-up 1s ease-out;
}

.damage-float-leave-active {
  animation: fade-out 0.3s ease-out;
}

@keyframes float-up {
  0% {
    opacity: 1;
    transform: translateY(0);
  }
  100% {
    opacity: 0;
    transform: translateY(-40px);
  }
}

@keyframes fade-out {
  0% {
    opacity: 1;
  }
  100% {
    opacity: 0;
  }
}

/* 击败覆盖层 */
.defeated-overlay {
  position: absolute;
  inset: 0;
  background: rgba(17, 17, 17, 0.6);
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.defeated-text {
  font-size: 14px;
  font-weight: 600;
  color: #fff;
  padding: 6px 12px;
  background: rgba(239, 68, 68, 0.8);
  border-radius: 6px;
}
</style>
