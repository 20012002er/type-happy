<!--
  战斗舞台组件
  显示当前地图的所有怪物
  点击怪物开始无限循环战斗
-->
<template>
  <div class="combat-arena">
    <!-- 怪物列表 -->
    <div v-if="!inCombat && !isFarming" class="monster-list">
      <div class="list-title">选择挑战的敌人</div>
      <div class="monsters-grid">
        <InfoPopover
          v-for="monster in availableMonsters"
          :key="monster.id"
          type="enemy"
          :enemy="monster"
          :show-underline="false"
        >
          <button
            class="monster-card"
            @click="startFarming(monster)"
          >
            <div class="monster-name">{{ monster.name }}</div>
            <div class="monster-stats">
              <div class="stat-row">
                <Crown class="stat-icon" />
                <span>Lv.{{ monster.stats.level }}</span>
              </div>
              <div class="stat-row">
                <Heart class="stat-icon" />
                <span>{{ formatNumber(monster.stats.maxHp) }}</span>
              </div>
              <div class="stat-row-group">
                <div class="stat-row">
                  <Sword class="stat-icon" />
                  <span>{{ formatNumber(monster.stats.attack) }}</span>
                </div>
                <div class="stat-row">
                  <Shield class="stat-icon" />
                  <span>{{ formatNumber(monster.stats.defense) }}</span>
                </div>
              </div>
            </div>
          </button>
        </InfoPopover>
      </div>
      <div v-if="availableMonsters.length === 0" class="no-monsters">
        当前地区没有敌人
      </div>
    </div>

    <!-- 战斗舞台（选择怪物后一直显示） -->
    <div v-if="isFarming" class="battle-stage">
      <!-- 玩家区域 -->
      <div class="fighter-area player-area">
        <div 
          class="fighter-text player-text"
          :class="{ 
            attacking: playerAttacking,
            hit: playerHit,
            defeated: playerHp <= 0
          }"
        >
          {{ playerName }}
        </div>
        <div class="fighter-info">
          <div class="hp-bar-container">
            <div class="hp-bar player-hp" :style="{ width: playerHpPercent + '%' }"></div>
            <span class="hp-text">{{ playerHp }} / {{ playerMaxHp }}</span>
          </div>
          <div v-if="showEnergy" class="energy-bar-container">
            <div class="energy-bar" :style="{ width: playerEnergyPercent + '%' }"></div>
            <span class="energy-text">内力: {{ Math.floor(playerEnergy) }} / {{ playerMaxEnergy }}</span>
          </div>
          <div v-if="showStamina" class="stamina-bar-container">
            <div class="stamina-bar" :style="{ width: playerStaminaPercent + '%' }"></div>
            <span class="stamina-text">体力: {{ Math.floor(playerStamina) }} / {{ playerMaxStamina }}</span>
          </div>
        </div>
      </div>

      <!-- 状态标记（根据战斗状态动态显示） -->
      <div class="vs-mark" :class="`status-${battleStatus}`">
        <component :is="getStatusIcon()" class="status-icon" />
      </div>

      <!-- 敌人区域 -->
      <div class="fighter-area enemy-area">
        <div 
          class="fighter-text enemy-text"
          :class="{ 
            attacking: enemyAttacking,
            hit: enemyHit,
            defeated: enemyHp <= 0
          }"
        >
          {{ enemyName }}
        </div>
        <div class="fighter-info">
          <div class="hp-bar-container">
            <div class="hp-bar enemy-hp" :style="{ width: enemyHpPercent + '%' }"></div>
            <span class="hp-text">{{ enemyHp }} / {{ enemyMaxHp }}</span>
          </div>
        </div>
      </div>

      <!-- 伤害数字飘出（支持多个同时显示） -->
      <div 
        v-for="damage in damageNumbers" 
        :key="damage.id"
        :class="['damage-float', damage.type, `target-${damage.target}`]"
        :style="{ 
          animationDelay: damage.delay + 'ms',
          '--random-offset': (Math.random() * 10 - 5)
        }"
      >
        {{ damage.value }}
      </div>
    </div>

    <!-- 战斗控制（循环战斗时显示） -->
    <div v-if="isFarming" class="combat-controls">
      <div class="farming-info">
        <span>{{ isStopping ? '正在停止...' : '正在挑战: ' + (currentFarmingMonster?.name || '') }}</span>
        <span class="farming-stats">战绩: {{ sessionWins }}胜 / {{ sessionLosses }}败</span>
        <span v-if="isStopping" class="stopping-hint">等待当前战斗结束</span>
      </div>
      <div class="control-buttons">
        <button 
          class="control-btn stop-btn" 
          :disabled="isStopping"
          @click="stopFarming"
        >
          {{ isStopping ? '正在停止...' : '停止挑战' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, type Component } from 'vue';
import { Moon, Clock, Swords, Check, X, Zap, RefreshCw, Heart, Sword, Shield, Crown } from 'lucide-vue-next';
import { useCombatStore } from '@/stores/combatStore';
import { usePlayerStore } from '@/stores/playerStore';
import { useGameLogStore } from '@/stores/gameLogStore';
import { useMapStore } from '@/stores/mapStore';
import { loadMonsterGroups, type MonsterEntry } from '@/services/config/MonsterGroupService';
import { getEnemy } from '@/services/config/EnemyConfigService';
import { ConsumableService } from '@/services/consumableService';
import type { Enemy } from '@/types/enemy';
import { storeToRefs } from 'pinia';
import { useCombatAutomationStore } from '@/stores/combatAutomationStore';
import InfoPopover from '@/components/InfoPopover.vue';

const combatStore = useCombatStore();
const playerStore = usePlayerStore();
const gameLogStore = useGameLogStore();
const mapStore = useMapStore();
const automationStore = useCombatAutomationStore();

const { inCombat, currentEnemy } = storeToRefs(combatStore);
const defaultSkillEmoji = '';
const {
  isRunning: automationIsRunning,
  isStopping: automationIsStopping,
  phase: automationPhase,
  currentEnemy: automationEnemy,
  wins: automationWins,
  losses: automationLosses,
  waitingProgress,
  waitingRemainingMs,
  lastResult: automationLastResult
} = storeToRefs(automationStore);

// 战斗UI状态
const playerAttacking = ref(false);
const playerHit = ref(false);
const enemyAttacking = ref(false);
const enemyHit = ref(false);

// ✅ 伤害数字数组：支持多个伤害数字同时飘动
interface DamageFloat {
  id: string;
  value: string;
  type: 'player-damage' | 'enemy-damage' | 'heal' | 'skill-damage';
  target: 'player' | 'enemy';
  delay: number;
}
const damageNumbers = ref<DamageFloat[]>([]);
const damageIdCounter = ref(0);

// 🔒 自动回血执行锁，防止并发执行导致重复消耗
let isAutoHealRunning = false;
// 🔒 自动回内力执行锁
let isAutoEnergyRunning = false;
// 🔒 自动回体力执行锁
let isAutoStaminaRunning = false;

let lastAutoHealAfterHp = -1;
let lastAutoEnergyAfterValue = -1;
let lastAutoStaminaAfterValue = -1;

const isFarming = computed(() => automationPhase.value !== 'idle');
const isStopping = computed(() => automationIsStopping.value);
const currentFarmingMonster = computed<Enemy | null>(() => automationEnemy.value as Enemy | null);
const sessionWins = computed(() => automationWins.value);
const sessionLosses = computed(() => automationLosses.value);
const availableMonsters = ref<Enemy[]>([]);
const battleStatus = computed<'idle' | 'waiting' | 'fighting' | 'victory' | 'defeat'>(() => {
  switch (automationPhase.value) {
    case 'preparing':
    case 'waiting':
      return 'waiting';
    case 'fighting':
      return 'fighting';
    case 'stopping':
      return 'waiting';
    case 'idle':
    default:
      if (automationLastResult.value) {
        return automationLastResult.value.winner === 'player' ? 'victory' : 'defeat';
      }
      return 'idle';
  }
});

// 战斗数据
const playerHp = ref(0);
const playerMaxHp = ref(0);
const playerEnergy = ref(0);
const playerMaxEnergy = ref(0);
const playerStamina = ref(0);
const playerMaxStamina = ref(0);
const enemyHp = ref(0);
const enemyMaxHp = ref(0);

const playerName = computed(() => playerStore.player.name);
const enemyName = computed(() => {
  // 优先使用当前刷怪的怪物名称，其次使用战斗中的敌人名称
  if (currentFarmingMonster.value) {
    return currentFarmingMonster.value.name;
  }
  return currentEnemy.value?.name || '未知敌人';
});

const playerHpPercent = computed(() => 
  playerMaxHp.value > 0 ? (playerHp.value / playerMaxHp.value) * 100 : 0
);
const playerEnergyPercent = computed(() => 
  playerMaxEnergy.value > 0 ? (Math.floor(playerEnergy.value) / playerMaxEnergy.value) * 100 : 0
);
const playerStaminaPercent = computed(() => 
  playerMaxStamina.value > 0 ? (Math.floor(playerStamina.value) / playerMaxStamina.value) * 100 : 0
);
const enemyHpPercent = computed(() => 
  enemyMaxHp.value > 0 ? (enemyHp.value / enemyMaxHp.value) * 100 : 0
);

const showEnergy = computed(() => playerMaxEnergy.value > 0);
const showStamina = computed(() => playerMaxStamina.value > 0);

const syncDisplayedState = () => {
  playerHp.value = playerStore.player.stats.hp;
  playerMaxHp.value = playerStore.player.stats.maxHp;
  playerEnergy.value = playerStore.player.stats.energy || 0;
  playerMaxEnergy.value = playerStore.player.stats.maxEnergy || 0;
  const staminaGauge = (playerStore.player as any).stamina;
  playerStamina.value = staminaGauge?.current ?? 0;
  playerMaxStamina.value = staminaGauge?.max ?? 0;

  const enemy = automationEnemy.value;
  if (enemy) {
    enemyMaxHp.value = enemy.stats.maxHp;
    if (!inCombat.value) {
      enemyHp.value = enemy.stats.hp;
    }
  }
};

/**
 * 根据战斗状态获取图标
 */
function getStatusIcon(): Component {
  switch (battleStatus.value) {
    case 'idle':
      return Moon; // 待命
    case 'waiting':
      return Clock; // 寻敌中
    case 'fighting':
      return Swords; // 战斗中
    case 'victory':
      return Check; // 胜利
    case 'defeat':
      return X; // 失败
    default:
      return Swords;
  }
}

/**
 * 加载当前地图的所有怪物
 */
async function loadMonsters(): Promise<void> {
  try {
    const location = mapStore.currentLocation;
    if (!location || !location.idle?.monsterGroup) {
      availableMonsters.value = [];
      return;
    }

    const monsterGroupId = location.idle.monsterGroup;
    const monsterGroups = await loadMonsterGroups();
    const group = monsterGroups.groups[monsterGroupId];
    
    if (!group) {
      availableMonsters.value = [];
      return;
    }

    // 收集所有怪物（normal, elite, boss）
    const monsterIds = new Set<string>();
    
    if (group.normal) {
      group.normal.forEach((entry: MonsterEntry) => monsterIds.add(entry.enemyId));
    }
    if (group.elite) {
      group.elite.forEach((entry: MonsterEntry) => monsterIds.add(entry.enemyId));
    }
    if (group.boss) {
      group.boss.forEach((entry: MonsterEntry) => monsterIds.add(entry.enemyId));
    }

    // 加载所有怪物数据
    const monsters: Enemy[] = [];
    for (const id of monsterIds) {
      const enemy = await getEnemy(id);
      if (enemy) {
        monsters.push(enemy);
      }
    }

    availableMonsters.value = monsters;
  } catch (error) {
    console.error('[CombatArena] 加载怪物列表失败:', error);
    availableMonsters.value = [];
  }
}


/**
 * 监听战斗状态变化
 * 只处理UI同步，不处理战绩（战绩由事件钩子处理）
 */
watch(inCombat, (newVal) => {
  if (newVal) {
    // 战斗开始 - 初始化显示数据
    playerHp.value = playerStore.player.stats.hp;
    playerMaxHp.value = playerStore.player.stats.maxHp;
    playerEnergy.value = playerStore.player.stats.energy || 0;
    playerMaxEnergy.value = playerStore.player.stats.maxEnergy || 0;
    const staminaGauge = (playerStore.player as any).stamina;
    playerStamina.value = staminaGauge?.current ?? 0;
    playerMaxStamina.value = staminaGauge?.max ?? 0;

    lastAutoHealAfterHp = playerStore.player.stats.hp;
    lastAutoEnergyAfterValue = playerStore.player.stats.energy || 0;
    lastAutoStaminaAfterValue = staminaGauge?.current ?? -1;
    
    if (currentEnemy.value) {
      enemyHp.value = currentEnemy.value.stats.hp;
      enemyMaxHp.value = currentEnemy.value.stats.maxHp;
    }
  } else {
    // 战斗结束 - 清空动画状态
    playerAttacking.value = false;
    playerHit.value = false;
    enemyAttacking.value = false;
    enemyHit.value = false;
    damageNumbers.value = []; // 清空所有伤害数字

    lastAutoHealAfterHp = -1;
    lastAutoEnergyAfterValue = -1;
    lastAutoStaminaAfterValue = -1;
    
    if (isStopping.value) {
      console.log('[CombatArena] 战斗结束，等待自动化流程收尾');
    }
  }
}, { immediate: true });

/**
 * 监听游戏日志，提取战斗信息并触发动画
 */
watch(() => gameLogStore.logs, (newLogs, oldLogs) => {
  if (newLogs.length === 0) return;
  if (!inCombat.value) return;
  
  // ✅ 修复：日志数组用 unshift 添加，最新日志在索引 0
  const latestLog = newLogs[0];
  
  // 只处理战斗日志
  if (latestLog.type !== 'combat') return;
  
  console.log('[CombatArena] 收到战斗日志:', latestLog.message);
  
  const skillId = latestLog.data?.skillId as string | undefined;
  const skillEmoji = latestLog.data?.skillEmoji as string | undefined;
  const isSkillAttack = Boolean(skillId) || (
    latestLog.message.includes('【') &&
    latestLog.message.includes('】') &&
    !latestLog.message.includes('【普攻】')
  );
  
  // 解析战斗动作，触发动画
  if (latestLog.message.includes(playerName.value) && latestLog.message.includes('造成')) {
    if (isSkillAttack) {
      console.log('[CombatArena] 触发玩家技能攻击动画');
      triggerPlayerSkillAttack(latestLog.message, skillEmoji);
    } else {
      console.log('[CombatArena] 触发玩家普攻动画');
      triggerPlayerAttack(latestLog.message);
    }
  } else if (latestLog.message.includes(enemyName.value) && latestLog.message.includes('造成')) {
    if (isSkillAttack) {
      console.log('[CombatArena] 触发敌人技能攻击动画');
      triggerEnemySkillAttack(latestLog.message, skillEmoji);
    } else {
      console.log('[CombatArena] 触发敌人攻击动画');
      triggerEnemyAttack(latestLog.message);
    }
  }
}, { deep: true });

/**
 * 读取CombatSettings的配置
 */
function getCombatSettings() {
  try {
    const saved = localStorage.getItem('wuxia_combat_settings');
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (error) {
    console.error('[CombatArena] 读取配置失败:', error);
  }
  return null;
}

/**
 * 自动回血检测逻辑（抽取为独立函数）
 * 
 * 🔒 使用执行锁防止并发：
 * - watch 监听 HP 变化会触发此函数
 * - 递归调用也会执行此函数
 * - 如果不加锁，会导致多次并发执行，造成物品重复消耗
 */
async function checkAndUseHealingItem() {
  if (isAutoHealRunning) return;

  const currentHpSnapshot = playerStore.player.stats.hp;

  if (lastAutoHealAfterHp > 0 && currentHpSnapshot >= lastAutoHealAfterHp) {
    return;
  }

  isAutoHealRunning = true;

  try {
    if (!isFarming.value || !inCombat.value) return;

    const settings = getCombatSettings();
    const autoHeal = settings?.autoHeal;

    if (!autoHeal?.materialId || autoHeal.threshold <= 0) {
      return;
    }

    const materialId = autoHeal.materialId;
    const threshold = autoHeal.threshold;
    const { hp: currentHp, maxHp } = playerStore.player.stats;
    if (maxHp <= 0) return;

    const hpPercent = (currentHp / maxHp) * 100;
    if (hpPercent >= threshold || hpPercent <= 0) return;

    const result = await ConsumableService.useById(materialId, true, { ignoreCooldown: true });

    if (result.ok && 'hpRestored' in result && result.hpRestored > 0) {
      addDamageFloat(`+${result.hpRestored}`, 'heal', 'player');
      await nextTick();

      const { hp: afterHp } = playerStore.player.stats;
      const afterPercent = (afterHp / maxHp) * 100;

      console.info(
        `[AutoHeal] ${result.itemName} ×1: HP ${currentHp}(${hpPercent.toFixed(1)}%) → ${afterHp}(${afterPercent.toFixed(1)}%)`
      );

      lastAutoHealAfterHp = afterHp;
    } else {
      const reason = 'reason' in result ? result.reason : 'unknown';
      console.warn(`[AutoHeal] 使用 ${materialId} 失败: ${reason}`);
    }
  } finally {
    isAutoHealRunning = false;
  }
}

/**
 * 🆕 自动回内力检测逻辑（参考自动回血实现）
 * 
 * 🔒 使用执行锁防止并发：
 * - watch 监听 Energy 变化会触发此函数
 * - 递归调用也会执行此函数
 * - 如果不加锁，会导致多次并发执行，造成物品重复消耗
 */
async function checkAndUseEnergyItem() {
  if (isAutoEnergyRunning) return;

  const currentEnergySnapshot = playerStore.player.stats.energy || 0;

  if (lastAutoEnergyAfterValue > 0 && currentEnergySnapshot >= lastAutoEnergyAfterValue) {
    return;
  }

  isAutoEnergyRunning = true;

  try {
    if (!isFarming.value || !inCombat.value) return;

    const settings = getCombatSettings();
    const autoEnergy = settings?.autoEnergy;

    if (!autoEnergy?.materialId || autoEnergy.threshold <= 0) {
      return;
    }

    const materialId = autoEnergy.materialId;
    const threshold = autoEnergy.threshold;
    const maxEnergy = playerStore.player.stats.maxEnergy || 0;
    if (maxEnergy <= 0) return;

    const currentEnergy = playerStore.player.stats.energy || 0;
    const energyPercent = (currentEnergy / maxEnergy) * 100;

    if (energyPercent >= threshold) return;

    const result = await ConsumableService.useById(materialId, true, { ignoreCooldown: true });

    if (result.ok && 'energyRestored' in result && result.energyRestored > 0) {
      addDamageFloat(`+${result.energyRestored}`, 'heal', 'player');
      await nextTick();

      const updatedEnergy = playerStore.player.stats.energy || 0;
      const updatedPercent = (updatedEnergy / maxEnergy) * 100;

      console.info(
        `[AutoEnergy] ${result.itemName} ×1: 内力 ${currentEnergy}(${energyPercent.toFixed(1)}%) → ${updatedEnergy}(${updatedPercent.toFixed(1)}%)`
      );

      lastAutoEnergyAfterValue = updatedEnergy;
    } else {
      const reason = 'reason' in result ? result.reason : 'unknown';
      console.warn(`[AutoEnergy] 使用 ${materialId} 失败: ${reason}`);
    }
  } finally {
    isAutoEnergyRunning = false;
  }
}

/**
 * 🆕 自动回体力检测逻辑
 */
async function checkAndUseStaminaItem() {
  if (isAutoStaminaRunning) return;

  const staminaGauge = (playerStore.player as any).stamina;
  if (!staminaGauge) return;

  if (lastAutoStaminaAfterValue > 0 && staminaGauge.current >= lastAutoStaminaAfterValue) {
    return;
  }

  isAutoStaminaRunning = true;

  try {
    if (!isFarming.value || !inCombat.value) return;

    const settings = getCombatSettings();
    const autoStamina = settings?.autoStamina;

    if (!autoStamina?.materialId || autoStamina.threshold <= 0) {
      return;
    }

    const materialId = autoStamina.materialId;
    const threshold = autoStamina.threshold;
    const maxStamina = staminaGauge.max || 0;
    if (maxStamina <= 0) return;

    const currentStamina = staminaGauge.current;
    const staminaPercent = (currentStamina / maxStamina) * 100;

    if (staminaPercent >= threshold) return;

    const result = await ConsumableService.useById(materialId, true, { ignoreCooldown: true });

    if (result.ok && 'staminaRestored' in result && result.staminaRestored > 0) {
      addDamageFloat(`+${result.staminaRestored}`, 'heal', 'player');
      await nextTick();

      const updatedGauge = (playerStore.player as any).stamina;
      const updatedCurrent = updatedGauge?.current ?? currentStamina;
      const updatedPercent = updatedGauge && updatedGauge.max > 0
        ? (updatedGauge.current / updatedGauge.max) * 100
        : 0;

      console.info(
        `[AutoStamina] ${result.itemName} ×1: 体力 ${currentStamina}(${staminaPercent.toFixed(1)}%) → ${updatedCurrent}(${updatedPercent.toFixed(1)}%)`
      );

      lastAutoStaminaAfterValue = updatedCurrent;
    } else {
      const reason = 'reason' in result ? result.reason : 'unknown';
      console.warn(`[AutoStamina] 使用 ${materialId} 失败: ${reason}`);
    }
  } finally {
    isAutoStaminaRunning = false;
  }
}

/**
 * 监听玩家HP变化（实时更新UI + 事件驱动的自动回血）
 * 
 * 性能优化：使用事件驱动而非轮询
 * - 只在HP实际变化时触发检测
 * - 零CPU开销（不使用 setInterval）
 * - 响应更及时（受伤后立即检测）
 */
watch(
  () => playerStore.player.stats.hp,
  async (newHp, oldHp) => {
    if (!inCombat.value) return;

    playerHp.value = newHp;

    if (!isFarming.value) return;
    if (typeof oldHp !== 'number') return;
    if (newHp >= oldHp) return;

    await checkAndUseHealingItem();
  }
);

/**
 * 🆕 监听玩家内力变化（实时更新UI + 事件驱动的自动回内力）
 * 
 * 性能优化：使用事件驱动而非轮询
 * - 只在内力实际变化时触发检测
 * - 零CPU开销（不使用 setInterval）
 * - 响应更及时（使用技能后立即检测）
 */
watch(
  () => playerStore.player.stats.energy,
  async (newEnergy, oldEnergy) => {
    if (!inCombat.value) return;

    playerEnergy.value = newEnergy || 0;

    if (!isFarming.value) return;
    if (!showEnergy.value) return;
    if (typeof oldEnergy !== 'number') return;
    if ((newEnergy || 0) >= oldEnergy) return;

    await checkAndUseEnergyItem();
  }
);

/**
 * 🆕 监听玩家体力变化（实时更新UI + 自动回体力）
 */
watch(
  () => (playerStore.player as any).stamina?.current,
  async (newStamina: number | undefined, oldStamina: number | undefined) => {
    const staminaGauge = (playerStore.player as any).stamina;
    playerStamina.value = newStamina ?? 0;
    playerMaxStamina.value = staminaGauge?.max ?? 0;

    if (!inCombat.value) return;
    if (!isFarming.value) return;
    if (typeof oldStamina !== 'number') return;
    if ((newStamina ?? 0) >= oldStamina) return;

    await checkAndUseStaminaItem();
  }
);

/**
 * 监听敌人HP变化（实时更新）
 */
watch(() => currentEnemy.value?.stats.hp, (newHp) => {
  if (inCombat.value && newHp !== undefined) {
    enemyHp.value = newHp;
  }
});

watch(
  () => automationEnemy.value,
  (enemy) => {
    if (!enemy) return;
    enemyMaxHp.value = enemy.stats.maxHp;
    if (!inCombat.value) {
      enemyHp.value = enemy.stats.hp;
    }
  },
  { immediate: true, deep: true }
);

/**
 * 触发玩家攻击动画
 */
function triggerPlayerAttack(message: string): void {
  playerAttacking.value = true;
  enemyHit.value = true;
  
  // 提取伤害数字
  const match = message.match(/造成 (\d+) 伤害/);
  if (match) {
    addDamageFloat(`-${match[1]}`, 'player-damage', 'enemy');
  }
  
  setTimeout(() => {
    playerAttacking.value = false;
    enemyHit.value = false;
  }, 300);
}

/**
 * 🆕 触发玩家技能攻击动画（更华丽的视觉效果）
 */
function triggerPlayerSkillAttack(message: string, skillEmoji?: string): void {
  playerAttacking.value = true;
  enemyHit.value = true;
  
  // 提取伤害数字
  const damageMatch = message.match(/造成 (\d+) 伤害/);
  const emoji = skillEmoji ?? defaultSkillEmoji;
  
  if (damageMatch) {
    // 🌟 技能伤害飘字带emoji前缀
    addDamageFloat(`${emoji} -${damageMatch[1]}`, 'skill-damage', 'enemy');
  }
  
  // 技能攻击动画持续时间更长（500ms vs 普攻的300ms）
  setTimeout(() => {
    playerAttacking.value = false;
    enemyHit.value = false;
  }, 500);
}

/**
 * 🆕 触发敌人技能攻击动画（玩家头顶显示emoji技能飘字）
 */
function triggerEnemySkillAttack(message: string, skillEmoji?: string): void {
  enemyAttacking.value = true;
  playerHit.value = true;
  
  // 提取伤害数字
  const damageMatch = message.match(/造成 (\d+) 伤害/);
  const emoji = skillEmoji ?? defaultSkillEmoji;
  
  if (damageMatch) {
    // 🌟 技能伤害飘字带emoji前缀（目标：玩家）
    addDamageFloat(`${emoji} -${damageMatch[1]}`, 'skill-damage', 'player');
  }
  
  // 技能攻击动画持续时间更长（500ms vs 普攻的300ms）
  setTimeout(() => {
    enemyAttacking.value = false;
    playerHit.value = false;
  }, 500);
}

/**
 * 触发敌人攻击动画
 */
function triggerEnemyAttack(message: string): void {
  enemyAttacking.value = true;
  playerHit.value = true;
  
  // 提取伤害数字
  const match = message.match(/造成 (\d+) 伤害/);
  if (match) {
    addDamageFloat(`-${match[1]}`, 'enemy-damage', 'player');
  }
  
  setTimeout(() => {
    enemyAttacking.value = false;
    playerHit.value = false;
  }, 300);
}

/**
 * 添加伤害数字飘动效果
 * @param value 伤害值（如 "-68" 或 "🩷 +100"）
 * @param type 伤害类型（玩家伤害、敌人伤害或回血）
 */
function addDamageFloat(
  value: string,
  type: 'player-damage' | 'enemy-damage' | 'heal' | 'skill-damage',
  target: 'player' | 'enemy'
): void {
  const id = `damage_${damageIdCounter.value++}`;
  
  // ✅ 添加随机偏移，避免伤害数字重叠
  // 每个伤害数字的延迟在0-50ms之间，产生微小的时间差
  const delay = Math.random() * 50;
  
  const damage: DamageFloat = { id, value, type, target, delay };
  damageNumbers.value.push(damage);
  
  // 1秒后移除这个伤害数字（与动画时长一致）
  setTimeout(() => {
    const index = damageNumbers.value.findIndex(d => d.id === id);
    if (index > -1) {
      damageNumbers.value.splice(index, 1);
    }
  }, 1000);
  
  // ✅ 性能优化：限制同时显示的伤害数字数量（最多10个）
  if (damageNumbers.value.length > 10) {
    damageNumbers.value.shift(); // 移除最老的
  }
}

/**
 * 格式化数字（千位分隔符）
 */
function formatNumber(num: number): string {
  if (num >= 10000) {
    return (num / 10000).toFixed(1) + 'w';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'k';
  }
  return num.toString();
}

/**
 * 开始刷怪（使用自动化体系）
 */
function startFarming(monster: Enemy): void {
  if (automationIsRunning.value || automationIsStopping.value) return;

  playerHp.value = playerStore.player.stats.hp;
  playerMaxHp.value = playerStore.player.stats.maxHp;
  playerEnergy.value = playerStore.player.stats.energy || 0;
  playerMaxEnergy.value = playerStore.player.stats.maxEnergy || 0;
  const staminaGauge = (playerStore.player as any).stamina;
  playerStamina.value = staminaGauge?.current ?? 0;
  playerMaxStamina.value = staminaGauge?.max ?? 0;
  enemyHp.value = monster.stats.hp;
  enemyMaxHp.value = monster.stats.maxHp;

  automationStore.start(monster);
}

/**
 * 停止刷怪
 */
function stopFarming(): void {
  if (!automationIsRunning.value && !automationIsStopping.value) return;
  automationStore.requestStop();
}

/**
 * 监听地图变化，重新加载怪物列表
 */
watch(() => mapStore.currentLocationId, () => {
  loadMonsters();
});

/**
 * 组件挂载时加载怪物列表
 */
onMounted(() => {
  loadMonsters();
  syncDisplayedState();
});
</script>

<style scoped>
.combat-arena {
  display: flex;
  flex-direction: column;
  gap: 16px;
  height: 100%;
  padding: 16px;
}

.monster-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.list-title {
  font-size: 13px;
  font-weight: 600;
  color: rgba(17, 17, 17, 0.75);
}

.monsters-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 10px;
}

.monster-card {
  display: flex;
  flex-direction: column;
  gap: 6px;
  border-radius: 12px;
  border: 1px solid rgba(17, 17, 17, 0.12);
  background: rgba(249, 249, 248, 0.8);
  padding: 10px 12px;
  text-align: left;
  transition: border-color 0.2s ease, transform 0.2s ease;
  cursor: pointer;
  min-height: 100px;
  width: 100%;
}

.monster-card:hover {
  border-color: rgba(17, 17, 17, 0.35);
  transform: translateY(-1px);
}

.monster-name {
  font-size: 13px;
  font-weight: 600;
  color: #111;
}

.monster-stats {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 11px;
  color: rgba(17, 17, 17, 0.55);
  flex: 1;
}

.stat-row {
  display: flex;
  align-items: center;
  gap: 4px;
}

.stat-row-group {
  display: flex;
  gap: 12px;
  margin-top: auto;
}

.stat-icon {
  width: 12px;
  height: 12px;
  flex-shrink: 0;
}

.no-monsters {
  padding: 14px;
  border-radius: 12px;
  border: 1px dashed rgba(17, 17, 17, 0.16);
  text-align: center;
  font-size: 12px;
  color: rgba(17, 17, 17, 0.5);
}

.battle-stage {
  flex: 1;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 28px;
  padding: 24px 28px;
  border-radius: 18px;
  background: radial-gradient(circle at 30% 20%, rgba(255, 255, 255, 0.16), transparent 55%),
    radial-gradient(circle at 70% 80%, rgba(255, 255, 255, 0.1), transparent 60%),
    #141417;
  color: #fff;
  overflow: hidden;
  min-height: 180px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.04), 0 12px 30px rgba(20, 20, 23, 0.35);
}

