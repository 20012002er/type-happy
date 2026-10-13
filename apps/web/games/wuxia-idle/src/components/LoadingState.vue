<template>
  <div class="loading-state">
    <div class="loading-title">江湖载入中</div>
    <div class="loading-bar">
      <div class="loading-fill" :style="{ width: progress + '%' }"></div>
    </div>
    <div class="loading-text">{{ message }}</div>
  </div>
</template>

<script setup lang="ts">
defineProps<{ progress: number; message: string }>();
</script>

<style scoped>
.loading-state {
  width: 100%;
  height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: #fff;
  color: #000;
}
.loading-title { font-size: 1.25rem; margin-bottom: 16px; }
.loading-bar { width: 60%; max-width: 520px; height: 8px; border: 1px solid #000; background: #fff; }
.loading-fill { height: 100%; background: #000; transition: width 0.2s ease; }
.loading-text { margin-top: 12px; font-size: 0.9rem; text-align: center; }
</style>


