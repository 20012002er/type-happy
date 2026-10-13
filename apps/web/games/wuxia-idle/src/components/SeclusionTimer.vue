<template>
  <div
    class="seclusion-timer"
    :class="{ 'is-fullscreen': isFullscreen }"
  >
    <!-- 全屏切换按钮 -->
    <button
      v-if="!isFullscreen && isActive"
      class="fullscreen-toggle"
      @click="toggleFullscreen"
      title="全屏专注"
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
      >
        <path
          d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m3 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"
        />
      </svg>
    </button>

    <!-- 退出全屏按钮 -->
    <button
      v-if="isFullscreen"
      class="exit-fullscreen"
      @click="toggleFullscreen"
      title="退出全屏"
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
      >
        <path
          d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"
        />
      </svg>
    </button>

    <!-- 闭关状态显示 -->
    <div
      v-if="isActive"
      class="timer-active"
    >
      <!-- 主计时区域 -->
      <div class="main-display">
        <!-- 火焰效果 -->
        <div class="fire-zone">
          <!-- 三炷香火焰布局 -->
          <div class="flame-row">
            <div class="flame-wrapper">
              <div class="flame flame-small">
                <div class="flame-core"></div>
              </div>
            </div>
            <div class="flame-wrapper flame-main-wrapper">
              <div class="flame flame-main">
                <div class="flame-core"></div>
                <div class="flame-glow"></div>
              </div>
            </div>
            <div class="flame-wrapper">
              <div class="flame flame-small">
                <div class="flame-core"></div>
              </div>
            </div>
          </div>

          <!-- 烟雾 -->
          <div class="smoke-zone">
            <div
              v-for="n in 8"
              :key="n"
              class="smoke-wisp"
              :style="getSmokeStyle(n)"
            ></div>
          </div>
        </div>

        <!-- 香 -->
        <div class="incense-zone">
          <div class="incense-rod">
            <div
              class="incense-remain"
              :style="{ height: `${(1 - progressPercent) * 100}%` }"
            >
              <div class="incense-texture"></div>
            </div>
            <div
              class="incense ember-zone"
              :style="{ height: `${progressPercent * 100}%` }"
            >
              <div class="ember-glow"></div>
            </div>
          </div>
        </div>

        <!-- 香炉 -->
        <div class="burner-zone">
          <div class="burner-body">
            <div class="burner-hole"></div>
          </div>
          <div class="burner-rim"></div>
        </div>

        <!-- 灰烬 -->
        <div
          class="ash-pile"
          :style="{ height: `${Math.min(progressPercent * 24, 14)}px` }"
        ></div>
      </div>

      <!-- 时间显示 -->
      <div class="time-display">
        <div class="time-main">{{ formattedRemainingTime }}</div>
        <div class="time-label">{{ currentTypeName }}</div>
      </div>

      <!-- 进度条 -->
      <div class="progress-bar-container">
        <div class="progress-bar">
          <div
            class="progress-fill"
            :style="{ width: `${progressPercent * 100}%` }"
          ></div>
        </div>
        <div class="progress-info">{{ Math.floor(progressPercent * 100) }}%</div>
      </div>

      <!-- 状态标签 -->
      <div class="status-badges">
        <span
          v-if="isPaused"
          class="badge paused"
          >已暂停</span
        >
        <span
          v-if="interruptCount > 0"
          class="badge interrupted"
        >
          心神散乱 {{ interruptCount }} 次
        </span>
      </div>

      <!-- 供奉之物 -->
      <div
        v-if="offeredResources.length > 0"
        class="offerings-display"
      >
        <div class="offerings-label">供奉之物</div>
        <div class="offerings-items">
          <span
            v-for="(item, index) in offeredResources"
            :key="index"
            class="offering-item"
          >
            <Package class="item-icon" /> {{ item.name }}×{{ item.quantity }}
          </span>
        </div>
      </div>
    </div>

    <!-- 未闭关状态 -->
    <div
      v-else
      class="timer-inactive"
    >
      <Sparkles class="inactive-icon" />
      <div class="inactive-text">点香入定</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { Package, Sparkles } from 'lucide-vue-next';
