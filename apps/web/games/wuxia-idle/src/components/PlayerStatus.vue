<template>
  <div class="player-status">
    <div class="header-line">
      <span class="name">{{ player.name }}</span>
      <span class="title">（{{ player.title }}）</span>
    </div>

    <div class="grid">
      <div class="line">
        <span class="label">{{ t('game.player.level') }}：</span>
        <span class="value">{{ player.stats.level }}</span>
        <span class="muted">｜{{ Math.floor(expProgress) }}%（{{ currentLevelExp }} / {{ player.stats.requiredExp }} EXP）</span>
      </div>

      <div class="line">
        <span class="label">{{ t('game.player.health') }}：</span>
        <span class="value">{{ player.stats.hp }}/{{ player.stats.maxHp }}</span>
      </div>

      <div class="line">
        <InfoPopover type="stat" :stat-key="'attack'" :stat-title="t('game.player.attack')" :stat-value="player.stats.attack" :stat-desc="t('game.stats.strength.desc')">
          <span class="label">{{ t('game.player.attack') }}：</span>
        </InfoPopover>
        <span class="value">{{ player.stats.attack }}</span>
      </div>

      <div class="line">
        <InfoPopover type="stat" :stat-key="'defense'" :stat-title="t('game.player.defense')" :stat-value="player.stats.defense" :stat-desc="'减少所受伤害（预留更多加成）'">
          <span class="label">{{ t('game.player.defense') }}：</span>
        </InfoPopover>
        <span class="value">{{ player.stats.defense }}</span>
      </div>

      <div class="line">
        <InfoPopover type="stat" :stat-key="'critChance'" :stat-title="t('game.player.critChance')" :stat-value="formatPercent(player.stats.critChance)" :stat-desc="t('game.stats.critChance.desc')">
          <span class="label">{{ t('game.player.critChance') }}：</span>
        </InfoPopover>
        <span class="value">{{ formatPercent(player.stats.critChance) }}</span>
      </div>

      <div class="line">
        <InfoPopover type="stat" :stat-key="'critMultiplier'" :stat-title="t('game.player.critMultiplier')" :stat-value="formatFixed(player.stats.critMultiplier, 2) + 'x'" :stat-desc="t('game.stats.critMultiplier.desc')">
          <span class="label">{{ t('game.player.critMultiplier') }}：</span>
        </InfoPopover>
        <span class="value">{{ formatFixed(player.stats.critMultiplier, 2) }}x</span>
      </div>

      <div class="line">
        <InfoPopover type="stat" :stat-key="'dodgeChance'" :stat-title="t('game.player.dodgeChance')" :stat-value="formatPercent(player.stats.dodgeChance)" :stat-desc="t('game.stats.dodgeChance.desc')">
          <span class="label">{{ t('game.player.dodgeChance') }}：</span>
        </InfoPopover>
        <span class="value">{{ formatPercent(player.stats.dodgeChance) }}</span>
      </div>

      <div class="line">
        <InfoPopover type="stat" :stat-key="'energy'" :stat-title="t('game.player.energy')" :stat-value="Math.floor(player.stats.energy) + '/' + player.stats.maxEnergy" :stat-desc="t('game.stats.energy.desc')">
          <span class="label">{{ t('game.player.energy') }}：</span>
        </InfoPopover>
        <span class="value">{{ Math.floor(player.stats.energy) }}/{{ player.stats.maxEnergy }}</span>
        <span class="muted">（恢复：{{ energyRegenRate }}/分钟）</span>
      </div>

      <div class="line">
        <span class="label">体力：</span>
        <span class="value">{{ Math.floor(stamina.current) }}/{{ stamina.max }}</span>
        <span class="muted">（恢复：{{ staminaRegenRate }}/分钟）</span>
      </div>

      <div class="line">
        <span class="label">饱食度：</span>
        <span class="value">{{ satiety.current }}/{{ satiety.max }}</span>
      </div>

      <div class="line">
        <InfoPopover type="stat" :stat-key="'strength'" :stat-title="t('game.player.strength')" :stat-value="player.stats.strength" :stat-desc="t('game.stats.strength.desc')">
          <span class="label">{{ t('game.player.strength') }}：</span>
        </InfoPopover>
        <span class="value">{{ player.stats.strength }}</span>
      </div>

      <div class="line">
        <InfoPopover type="stat" :stat-key="'agility'" :stat-title="t('game.player.agility')" :stat-value="player.stats.agility" :stat-desc="t('game.stats.agility.desc')">
          <span class="label">{{ t('game.player.agility') }}：</span>
        </InfoPopover>
        <span class="value">{{ player.stats.agility }}</span>
      </div>

      <div class="line">
        <InfoPopover type="stat" :stat-key="'vitality'" :stat-title="t('game.player.vitality')" :stat-value="player.stats.vitality" :stat-desc="t('game.stats.vitality.desc')">
          <span class="label">{{ t('game.player.vitality') }}：</span>
        </InfoPopover>
        <span class="value">{{ player.stats.vitality }}</span>
      </div>

      <div class="line">
        <InfoPopover type="stat" :stat-key="'spirit'" :stat-title="t('game.player.spirit')" :stat-value="player.stats.spirit" :stat-desc="t('game.stats.spirit.desc')">
          <span class="label">{{ t('game.player.spirit') }}：</span>
        </InfoPopover>
        <span class="value">{{ player.stats.spirit }}</span>
      </div>

      <div class="line">
        <InfoPopover type="stat" :stat-key="'luck'" :stat-title="t('game.player.luck')" :stat-value="player.stats.luck" :stat-desc="t('game.stats.luck.desc')">
          <span class="label">{{ t('game.player.luck') }}：</span>
        </InfoPopover>
        <span class="value">{{ player.stats.luck }}</span>
      </div>

      <div class="line">
        <InfoPopover type="stat" :stat-key="'accuracy'" :stat-title="t('game.player.accuracy')" :stat-value="formatPercent(player.stats.accuracy)" :stat-desc="t('game.stats.accuracy.desc')">
          <span class="label">{{ t('game.player.accuracy') }}：</span>
        </InfoPopover>
        <span class="value">{{ formatPercent(player.stats.accuracy) }}</span>
      </div>

      <div class="line">
        <InfoPopover type="stat" :stat-key="'speed'" :stat-title="t('game.player.speed')" :stat-value="player.stats.speed" :stat-desc="t('game.stats.speed.desc')">
          <span class="label">{{ t('game.player.speed') }}：</span>
        </InfoPopover>
        <span class="value">{{ player.stats.speed }}</span>
      </div>

      <div class="line">
        <span class="label">{{ t('game.player.gold') }}：</span>
        <span class="value">{{ player.resources.gold }}</span>
      </div>

      <div class="line">
        <span class="label">{{ t('game.player.reputation') }}：</span>
        <span class="value">{{ player.resources.reputation }}</span>
      </div>
    </div>

    <div class="effects" v-if="activeEffects.length > 0">
      <div class="effects-header">状态</div>
      <ul class="effects-list">
        <li v-for="eff in activeEffects" :key="eff.id" class="effect-item">
          <span class="effect-name">{{ eff.name }}</span>
          <span class="effect-time">（{{ formatMs(eff.remainingMs) }}）</span>
        </li>
      </ul>
    </div>

    <div class="player-state" v-if="playerStore.isBusy">
      <span class="state-dot"></span>
      <span class="state-text">{{ getStateText(player.state) }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import i18n from '@/locales';
import { usePlayerStore } from '@/stores/playerStore';
import { PlayerState } from '@/types/player';
import { StatusEffectService } from '@/services/StatusEffectService';
import InfoPopover from '@/components/InfoPopover.vue';
import { staminaService } from '@/services/staminaService';

const t = i18n.global.t as (key: string, args?: any) => string;
const playerStore = usePlayerStore();

const player = computed(() => playerStore.player);
const expProgress = computed(() => playerStore.expProgress);
const hpProgress = computed(() => playerStore.hpProgress);

const currentLevelExp = computed(() => player.value.stats.currentExp);

const activeEffects = computed(() => StatusEffectService.getActiveEffectsDetailed());

// 关键：Pinia 会对 setup store 中的 ref/computed 进行解包，直接读即可
const stamina = computed(() => (playerStore as any).stamina || { current: 0, max: 0 });
const satiety = computed(() => (playerStore as any).satiety || { current: 0, max: 0 });

// 恢复速度
const staminaRegenRate = computed(() => staminaService.getStaminaRegenRate());
const energyRegenRate = computed(() => staminaService.getEnergyRegenRate(player.value));

const formatMs = (ms: number) => {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return `${h}h`;
};

const getStateText = (state: PlayerState): string => {
  const stateMap = {
    [PlayerState.IDLE]: '空闲',
    [PlayerState.MEDITATING]: '打坐中...',
    [PlayerState.PRACTICING]: '练功中...',
    [PlayerState.EXPLORING]: '闯荡中...',
    [PlayerState.RESTING]: '休息中...',
    [PlayerState.COMBAT]: '战斗中...'
  } as Record<string, string>;
  return stateMap[state] || '未知状态';
};

const formatPercent = (v: number) => `${Math.round((v || 0) * 100)}%`;
const formatFixed = (v: number | undefined | null, digits = 2) => {
  if (typeof v === 'number' && isFinite(v)) return v.toFixed(digits);
  return (0).toFixed(digits);
};
</script>

<style scoped>
.player-status { border: 1px solid #000; padding: var(--spacing-md); background: #fff; }
.header-line { display: flex; align-items: baseline; gap: var(--spacing-xs); margin-bottom: var(--spacing-sm); }
.name { font-weight: bold; color: #000; }
.title { color: #000; font-size: var(--font-size-sm); }
.grid { display: flex; flex-direction: column; gap: var(--spacing-xxs); }
.line { display: flex; align-items: baseline; gap: var(--spacing-xs); font-size: var(--font-size-sm); }
.label { color: #000; }
.value { color: #000; font-weight: bold; }
.muted { color: #000; opacity: 0.7; font-size: var(--font-size-xs); }
.effects { margin-top: var(--spacing-md); }
.effects-header { font-size: var(--font-size-sm); color: #000; border-bottom: 1px solid #000; margin-bottom: var(--spacing-xxs); }
.effects-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 2px; }
.effect-item { display: flex; align-items: center; gap: var(--spacing-xs); font-size: var(--font-size-sm); color: #000; }
.effect-name { font-weight: bold; }
.effect-time { opacity: 0.8; }
.player-state { margin-top: var(--spacing-sm); display: flex; align-items: center; gap: var(--spacing-xs); }
.state-dot { width: 6px; height: 6px; border-radius: 50%; background: #000; }
.state-text { color: #000; font-size: var(--font-size-sm); }
</style>
