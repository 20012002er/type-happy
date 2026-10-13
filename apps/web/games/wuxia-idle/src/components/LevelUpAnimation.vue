<template>
  <Teleport to="body">
    <div 
      v-if="visible" 
      class="level-up-overlay"
      @click="closeAnimation"
    >
      <div class="level-up-container">
        <!-- 主要升级文字 -->
        <div class="level-up-text">
          <div class="level-up-title">LEVEL UP!</div>
          <div class="level-progression">
            Lv.{{ fromLevel }} → Lv.{{ toLevel }}
          </div>
        </div>
        
        <!-- 属性提升显示 -->
        <div v-if="gains" class="level-up-gains">
          <div v-if="gains.hpIncrease > 0" class="gain-item">
            生命值 +{{ gains.hpIncrease }}
          </div>
          <div v-if="gains.attackIncrease > 0" class="gain-item">
            攻击力 +{{ gains.attackIncrease }}
          </div>
          <div v-if="gains.defenseIncrease > 0" class="gain-item">
            防御力 +{{ gains.defenseIncrease }}
          </div>
        </div>
        
        <!-- 粒子效果容器 -->
        <div class="particles-container">
          <div 
            v-for="particle in particles" 
            :key="particle.id"
            class="particle"
            :style="{
              left: particle.x + 'px',
              top: particle.y + 'px',
              animationDelay: particle.delay + 's',
              animationDuration: particle.duration + 's'
            }"
          ></div>
        </div>
        
        <!-- 闪光效果 -->
        <div class="flash-effect"></div>
        
        <!-- 关闭提示 -->
        <div class="close-hint">点击任意处继续</div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, nextTick } from 'vue';

interface LevelUpGains {
  hpIncrease: number;
  attackIncrease: number;
  defenseIncrease: number;
}

interface Particle {
  id: number;
  x: number;
  y: number;
  delay: number;
  duration: number;
}

interface Props {
  visible: boolean;
  fromLevel: number;
  toLevel: number;
  gains?: LevelUpGains;
  autoClose?: boolean;
  autoCloseDelay?: number;
}

const props = withDefaults(defineProps<Props>(), {
  fromLevel: 1,
  toLevel: 2,
  autoClose: true,
  autoCloseDelay: 3000
});

interface Emits {
  (e: 'close'): void;
}

const emit = defineEmits<Emits>();

const particles = ref<Particle[]>([]);
let autoCloseTimer: ReturnType<typeof setTimeout> | null = null;

// 生成粒子效果
const generateParticles = () => {
  particles.value = [];
  const particleCount = 20;
  
  for (let i = 0; i < particleCount; i++) {
    particles.value.push({
      id: i,
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      delay: Math.random() * 0.5,
      duration: 1 + Math.random() * 2
    });
  }
};

// 播放音效 (简单的音频播放，可以替换为实际音频文件)
const playLevelUpSound = () => {
  try {
    // 创建简单的音效 - Web Audio API
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    // 创建一个简单的升级音效
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    // 设置音效参数
    oscillator.frequency.setValueAtTime(440, audioContext.currentTime); // A4
    oscillator.frequency.setValueAtTime(880, audioContext.currentTime + 0.1); // A5
    oscillator.frequency.setValueAtTime(1760, audioContext.currentTime + 0.2); // A6
    
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.5);
  } catch (error) {
    console.warn('无法播放升级音效:', error);
  }
};

// 关闭动画
const closeAnimation = () => {
  if (autoCloseTimer) {
    clearTimeout(autoCloseTimer);
    autoCloseTimer = null;
  }
  emit('close');
};

// 监听显示状态变化
watch(() => props.visible, (newVisible) => {
  if (newVisible) {
    nextTick(() => {
      generateParticles();

      // 自动关闭
      if (props.autoClose) {
        autoCloseTimer = setTimeout(() => {
          closeAnimation();
        }, props.autoCloseDelay);
      }
    });
  } else {
    particles.value = [];
    if (autoCloseTimer) {
      clearTimeout(autoCloseTimer);
      autoCloseTimer = null;
    }
  }
});

