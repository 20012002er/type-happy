<script setup lang="ts">
import { ref } from 'vue'

const emit = defineEmits<{ change: [value: number] }>()
const count = ref(0)

function increment() {
  count.value += 1
  emit('change', count.value)
}
</script>

<template>
  <button type="button" @click="increment">已点击 {{ count }} 次</button>
</template>
