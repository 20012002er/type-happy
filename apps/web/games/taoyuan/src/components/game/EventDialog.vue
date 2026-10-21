<template>
  <div class="fixed inset-0 bg-bg/90 flex items-center justify-center z-50 p-8">
    <div class="game-panel max-w-lg w-full max-h-[80vh] overflow-y-auto">
      <h2 class="text-accent text-sm mb-4">{{ event.name }}</h2>
      <div class="space-y-2 mb-4">
        <p
          v-for="(line, i) in displayedLines"
          :key="i"
          class="text-xs leading-relaxed"
          :class="{ 'text-muted': i < displayedLines.length - 1 }"
        >
          {{ line }}
        </p>
      </div>
      <div class="flex justify-center">
        <Button v-if="!allLinesShown" class="w-full" @click="showNextLine">继续</Button>
        <Button v-else class="w-full" @click="emit('close')">关闭</Button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { ref, computed } from 'vue'
  import type { SeasonEventDef } from '@/data/events'
  import { useGameStore } from '@/stores/useGameStore'
  import { useNpcStore } from '@/stores/useNpcStore'
  import { usePlayerStore } from '@/stores/usePlayerStore'
  import { getNpcById } from '@/data/npcs'
  import Button from '@/components/game/Button.vue'

  const props = defineProps<{
    event: SeasonEventDef
  }>()

  const emit = defineEmits<{
    close: []
  }>()

  const gameStore = useGameStore()
  const npcStore = useNpcStore()
  const playerStore = usePlayerStore()

  /** 配偶名（未婚则为空） */
  const spouseName = computed(() => {
    const spouse = npcStore.getSpouse()
    return spouse ? (getNpcById(spouse.npcId)?.name ?? '') : ''
  })

  /** 已婚且该节日提供了成家版本时，改用成家版文案 */
  const narrative = computed(() => {
    if (spouseName.value && props.event.narrativeMarried) return props.event.narrativeMarried
    return props.event.narrative
  })

  /** 替换文案占位符 */
  const fill = (line: string): string =>
    line
      .replace(/\{year\}/g, String(gameStore.year))
      .replace(/\{player\}/g, playerStore.playerName)
      .replace(/\{title\}/g, playerStore.honorific)
      .replace(/\{spouse\}/g, spouseName.value || '家里人')

  const lineIndex = ref(1)

  const displayedLines = computed(() => narrative.value.slice(0, lineIndex.value).map(fill))
  const allLinesShown = computed(() => lineIndex.value >= narrative.value.length)

  const showNextLine = () => {
    if (lineIndex.value < narrative.value.length) {
      lineIndex.value++
    }
  }
</script>
