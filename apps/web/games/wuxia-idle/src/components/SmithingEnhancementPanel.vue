<template>
  <div class="smithing-enhancement">
    <div class="enhancement-item">
      <SynthesisPanel />
    </div>
    <div class="enhancement-item">
      <ReforgePanel />
    </div>
  </div>
</template>

<script setup lang="ts">
import SynthesisPanel from '@/components/SynthesisPanel.vue';
import ReforgePanel from '@/components/ReforgePanel.vue';
</script>

<style scoped>
.smithing-enhancement {
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
}

.enhancement-item {
  flex: 1 1 320px;
  display: flex;
}

.enhancement-item :deep(.synth-card),
.enhancement-item :deep(.reforge-card) {
  width: 100%;
}

@media (max-width: 960px) {
  .enhancement-item {
    flex: 1 1 100%;
  }
}
</style>