.battle-stage::before,
.battle-stage::after {
  content: '';
  position: absolute;
  width: 45%;
  height: 220%;
  top: -60%;
  background: radial-gradient(circle, rgba(255, 255, 255, 0.25) 0%, rgba(255, 255, 255, 0) 65%);
  filter: blur(32px);
  opacity: 0.35;
  transform: rotate(18deg);
}

.battle-stage::before {
  left: -5%;
}

.battle-stage::after {
  right: -5%;
  transform: rotate(-18deg);
}

.fighter-area {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  gap: 14px;
  width: 32%;
}

.fighter-text {
  font-size: 26px;
  font-weight: 700;
  letter-spacing: 1.8px;
  text-transform: uppercase;
  transition: transform 0.28s ease, color 0.28s ease, text-shadow 0.28s ease;
  text-shadow: 0 8px 24px rgba(0, 0, 0, 0.45);
}

.player-text.attacking {
  transform: translateX(8px) skewX(-8deg);
  color: #8adfff;
  text-shadow: 0 10px 28px rgba(53, 165, 255, 0.55);
}

.player-text.hit {
  transform: translateX(-6px) rotate(-3deg);
  color: #ff7575;
  text-shadow: 0 6px 20px rgba(255, 117, 117, 0.65);
}

.enemy-text.attacking {
  transform: translateX(-8px) skewX(8deg);
  color: #ffd580;
  text-shadow: 0 10px 28px rgba(255, 173, 66, 0.55);
}

