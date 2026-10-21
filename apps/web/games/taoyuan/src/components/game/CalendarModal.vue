<template>
  <Transition name="panel-fade">
    <div v-if="open" class="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" @click.self="emit('close')">
      <div class="game-panel max-w-xs w-full relative">
        <button class="absolute top-2 right-2 text-muted hover:text-text" @click="emit('close')">
          <X :size="14" />
        </button>

        <p class="text-sm text-accent mb-2">
          <Calendar :size="14" class="inline" />
          时历
          <span class="text-[10px] text-muted ml-1">第{{ gameStore.year }}年</span>
        </p>

        <!-- 季节切换 -->
        <div class="grid grid-cols-4 gap-2 mb-2">
          <button
            v-for="s in SEASONS"
            :key="s"
            class="text-[10px] px-2 py-0.5 border rounded-xs transition-colors"
            :class="calendarSeason === s ? 'bg-accent/20 border-accent/40 text-accent' : 'border-accent/10 text-muted hover:text-text'"
            @click="handleSelectSeason(s)"
          >
            {{ SEASON_NAMES[s] }}
          </button>
        </div>

        <!-- 28天网格 -->
        <div class="grid grid-cols-7 gap-px">
          <div v-for="wd in WEEKDAYS" :key="wd" class="text-center py-0.5">
            <span class="text-[10px]" :class="wd === 'sat' || wd === 'sun' ? 'text-accent' : 'text-muted'">{{ WEEKDAY_NAMES[wd] }}</span>
          </div>
          <div
            v-for="entry in calendarDays"
            :key="entry.day"
            class="text-center py-1 border border-transparent transition-colors"
            :class="[
              entry.isToday ? 'bg-accent/20 border-accent/40' : '',
              entry.festivals.length > 0 || entry.birthdays.length > 0 ? 'cursor-pointer hover:bg-accent/10 rounded-sm' : '',
              selectedCalendarDay === entry.day ? 'border-accent/30' : ''
            ]"
            @click="handleSelectDay(entry)"
          >
            <span class="text-[10px]" :class="entry.isToday ? 'text-accent' : 'text-muted'">
              {{ entry.day }}
            </span>
            <div class="flex justify-center space-x-px mt-px min-h-1.5">
              <span v-if="entry.festivals.length > 0" class="w-1 h-1 rounded-full bg-danger inline-block" />
              <span v-if="entry.birthdays.length > 0" class="w-1 h-1 rounded-full bg-success inline-block" />
            </div>
          </div>
        </div>

        <!-- 图例 -->
        <div class="flex items-center space-x-3 mt-1.5">
          <span class="text-[10px] text-muted flex items-center space-x-0.5">
            <span class="w-1.5 h-1.5 rounded-full bg-danger inline-block" />
            <span>节日</span>
          </span>
          <span class="text-[10px] text-muted flex items-center space-x-0.5">
            <span class="w-1.5 h-1.5 rounded-full bg-success inline-block" />
            <span>生日</span>
          </span>
        </div>

        <!-- 选中日详情 -->
        <div
          v-if="selectedDayEntry && (selectedDayEntry.festivals.length > 0 || selectedDayEntry.birthdays.length > 0)"
          class="border border-accent/10 rounded-xs p-2 mt-2"
        >
          <p class="text-[10px] text-accent mb-1">
            {{ SEASON_NAMES[calendarSeason] }}{{ selectedCalendarDay }}日
            <span v-if="selectedDayEntry.isToday" class="text-danger ml-1">(今天)</span>
          </p>
          <div v-for="f in selectedDayEntry.festivals" :key="f.name" class="mb-0.5">
            <span class="text-[10px] text-danger">{{ f.name }}</span>
            <span class="text-[10px] text-muted ml-1">{{ f.description }}</span>
          </div>
          <div v-for="b in selectedDayEntry.birthdays" :key="b.npcId">
            <span class="text-[10px] text-success">{{ b.npcName }}的生日</span>
          </div>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
  import { ref, computed, watch } from 'vue'
  import { X, Calendar } from 'lucide-vue-next'
  import { useGameStore, SEASON_NAMES } from '@/stores/useGameStore'
  import { useNpcStore } from '@/stores/useNpcStore'
  import { SEASON_EVENTS } from '@/data/events'
  import { NPCS } from '@/data/npcs'
  import { WEEKDAYS, WEEKDAY_NAMES } from '@/data/timeConstants'
  import type { Season } from '@/types'

  const props = defineProps<{ open: boolean }>()
  const emit = defineEmits<{ close: [] }>()

  const gameStore = useGameStore()
  const npcStore = useNpcStore()

  const SEASONS: Season[] = ['spring', 'summer', 'autumn', 'winter']
  const calendarSeason = ref<Season>(gameStore.season)
  const selectedCalendarDay = ref<number | null>(null)

  // 每次打开都回到当前季节，免得上次翻到冬天下次还停在那儿
  watch(
    () => props.open,
    isOpen => {
      if (isOpen) {
        calendarSeason.value = gameStore.season
        selectedCalendarDay.value = null
      }
    }
  )

  const calendarDays = computed(() => {
    const s = calendarSeason.value
    const entries = []
    for (let d = 1; d <= 28; d++) {
      const festivals = SEASON_EVENTS.filter(e => e.season === s && e.day === d).map(e => ({ name: e.name, description: e.description }))
      const birthdays = NPCS.filter(npc => npc.birthday?.season === s && npc.birthday?.day === d).map(npc => ({
        npcId: npc.id,
        npcName: npcStore.getNpcDisplayName(npc.id)
      }))
      entries.push({
        day: d,
        festivals,
        birthdays,
        isToday: s === gameStore.season && d === gameStore.day
      })
    }
    return entries
  })

  const selectedDayEntry = computed(() => {
    if (selectedCalendarDay.value === null) return null
    return calendarDays.value[selectedCalendarDay.value - 1] ?? null
  })

  const handleSelectSeason = (s: Season) => {
    calendarSeason.value = s
    selectedCalendarDay.value = null
  }

  const handleSelectDay = (entry: { day: number; festivals: { name: string }[]; birthdays: { npcName: string }[] }) => {
    if (entry.festivals.length > 0 || entry.birthdays.length > 0) {
      selectedCalendarDay.value = selectedCalendarDay.value === entry.day ? null : entry.day
    }
  }
</script>