import { useSeclusionStore } from '@/stores/seclusionStore';
import { useMaterialsStore } from '@/stores/materialsStore';
import { SeclusionConfigService } from '@/services/config/SeclusionConfigService';
import type { SeclusionType } from '@/types/seclusion';

const seclusionStore = useSeclusionStore();
const materialsStore = useMaterialsStore();
const isFullscreen = ref(false);

const isActive = computed(() => seclusionStore.isActive);
const isPaused = computed(() => seclusionStore.isPaused);
const progressPercent = computed(() => seclusionStore.progressPercent);
const remainingMs = computed(() => seclusionStore.remainingMs);
const currentType = computed(() => seclusionStore.currentType);
const currentSession = computed(() => seclusionStore.currentSession);

const typeNameCache = ref<Record<SeclusionType, string>>({
  practice: '闭门练功',
  sparring: '对招演练',
  reading: '抄经读谱',
});

const currentTypeName = computed(() => {
  if (!currentType.value) return '闭关';
  return typeNameCache.value[currentType.value] || currentType.value;
});

const formattedRemainingTime = computed(() => {
  const totalSeconds = Math.floor(remainingMs.value / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
});

const interruptCount = computed(() => {
  return currentSession.value?.interruptCount || 0;
});

const offeredResources = computed(() => {
  const session = currentSession.value;
  if (!session || !session.consumedResources) return [];

  return session.consumedResources.map(r => {
    const material = materialsStore.getMaterial(r.itemId);
    return {
      itemId: r.itemId,
      name: material?.name || r.itemId,
      quantity: r.quantity,
    };
  });
});

const getSmokeStyle = (index: number) => ({
  animationDelay: `${index * 0.35}s`,
  animationDuration: `${2.5 + Math.random() * 0.5}s`,
});

const toggleFullscreen = () => {
  isFullscreen.value = !isFullscreen.value;
};

const handleKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Escape' && isFullscreen.value) {
    isFullscreen.value = false;
  }
};

onMounted(async () => {
  const types = await SeclusionConfigService.getSeclusionTypes();
  for (const type of types) {
    typeNameCache.value[type.id as SeclusionType] = type.name;
  }
  document.addEventListener('keydown', handleKeydown);
});

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown);
});
</script>

<style scoped>
.seclusion-timer {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  background: transparent;
  border-radius: 12px;
  min-height: 320px;
  transition: all 0.4s ease;
}

.seclusion-timer.is-fullscreen {
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: linear-gradient(180deg, #faf9f7 0%, #f0eeea 100%);
  border-radius: 0;
  padding: 2rem;
  min-height: 100vh;
}

/* 全屏切换按钮 */
.fullscreen-toggle {
  position: absolute;
  top: 1rem;
  right: 1rem;
  width: 40px;
  height: 40px;
  border: none;
  background: rgba(0, 0, 0, 0.05);
  border-radius: 8px;
  cursor: pointer;
  color: #888;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  z-index: 50;
}

.fullscreen-toggle:hover {
  background: rgba(0, 0, 0, 0.1);
  color: #333;
}

.exit-fullscreen {
  position: absolute;
  top: 1.5rem;
  right: 1.5rem;
  width: 48px;
  height: 48px;
  border: none;
  background: rgba(0, 0, 0, 0.06);
  border-radius: 10px;
  cursor: pointer;
  color: #666;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  z-index: 100;
}

.exit-fullscreen:hover {
  background: rgba(0, 0, 0, 0.12);
  color: #333;
}

/* 计时激活状态 */
.timer-active {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.5rem;
  width: 100%;
}

.is-fullscreen .timer-active {
  gap: 2.5rem;
}

/* 主显示区域 */
.main-display {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  max-width: 400px;
  height: 380px;
}

.is-fullscreen .main-display {
  height: 480px;
  max-width: 500px;
}

/* 火焰区域 */
.fire-zone {
  position: relative;
  width: 100%;
  height: 100px;
  display: flex;
  justify-content: center;
  align-items: flex-end;
}

.is-fullscreen .fire-zone {
  height: 140px;
}

/* 火焰行布局 */
.flame-row {
  display: flex;
  justify-content: center;
  align-items: flex-end;
  gap: 8px;
}

.is-fullscreen .flame-row {
  gap: 12px;
}

.flame-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
}

