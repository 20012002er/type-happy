<template>
  <RouterView />
</template>

<script setup lang="ts">
  import { RouterView } from 'vue-router'
  import { onMounted } from 'vue'

  onMounted(() => {
    if (!import.meta.env.DEV) {
      document.body.classList.add('select-none')
    }
  })
</script>