.enemy-text.hit {
  transform: translateX(6px) rotate(3deg);
  color: #ff7575;
  text-shadow: 0 6px 20px rgba(255, 117, 117, 0.65);
}

.fighter-text.defeated {
  color: rgba(255, 255, 255, 0.4);
  transform: scale(0.9);
  filter: blur(0.6px);
}

.vs-mark {
  position: relative;
  z-index: 1;
  font-size: 52px;
  font-weight: 800;
  color: rgba(255, 255, 255, 0.22);
  text-shadow: 0 0 18px rgba(255, 255, 255, 0.18);
  animation: vsPulse 1.4s ease-in-out infinite;
  display: flex;
  align-items: center;
  justify-content: center;
}

.status-icon {
  width: 52px;
  height: 52px;
  color: rgba(255, 255, 255, 0.22);
}

@keyframes vsPulse {
  0%, 100% {
    transform: scale(1);
    opacity: 0.7;
  }
  50% {
    transform: scale(1.12);
    opacity: 1;
  }
}

.damage-float {
  position: absolute;
  font-size: 22px;
  font-weight: 800;
  text-shadow: 0 10px 28px rgba(0, 0, 0, 0.45);
  animation: damageFloat 0.85s ease-out forwards;
  pointer-events: none;
}

.damage-float.target-player {
  left: 20%;
  top: 22%;
}

