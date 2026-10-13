<!--
  地牢战斗舞台
  采用格斗游戏风格的左右对战布局
  左侧：玩家角色
  右侧：敌人列表
-->
<template>
  <div class="battle-arena">
    <!-- 玩家侧 (左) -->
    <div class="fighter-side player-side">
      <div class="fighter-card player-card">
        <div class="fighter-header">
          <User class="fighter-icon" />
          <div class="fighter-info">
            <span class="fighter-name">{{ player.name }}</span>
            <span class="fighter-level">Lv.{{ player.level }}</span>
          </div>
        </div>
        
        <!-- HP 条 -->
        <div class="hp-section">
          <div class="hp-bar-container">
            <div 
              class="hp-bar player-hp" 
              :style="{ width: playerHpPercent + '%' }"
              :class="playerHpClass"
            ></div>
          </div>
          <div class="hp-text">
            <span class="hp-current">{{ player.hp }}</span>
            <span class="hp-separator">/</span>
            <span class="hp-max">{{ player.maxHp }}</span>
          </div>
        </div>

        <!-- 属性 -->
        <div class="fighter-stats">
          <div class="stat">
            <Swords class="stat-icon" />
            <span class="stat-value">{{ player.attack }}</span>
          </div>
          <div class="stat">
            <Shield class="stat-icon" />
            <span class="stat-value">{{ player.defense }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- VS 标志 -->
    <div class="vs-divider">
      <span class="vs-text">VS</span>
      <div class="wave-info">{{ waveProgress }}</div>
    </div>

    <!-- 敌人侧 (右) -->
    <div class="fighter-side enemy-side">
      <div v-if="enemies.length === 0" class="no-enemies">
        <span class="waiting-icon">...</span>
        <span class="waiting-text">{{ emptyText }}</span>
      </div>
      
      <div v-else class="enemies-list">
        <div 
          v-for="enemy in enemies" 
          :key="enemy.instanceId"
          class="fighter-card enemy-card"
          :class="{ 
            'is-defeated': enemy.stats.hp <= 0,
            'is-boss': enemy.tier === 'boss',
            'is-elite': enemy.tier === 'elite'
          }"
        >
          <div class="fighter-header">
            <component :is="getTierIcon(enemy.tier)" class="fighter-icon" />
            <div class="fighter-info">
              <span class="fighter-name">{{ enemy.name }}</span>
              <span class="fighter-level">Lv.{{ enemy.stats.level }}</span>
            </div>
          </div>
          
          <!-- HP 条 -->
          <div class="hp-section">
            <div class="hp-bar-container">
              <div 
                class="hp-bar enemy-hp" 
                :style="{ width: getHpPercent(enemy) + '%' }"
                :class="getHpClass(enemy)"
              ></div>
            </div>
            <div class="hp-text">
              <span class="hp-current">{{ enemy.stats.hp }}</span>
              <span class="hp-separator">/</span>
              <span class="hp-max">{{ enemy.stats.maxHp }}</span>
            </div>
          </div>

          <!-- 属性 -->
          <div class="fighter-stats">
            <div class="stat">
              <Swords class="stat-icon" />
              <span class="stat-value">{{ enemy.stats.attack }}</span>
            </div>
            <div class="stat">
              <Shield class="stat-icon" />
              <span class="stat-value">{{ enemy.stats.defense }}</span>
            </div>
          </div>

          <!-- 击败标记 -->
          <div v-if="enemy.stats.hp <= 0" class="defeated-badge">
            已击败
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { User, Swords, Shield, Crown, Star } from 'lucide-vue-next';
import type { RuntimeEnemy, DungeonPhase } from '@/types/dungeon';

interface PlayerState {
  name: string;
  level: number;
  hp: number;
  maxHp: number;
  attack: number;
  defense: number;
}

const props = defineProps<{
  player: PlayerState;
  enemies: RuntimeEnemy[];
  phase: DungeonPhase;
  waveProgress: string;
}>();

// 玩家 HP 百分比
const playerHpPercent = computed(() => {
  if (props.player.maxHp <= 0) return 0;
  return Math.max(0, Math.min(100, (props.player.hp / props.player.maxHp) * 100));
});

// 玩家 HP 样式
const playerHpClass = computed(() => {
  const percent = playerHpPercent.value;
  if (percent <= 20) return 'hp-critical';
  if (percent <= 50) return 'hp-low';
  return 'hp-normal';
});

// 空状态文字
const emptyText = computed(() => {
  switch (props.phase) {
    case 'preparing': return '准备战斗...';
    case 'between': return '下一波即将到来...';
    case 'settlement': return '战斗结束';
    case 'finished': return '挑战成功！';
    case 'failed': return '挑战失败';
    case 'stopped': return '已撤退';
    default: return '等待中...';
  }
});