// 键盘事件处理
const handleKeydown = (event: KeyboardEvent) => {
  if (props.visible && (event.key === 'Escape' || event.key === 'Enter' || event.key === ' ')) {
    closeAnimation();
  }
};

onMounted(() => {
  document.addEventListener('keydown', handleKeydown);
});

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown);
  if (autoCloseTimer) {
    clearTimeout(autoCloseTimer);
  }
});
</script>

<style scoped>
.level-up-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  cursor: pointer;
  animation: fadeIn 0.3s ease-out;
}

.level-up-container {
  position: relative;
  text-align: center;
  pointer-events: none;
}

.level-up-text {
  margin-bottom: var(--spacing-lg);
}

.level-up-title {
  font-size: 4rem;
  font-weight: bold;
  color: var(--color-white);
  text-shadow: 
    0 0 10px rgba(255, 255, 255, 0.8),
    0 0 20px rgba(255, 255, 255, 0.6),
    0 0 30px rgba(255, 255, 255, 0.4);
  animation: levelUpPulse 2s ease-in-out infinite;
  margin-bottom: var(--spacing-md);
}

.level-progression {
  font-size: 2rem;
  color: var(--color-white);
  font-weight: bold;
  animation: slideInUp 0.5s ease-out 0.3s both;
}

.level-up-gains {
  margin-bottom: var(--spacing-lg);
  animation: slideInUp 0.5s ease-out 0.6s both;
}

.gain-item {
  font-size: 1.2rem;
  color: var(--color-white);
  margin-bottom: var(--spacing-xs);
  text-shadow: 0 0 5px rgba(255, 255, 255, 0.5);
}

.particles-container {
  position: absolute;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  pointer-events: none;
  overflow: hidden;
}

.particle {
  position: absolute;
  width: 6px;
  height: 6px;
  background: var(--color-white);
  border-radius: 50%;
  animation: particleFloat linear;
  box-shadow: 0 0 6px rgba(255, 255, 255, 0.8);
}

.flash-effect {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 200px;
  height: 200px;
  background: radial-gradient(circle, rgba(255, 255, 255, 0.3) 0%, transparent 70%);
  border-radius: 50%;
  animation: flashPulse 2s ease-in-out infinite;
}

.close-hint {
  color: rgba(255, 255, 255, 0.7);
  font-size: var(--font-size-sm);
  margin-top: var(--spacing-xl);
  animation: fadeInDelayed 1s ease-out 1.5s both;
}

/* 动画定义 */
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes levelUpPulse {
  0%, 100% { 
    transform: scale(1);
    text-shadow: 
      0 0 10px rgba(255, 255, 255, 0.8),
      0 0 20px rgba(255, 255, 255, 0.6),
      0 0 30px rgba(255, 255, 255, 0.4);
  }
  50% { 
    transform: scale(1.05);
    text-shadow: 
      0 0 15px rgba(255, 255, 255, 1),
      0 0 25px rgba(255, 255, 255, 0.8),
      0 0 35px rgba(255, 255, 255, 0.6);
  }
}

@keyframes slideInUp {
  from {
    opacity: 0;
    transform: translateY(30px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes particleFloat {
  0% {
    opacity: 0;
    transform: translateY(100vh) scale(0);
  }
  10% {
    opacity: 1;
    transform: translateY(90vh) scale(1);
  }
  90% {
    opacity: 1;
    transform: translateY(-10vh) scale(1);
  }
  100% {
    opacity: 0;
    transform: translateY(-20vh) scale(0);
  }
}

@keyframes flashPulse {
  0%, 100% { 
    opacity: 0.1;
    transform: translate(-50%, -50%) scale(0.8);
  }
  50% { 
    opacity: 0.3;
    transform: translate(-50%, -50%) scale(1.2);
  }
}

@keyframes fadeInDelayed {
  from { opacity: 0; }
  to { opacity: 0.7; }
}

/* 响应式适配 */
@media (max-width: 768px) {
  .level-up-title {
    font-size: 2.5rem;
  }
  
  .level-progression {
    font-size: 1.5rem;
  }
  
  .gain-item {
    font-size: 1rem;
  }
  
  .flash-effect {
    width: 150px;
    height: 150px;
  }
}
</style>