.flame-main-wrapper {
  transform: translateY(-4px);
}

.is-fullscreen .flame-main-wrapper {
  transform: translateY(-6px);
}

.flame {
  border-radius: 50% 50% 50% 50% / 55% 55% 45% 45%;
  animation: flame-breathe 0.3s ease-in-out infinite alternate;
}

.flame-main {
  width: 30px;
  height: 60px;
  background: linear-gradient(
    180deg,
    rgba(255, 255, 240, 0.95) 0%,
    rgba(255, 250, 200, 0.9) 15%,
    rgba(255, 220, 100, 0.8) 35%,
    rgba(255, 160, 60, 0.65) 60%,
    rgba(255, 100, 30, 0.5) 80%,
    rgba(200, 50, 10, 0.3) 100%
  );
  filter: blur(0.8px);
  box-shadow:
    0 0 15px rgba(255, 180, 80, 0.5),
    0 0 30px rgba(255, 120, 50, 0.3);
}

.is-fullscreen .flame-main {
  width: 42px;
  height: 85px;
}

.flame-small {
  width: 18px;
  height: 36px;
  background: linear-gradient(
    180deg,
    rgba(255, 240, 180, 0.85) 0%,
    rgba(255, 200, 100, 0.7) 40%,
    rgba(255, 150, 60, 0.5) 100%
  );
  box-shadow: 0 0 8px rgba(255, 180, 80, 0.3);
}

.is-fullscreen .flame-small {
  width: 24px;
  height: 50px;
}

.flame-small:nth-child(1) {
  animation-delay: 0.08s;
}

.flame-small:nth-child(3) {
  animation-delay: 0.12s;
}

.flame-core {
  width: 40%;
  height: 70%;
  background: rgba(255, 255, 255, 0.8);
  border-radius: 50% 50% 50% 50% / 60% 60% 40% 40%;
  position: absolute;
  bottom: 4px;
  left: 50%;
  transform: translateX(-50%);
}

.is-fullscreen .flame-core {
  bottom: 6px;
}

.flame-glow {
  position: absolute;
  bottom: -8px;
  left: 50%;
  transform: translateX(-50%);
  width: 50px;
  height: 25px;
  background: radial-gradient(
    ellipse at center bottom,
    rgba(255, 200, 100, 0.5) 0%,
    rgba(255, 160, 60, 0.3) 40%,
    rgba(255, 100, 30, 0.1) 70%,
    transparent 100%
  );
  filter: blur(3px);
}

.is-fullscreen .flame-glow {
  width: 60px;
  height: 30px;
}

@keyframes flame-breathe {
  0% {
    transform: scaleY(1) scaleX(1) rotate(-1deg);
    opacity: 0.92;
  }
  25% {
    transform: scaleY(1.04) scaleX(0.96) rotate(0.3deg);
    opacity: 0.98;
  }
  50% {
    transform: scaleY(0.98) scaleX(1.02) rotate(-0.3deg);
    opacity: 1;
  }
  75% {
    transform: scaleY(1.02) scaleX(0.98) rotate(0.1deg);
    opacity: 0.95;
  }
  100% {
    transform: scaleY(1) scaleX(1) rotate(-1deg);
    opacity: 0.92;
  }
}

/* 烟雾 */
.smoke-zone {
  position: absolute;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 60px;
  height: 60px;
}

.is-fullscreen .smoke-zone {
  width: 80px;
  height: 80px;
}

.smoke-wisp {
  position: absolute;
  bottom: 0;
  left: 50%;
  width: 10px;
  height: 10px;
  background: radial-gradient(
    circle,
    rgba(200, 190, 180, 0.4) 0%,
    rgba(180, 170, 160, 0.15) 50%,
    transparent 100%
  );
  border-radius: 50%;
  animation: smoke-drift 2.5s ease-out infinite;
  opacity: 0;
}

.is-fullscreen .smoke-wisp {
  width: 14px;
  height: 14px;
}