// 获取敌人等级图标
const getTierIcon = (tier: string) => {
  switch (tier) {
    case 'boss': return Crown;
    case 'elite': return Star;
    default: return User;
  }
};

// 获取敌人 HP 百分比
const getHpPercent = (enemy: RuntimeEnemy) => {
  if (enemy.stats.maxHp <= 0) return 0;
  return Math.max(0, Math.min(100, (enemy.stats.hp / enemy.stats.maxHp) * 100));
};

// 获取敌人 HP 样式
const getHpClass = (enemy: RuntimeEnemy) => {
  const percent = getHpPercent(enemy);
  if (percent <= 20) return 'hp-critical';
  if (percent <= 50) return 'hp-low';
  return 'hp-normal';
};
</script>

<style scoped>
.battle-arena {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  gap: 16px;
  height: 100%;
  padding: 16px;
  align-items: start;
}

/* 战斗双方区域 */
.fighter-side {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.player-side {
  align-items: flex-end;
}

.enemy-side {
  align-items: flex-start;
}

/* VS 分隔 */
.vs-divider {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 20px 12px;
}

.vs-text {
  font-size: 24px;
  font-weight: 800;
  color: rgba(17, 17, 17, 0.15);
  letter-spacing: 2px;
}

.wave-info {
  font-size: 11px;
  color: rgba(17, 17, 17, 0.5);
  text-align: center;
  white-space: nowrap;
}

/* 角色卡片 */
.fighter-card {
  position: relative;
  background: #fff;
  border: 1px solid rgba(17, 17, 17, 0.12);
  border-radius: 12px;
  padding: 14px;
  min-width: 180px;
  max-width: 220px;
  transition: all 0.2s ease;
}

.player-card {
  border-color: rgba(59, 130, 246, 0.3);
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.05) 0%, #fff 100%);
}

.enemy-card.is-boss {
  border-color: rgba(234, 179, 8, 0.5);
  background: linear-gradient(135deg, rgba(234, 179, 8, 0.08) 0%, #fff 100%);
}

.enemy-card.is-elite {
  border-color: rgba(139, 92, 246, 0.4);
  background: linear-gradient(135deg, rgba(139, 92, 246, 0.05) 0%, #fff 100%);
}

.enemy-card.is-defeated {
  opacity: 0.5;
}

/* 角色头部 */
.fighter-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}

.fighter-icon {
  width: 24px;
  height: 24px;
  color: rgba(17, 17, 17, 0.7);
}

.fighter-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.fighter-name {
  font-size: 14px;
  font-weight: 600;
  color: #111;
}

.fighter-level {
  font-size: 11px;
  color: rgba(17, 17, 17, 0.5);
}

/* HP 区域 */
.hp-section {
  margin-bottom: 10px;
}

.hp-bar-container {
  height: 16px;
  background: rgba(17, 17, 17, 0.08);
  border-radius: 8px;
  overflow: hidden;
  margin-bottom: 4px;
}

.hp-bar {
  height: 100%;
  border-radius: 8px;
  transition: width 0.3s ease;
}

.hp-bar.hp-normal {
  background: linear-gradient(90deg, #22c55e 0%, #16a34a 100%);
}

.hp-bar.hp-low {
  background: linear-gradient(90deg, #eab308 0%, #ca8a04 100%);
}

.hp-bar.hp-critical {
  background: linear-gradient(90deg, #ef4444 0%, #dc2626 100%);
}

.player-hp.hp-normal {
  background: linear-gradient(90deg, #3b82f6 0%, #2563eb 100%);
}

.hp-text {
  display: flex;
  justify-content: center;
  gap: 2px;
  font-size: 11px;
  color: rgba(17, 17, 17, 0.6);
}

.hp-current {
  font-weight: 600;
  color: #111;
}

/* 属性 */
.fighter-stats {
  display: flex;
  justify-content: center;
  gap: 16px;
}

.stat {
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
  font-weight: 500;
  color: #111;
}

/* 击败标记 */
.defeated-badge {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: rgba(239, 68, 68, 0.9);
  color: #fff;
  font-size: 12px;
  font-weight: 600;
  padding: 6px 12px;
  border-radius: 6px;
}

/* 敌人列表 */
.enemies-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-height: 400px;
  overflow-y: auto;
}

/* 无敌人状态 */
.no-enemies {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 40px 20px;
  color: rgba(17, 17, 17, 0.4);
}

.waiting-icon {
  font-size: 32px;
  opacity: 0.5;
}

.waiting-text {
  font-size: 13px;
}

/* 响应式 */
@media (max-width: 600px) {
  .battle-arena {
    grid-template-columns: 1fr;
    grid-template-rows: auto auto auto;
  }

  .vs-divider {
    flex-direction: row;
    padding: 8px 0;
  }

  .fighter-side {
    align-items: center;
  }

  .fighter-card {
    max-width: 100%;
    width: 100%;
  }
}
</style>
