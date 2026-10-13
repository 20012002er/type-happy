<template>
  <div class="achievement-notification-container">
    <transition-group name="achievement-fade">
      <div
        v-for="notification in notifications"
        :key="notification.id"
        class="achievement-banner"
      >
        <div class="banner-icon">
          <Medal class="medal-icon" />
        </div>
        <div class="banner-content">
          <div class="banner-title">{{ notification.title }}</div>
          <div class="banner-message">{{ notification.message }}</div>
        </div>
        <button class="banner-close" @click="remove(notification.id)">×</button>
      </div>
    </transition-group>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { Medal } from 'lucide-vue-next';

export interface AchievementToast {
  id: string;
  type: 'completed';
  title: string;
  message: string;
  duration?: number;
}

const notifications = ref<AchievementToast[]>([]);

function show(payload: Omit<AchievementToast, 'id'>) {
  const id = `${Date.now()}-${Math.random()}`;
  const duration = payload.duration ?? 3200;

  notifications.value.push({ ...payload, id });

  window.setTimeout(() => remove(id), duration);
}

function remove(id: string) {
  const index = notifications.value.findIndex(item => item.id === id);
  if (index >= 0) notifications.value.splice(index, 1);
}

defineExpose({
  show
});
</script>

<style scoped>
.achievement-notification-container {
  position: fixed;
  top: 88px;
  right: 28px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  z-index: 10000;
  pointer-events: none;
}

.achievement-banner {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px 20px;
  min-width: 280px;
  max-width: 360px;
  background: rgba(255, 255, 255, 0.92);
  border: 1px solid rgba(17, 17, 17, 0.12);
  border-radius: 16px;
  box-shadow: 0 18px 32px rgba(0, 0, 0, 0.12);
  pointer-events: auto;
}

.banner-icon {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  background: linear-gradient(135deg, #111, #333);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
}

.medal-icon {
  width: 22px;
  height: 22px;
  color: #fff;
}

.banner-content {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
}

.banner-title {
  font-size: 14px;
  font-weight: 600;
  color: #111;
}

.banner-message {
  font-size: 12px;
  color: rgba(17, 17, 17, 0.6);
}

.banner-close {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: none;
  background: rgba(17, 17, 17, 0.08);
  color: #111;
  cursor: pointer;
  font-size: 16px;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s ease;
}

.banner-close:hover {
  background: rgba(17, 17, 17, 0.18);
}

.achievement-fade-enter-active,
.achievement-fade-leave-active {
  transition: all 0.2s ease;
}

.achievement-fade-enter-from,
.achievement-fade-leave-to {
  transform: translateY(-12px);
  opacity: 0;
}

@media (max-width: 768px) {
  .achievement-notification-container {
    top: 70px;
    right: 16px;
    left: 16px;
  }

  .achievement-banner {
    min-width: auto;
    max-width: none;
  }
}
</style>