.smoke-wisp:nth-child(1) {
  animation-delay: 0s;
}
.smoke-wisp:nth-child(2) {
  animation-delay: 0.3s;
}
.smoke-wisp:nth-child(3) {
  animation-delay: 0.6s;
}
.smoke-wisp:nth-child(4) {
  animation-delay: 0.9s;
}
.smoke-wisp:nth-child(5) {
  animation-delay: 1.2s;
}
.smoke-wisp:nth-child(6) {
  animation-delay: 1.5s;
}
.smoke-wisp:nth-child(7) {
  animation-delay: 1.8s;
}
.smoke-wisp:nth-child(8) {
  animation-delay: 2.1s;
}

@keyframes smoke-drift {
  0% {
    bottom: 0;
    transform: translateX(-50%) scale(0.8);
    opacity: 0;
  }
  10% {
    opacity: 0.4;
  }
  40% {
    transform: translateX(calc(-50% + var(--offset, 0px))) scale(1.8);
    opacity: 0.3;
  }
  70% {
    transform: translateX(calc(-50% + var(--offset, 0px))) scale(2.5);
    opacity: 0.15;
  }
  100% {
    bottom: 60px;
    transform: translateX(calc(-50% + var(--offset, 0px))) scale(3.2);
    opacity: 0;
  }
}

/* 香区域 */
.incense-zone {
  position: absolute;
  bottom: 80px;
  left: 50%;
  transform: translateX(-50%);
  width: 16px;
  height: 200px;
  display: flex;
  flex-direction: column-reverse;
}

.is-fullscreen .incense-zone {
  bottom: 110px;
  width: 22px;
  height: 260px;
}

.incense-rod {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column-reverse;
}

