<template>
  <Transition name="panel-fade">
    <div v-if="open" class="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" @click.self="emit('close')">
      <div class="game-panel max-w-sm w-full max-h-[80vh] flex flex-col relative">
        <button class="absolute top-2 right-2 text-muted hover:text-text" @click="emit('close')">
          <X :size="14" />
        </button>

        <div class="flex items-center justify-between mb-2 pr-6">
          <p class="text-sm text-accent">
            <ListChecks :size="14" class="inline" />
            今日待办
          </p>
          <span class="text-[10px] text-muted">
            <template v-if="urgentCount > 0">
              <span class="text-danger">{{ urgentCount }} 项要紧</span>
              ·
            </template>
            共 {{ todos.length }} 条
          </span>
        </div>

        <div class="flex-1 overflow-y-auto min-h-0">
          <div v-if="todos.length === 0" class="flex flex-col items-center justify-center py-10 text-muted">
            <ListChecks :size="32" class="mb-2 text-success/40" />
            <p class="text-xs">今天的事都办妥了</p>
            <p class="text-[10px] text-muted/50 mt-0.5">可以安心去睡了</p>
          </div>

          <div v-for="group in groupedTodos" :key="group.category" class="mb-2 last:mb-0">
            <Divider :label="group.name" />
            <div class="flex flex-col space-y-1">
              <button
                v-for="item in group.items"
                :key="item.id"
                class="flex items-center justify-between border rounded-xs px-2 py-1.5 text-left transition-colors mr-1"
                :class="urgencyClass(item.urgency)"
                @click="handleJump(item)"
              >
                <span class="flex items-center min-w-0 mr-2">
                  <CircleAlert v-if="item.urgency === 'urgent'" :size="10" class="text-danger flex-shrink-0 mr-1" />
                  <Circle v-else-if="item.urgency === 'normal'" :size="10" class="text-accent flex-shrink-0 mr-1" />
                  <Info v-else :size="10" class="text-muted/50 flex-shrink-0 mr-1" />
                  <span class="text-[10px] truncate">{{ item.text }}</span>
                </span>
                <span v-if="item.detail" class="text-[10px] text-muted flex-shrink-0">{{ item.detail }}</span>
              </button>
            </div>
          </div>
        </div>

        <p class="text-[10px] text-muted/40 mt-2">点任意一条可直接前往对应的地方。</p>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
  import { X, ListChecks, CircleAlert, Circle, Info } from 'lucide-vue-next'
  import Divider from '@/components/game/Divider.vue'
  import { useTodoList, type TodoItem, type TodoUrgency } from '@/composables/useTodoList'
  import { navigateToPanel } from '@/composables/useNavigation'

  defineProps<{ open: boolean }>()
  const emit = defineEmits<{ close: [] }>()

  const { todos, groupedTodos, urgentCount } = useTodoList()

  const urgencyClass = (urgency: TodoUrgency): string => {
    if (urgency === 'urgent') return 'border-danger/30 hover:bg-danger/5'
    if (urgency === 'normal') return 'border-accent/25 hover:bg-accent/5'
    return 'border-accent/10 text-muted hover:bg-accent/5'
  }

  const handleJump = (item: TodoItem) => {
    if (!item.panel) return
    emit('close')
    navigateToPanel(item.panel)
  }
</script>