.damage-float.target-enemy {
  left: 80%;
  top: 22%;
}

.damage-float.player-damage {
  color: #ff6161;
}

.damage-float.enemy-damage {
  color: #7ccfff;
}

.damage-float.skill-damage {
  color: #ffe066;
}

.damage-float.heal {
  color: #7befb2;
}

@keyframes damageFloat {
  0% {
    opacity: 0;
    transform: translate(-50%, 14px) scale(0.85);
  }
  18% {
    opacity: 1;
    transform: translate(-50%, -4px) scale(1.05);
  }
  70% {
    opacity: 0.92;
  }
  100% {
    opacity: 0;
    transform: translate(calc(-50% + var(--random-offset, 0px)), -42px) scale(1);
  }
}

.fighter-info {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.hp-bar-container,
.energy-bar-container,
.stamina-bar-container {
  position: relative;
  height: 12px;
  border-radius: 999px;
  background: rgba(17, 17, 17, 0.08);
  overflow: hidden;
}

.hp-bar,
.energy-bar,
.stamina-bar {
  position: absolute;
  inset: 0;
  border-radius: inherit;
  transition: width 0.3s ease;
}

.player-hp {
  background: linear-gradient(90deg, #0f9d58, #0b7a44);
}

.enemy-hp {
  background: linear-gradient(90deg, #c53929, #8c2d20);
}

.energy-bar {
  background: linear-gradient(90deg, #2962ff, #1740b0);
}

.stamina-bar {
  background: linear-gradient(90deg, #f9a825, #c1790c);
}

.hp-text,
.energy-text,
.stamina-text {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  color: rgba(255, 255, 255, 0.85);
  text-shadow: 0 0 4px rgba(0, 0, 0, 0.3);
}

.combat-controls {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 14px;
  border-radius: 12px;
  border: 1px solid rgba(17, 17, 17, 0.12);
  background: #fff;
  font-size: 12px;
  color: rgba(17, 17, 17, 0.6);
}

.control-buttons {
  display: flex;
  gap: 10px;
}

.control-btn {
  padding: 8px 14px;
  border-radius: 10px;
  border: 1px solid #111;
  background: #111;
  color: #fff;
  font-size: 12px;
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;
}

.control-btn:hover:not(:disabled) {
  background: #fff;
  color: #111;
}

.control-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

@media (max-width: 900px) {
  .battle-stage {
    flex-direction: column;
    text-align: center;
    gap: 16px;
  }

  .fighter-area {
    width: 100%;
    align-items: center;
  }

  .vs-mark {
    order: 3;
  }

  .damage-float.target-player {
    left: 50%;
    top: 24%;
  }

  .damage-float.target-enemy {
    left: 50%;
    top: 76%;
  }
}
</style>