.incense-remain {
  background: linear-gradient(180deg, #c4a882 0%, #b09070 30%, #9a8070 60%, #8a7060 100%);
  border-radius: 3px 3px 0 0;
  position: relative;
  box-shadow: inset 0 0 8px rgba(0, 0, 0, 0.1);
}

.incense-texture {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: repeating-linear-gradient(
    180deg,
    transparent 0px,
    transparent 3px,
    rgba(0, 0, 0, 0.03) 3px,
    rgba(0, 0, 0, 0.03) 6px
  );
}

.incense.ember-zone {
  background: linear-gradient(180deg, #ff6b35 0%, #ff4500 30%, #cc3300 60%, #8b0000 100%);
  border-radius: 3px 3px 0 0;
  position: relative;
  box-shadow:
    0 0 20px rgba(255, 100, 0, 0.6),
    0 0 40px rgba(255, 50, 0, 0.35),
    inset 0 -5px 15px rgba(255, 150, 50, 0.3);
}

.ember-glow {
  position: absolute;
  top: -10px;
  left: 50%;
  transform: translateX(-50%);
  width: 24px;
  height: 18px;
  background: radial-gradient(
    ellipse at center,
    rgba(255, 255, 245, 0.95) 0%,
    rgba(255, 240, 180, 0.7) 30%,
    rgba(255, 180, 80, 0.4) 60%,
    transparent 85%
  );
  border-radius: 50%;
  filter: blur(2px);
  animation: ember-pulse 0.8s ease-in-out infinite alternate;
}

@keyframes ember-pulse {
  0% {
    opacity: 0.8;
    transform: translateX(-50%) scale(1);
  }
  100% {
    opacity: 1;
    transform: translateX(-50%) scale(1.1);
  }
}

.is-fullscreen .ember-glow {
  width: 28px;
  height: 22px;
}

/* 香炉 */
.burner-zone {
  position: absolute;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 10;
}

.burner-body {
  width: 100px;
  height: 55px;
  background: linear-gradient(180deg, #4a4a4a 0%, #2d2d2d 30%, #1a1a1a 100%);
  border-radius: 12px 12px 30px 30px;
  box-shadow:
    0 6px 20px rgba(0, 0, 0, 0.35),
    inset 0 3px 8px rgba(255, 255, 255, 0.08),
    inset 0 -5px 10px rgba(0, 0, 0, 0.3);
  position: relative;
  overflow: hidden;
}

.is-fullscreen .burner-body {
  width: 140px;
  height: 75px;
}

.burner-hole {
  position: absolute;
  bottom: 12px;
  left: 50%;
  transform: translateX(-50%);
  width: 36px;
  height: 24px;
  background: linear-gradient(180deg, #0a0a0a 0%, #000 100%);
  border-radius: 50% 50% 45% 45%;
}

.is-fullscreen .burner-hole {
  width: 50px;
  height: 32px;
  bottom: 16px;
}

.burner-rim {
  width: 108px;
  height: 12px;
  background: linear-gradient(180deg, #5a5a5a 0%, #3a3a3a 100%);
  border-radius: 6px;
  margin-left: -4px;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
}

.is-fullscreen .burner-rim {
  width: 152px;
  height: 16px;
  margin-left: -6px;
}

/* 灰烬 */
.ash-pile {
  position: absolute;
  bottom: 72px;
  left: 50%;
  transform: translateX(-50%);
  width: 60px;
  background: linear-gradient(180deg, #888 0%, #666 50%, #555 100%);
  border-radius: 50% 50% 40% 40%;
  transition: height 0.3s ease;
  box-shadow: 0 3px 6px rgba(0, 0, 0, 0.2);
}

.is-fullscreen .ash-pile {
  width: 84px;
  bottom: 92px;
}

/* 时间显示 */
.time-display {
  text-align: center;
}

.time-main {
  font-size: 3.5rem;
  font-weight: 200;
  font-family: 'SF Mono', 'Courier New', monospace;
  color: #1a1a1a;
  letter-spacing: 0.08em;
  line-height: 1.1;
}

.is-fullscreen .time-main {
  font-size: 5rem;
}

.time-label {
  font-size: 1rem;
  color: #666;
  margin-top: 0.5rem;
  letter-spacing: 0.3em;
}

.is-fullscreen .time-label {
  font-size: 1.3rem;
  margin-top: 0.8rem;
}

/* 进度条 */
.progress-bar-container {
  display: flex;
  align-items: center;
  gap: 1rem;
  width: 100%;
  max-width: 300px;
}

.is-fullscreen .progress-bar-container {
  max-width: 400px;
  gap: 1.5rem;
}

.progress-bar {
  flex: 1;
  height: 4px;
  background: rgba(0, 0, 0, 0.08);
  border-radius: 2px;
  overflow: hidden;
}

.is-fullscreen .progress-bar {
  height: 6px;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #d4a574 0%, #c49060 50%, #8b6914 100%);
  border-radius: 2px;
  transition: width 0.3s ease;
}

.progress-info {
  font-size: 0.8rem;
  color: #888;
  min-width: 45px;
  text-align: right;
}

.is-fullscreen .progress-info {
  font-size: 1rem;
  min-width: 55px;
}

/* 状态标签 */
.status-badges {
  display: flex;
  gap: 0.75rem;
}

.badge {
  padding: 0.4rem 0.8rem;
  border-radius: 20px;
  font-size: 0.8rem;
}

.is-fullscreen .badge {
  padding: 0.5rem 1rem;
  font-size: 0.9rem;
}

.badge.paused {
  background: rgba(255, 193, 7, 0.15);
  border: 1px solid rgba(255, 193, 7, 0.4);
  color: #b8860b;
}

.badge.interrupted {
  background: rgba(211, 47, 47, 0.1);
  border: 1px solid rgba(211, 47, 47, 0.3);
  color: #c62828;
}

/* 供奉之物 */
.offerings-display {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  margin-top: 4px;
}

.offerings-label {
  font-size: 0.75rem;
  color: #888;
  letter-spacing: 0.1em;
}

.offerings-items {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  justify-content: center;
}

.offering-item {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  background: rgba(212, 165, 116, 0.15);
  border: 1px solid rgba(212, 165, 116, 0.3);
  border-radius: 16px;
  font-size: 0.8rem;
  color: #8b6914;
}

/* 未激活状态 */
.timer-inactive {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  padding: 2rem;
}

.inactive-icon {
  width: 4rem;
  height: 4rem;
  opacity: 0.5;
}

.item-icon {
  width: 14px;
  height: 14px;
  vertical-align: middle;
}

.inactive-text {
  font-size: 1.2rem;
  color: #888;
  letter-spacing: 0.3em;
}
</style>
