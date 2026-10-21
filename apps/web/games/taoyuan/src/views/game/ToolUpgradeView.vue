<template>
  <div>
    <VillagerPresence spot="upgrade" />
    <!-- 页签 -->
    <div class="flex space-x-1.5 mb-3">
      <Button class="flex-1 justify-center" :class="{ '!bg-accent !text-bg': activeTab === 'tool' }" :icon="Wrench" @click="activeTab = 'tool'">
        工具
      </Button>
      <Button
        class="flex-1 justify-center"
        :class="{ '!bg-accent !text-bg': activeTab === 'enhance' }"
        :icon="Sparkles"
        @click="activeTab = 'enhance'"
      >
        强化
      </Button>
    </div>

    <!-- 装备强化 -->
    <div v-if="activeTab === 'enhance'">
      <div class="flex items-center justify-between mb-2">
        <div class="flex items-center space-x-1.5 text-sm text-accent">
          <Sparkles :size="14" />
          <span>装备强化</span>
        </div>
        <span class="text-xs text-muted">铁匠·{{ smithName }}</span>
      </div>
      <div v-for="group in enhanceGroups" :key="group.kind" class="mb-3">
        <p class="text-xs text-muted mb-1">{{ group.label }}</p>
        <div class="flex flex-col space-y-1.5">
          <div
            v-for="entry in group.entries"
            :key="entry.index"
            class="flex items-center justify-between border rounded-xs px-3 py-1.5 cursor-pointer hover:bg-accent/5"
            :class="entry.equipped ? 'border-accent/30' : 'border-accent/20'"
            @click="enhanceTarget = { kind: group.kind, index: entry.index }"
          >
            <div class="flex items-center min-w-0">
              <span class="text-sm truncate" :class="entry.equipped ? 'text-accent' : ''">{{ entry.name }}</span>
              <span v-if="entry.equipped" class="text-[10px] text-accent border border-accent/30 rounded-xs px-1 ml-1 shrink-0">装备中</span>
            </div>
            <span v-if="entry.level < MAX_ENHANCE_LEVEL" class="text-xs text-muted whitespace-nowrap ml-2">
              +{{ entry.level }} → +{{ entry.level + 1 }}
            </span>
            <CircleCheck v-else :size="14" class="text-success shrink-0 ml-2" />
          </div>
        </div>
      </div>
    </div>

    <template v-else>
    <!-- 标题 -->
    <div class="flex items-center justify-between mb-1">
      <div class="flex items-center space-x-1.5 text-sm text-accent">
        <Wrench :size="14" />
        <span>工具升级</span>
      </div>
      <span class="text-xs text-muted">铁匠·{{ smithName }}</span>
    </div>
    <p class="text-xs text-muted mb-3">消耗金属锭和铜钱升级工具，需等待2天。</p>

    <!-- 正在升级提示 -->
    <div v-if="inventoryStore.pendingUpgrade" class="border border-accent/30 rounded-xs px-3 py-2 mb-3 flex items-center justify-between">
      <div class="flex items-center space-x-1.5">
        <Clock :size="12" class="text-accent shrink-0" />
        <span class="text-xs text-accent">
          锻造中「{{ TOOL_NAMES[inventoryStore.pendingUpgrade.toolType] }}」→
          {{ TIER_NAMES[inventoryStore.pendingUpgrade.targetTier] }}
        </span>
      </div>
      <span class="text-xs text-muted whitespace-nowrap ml-2">剩{{ inventoryStore.pendingUpgrade.daysRemaining }}天</span>
    </div>

    <div class="flex flex-col space-y-1.5">
      <div
        v-for="tool in inventoryStore.tools"
        :key="tool.type"
        class="flex items-center justify-between border rounded-xs px-3 py-1.5 cursor-pointer hover:bg-accent/5"
        :class="isUpgrading(tool.type) ? 'border-accent/30' : 'border-accent/20'"
        @click="selectedTool = tool.type"
      >
        <div class="min-w-0">
          <span class="text-sm" :class="isUpgrading(tool.type) ? 'text-accent' : ''">{{ TOOL_NAMES[tool.type] }}</span>
          <p class="text-xs text-muted">{{ TIER_NAMES[tool.tier] }}</p>
        </div>
        <span v-if="isUpgrading(tool.type)" class="text-xs text-accent whitespace-nowrap ml-2">锻造中</span>
        <span v-else-if="getUpgradeCost(tool.type, tool.tier)" class="text-xs text-muted whitespace-nowrap ml-2">
          → {{ TIER_NAMES[getUpgradeCost(tool.type, tool.tier)!.toTier] }}
        </span>
        <CircleCheck v-else :size="14" class="text-success shrink-0 ml-2" />
      </div>
    </div>
    </template>

    <!-- 装备强化弹窗 -->
    <Transition name="panel-fade">
      <div
        v-if="enhanceTarget && enhanceInfo"
        class="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
        @click.self="enhanceTarget = null"
      >
        <div class="game-panel max-w-xs w-full relative">
          <button class="absolute top-2 right-2 text-muted hover:text-text" @click="enhanceTarget = null">
            <X :size="14" />
          </button>

          <p class="text-sm text-accent mb-2 pr-5">{{ enhanceInfo.name }}</p>

          <!-- 效果对比 -->
          <div class="border border-accent/10 rounded-xs p-2 mb-2">
            <div class="flex items-center justify-between">
              <span class="text-xs text-muted">等级</span>
              <span class="text-xs">
                +{{ enhanceInfo.level }}
                <template v-if="enhanceCost">
                  →
                  <span class="text-success">+{{ enhanceCost.level }}</span>
                </template>
              </span>
            </div>
            <div v-for="row in enhanceInfo.rows" :key="row.label" class="flex items-center justify-between mt-0.5">
              <span class="text-xs text-muted">{{ row.label }}</span>
              <span class="text-xs">
                {{ row.current }}
                <template v-if="enhanceCost">
                  →
                  <span class="text-success">{{ row.next }}</span>
                </template>
              </span>
            </div>
          </div>

          <!-- 费用 -->
          <template v-if="enhanceCost">
            <div class="border border-accent/10 rounded-xs p-2 mb-2">
              <div class="flex items-center justify-between">
                <span class="text-xs text-muted">铜钱</span>
                <span class="text-xs" :class="playerStore.money >= enhanceCost.money ? '' : 'text-danger'">{{ enhanceCost.money }}文</span>
              </div>
              <div v-for="mat in enhanceCost.materials" :key="mat.itemId" class="flex items-center justify-between mt-0.5">
                <span class="text-xs text-muted">{{ getItemById(mat.itemId)?.name ?? mat.itemId }}</span>
                <span class="text-xs" :class="getCombinedItemCount(mat.itemId) >= mat.quantity ? '' : 'text-danger'">
                  {{ getCombinedItemCount(mat.itemId) }}/{{ mat.quantity }}
                </span>
              </div>
            </div>
            <button
              class="btn text-xs w-full justify-center"
              :class="{ '!bg-accent !text-bg': canEnhanceTarget }"
              :disabled="!canEnhanceTarget"
              @click="handleEnhance"
            >
              <Sparkles :size="12" />
              强化
            </button>
          </template>

          <!-- 满级 -->
          <div v-else class="border border-success/30 rounded-xs p-2">
            <div class="flex items-center justify-center space-x-1">
              <CircleCheck :size="12" class="text-success" />
              <span class="text-xs text-success">已满级</span>
            </div>
          </div>
        </div>
      </div>
    </Transition>

    <!-- 工具详情弹窗 -->
    <Transition name="panel-fade">
      <div
        v-if="selectedTool"
        class="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
        @click.self="selectedTool = null"
      >
        <div class="game-panel max-w-xs w-full relative">
          <button class="absolute top-2 right-2 text-muted hover:text-text" @click="selectedTool = null">
            <X :size="14" />
          </button>

          <p class="text-sm mb-2" :class="isUpgrading(selectedTool) ? 'text-accent' : 'text-text'">
            {{ TOOL_NAMES[selectedTool] }}
          </p>

          <!-- 当前状态 -->
          <div class="border border-accent/10 rounded-xs p-2 mb-2">
            <div class="flex items-center justify-between">
              <span class="text-xs text-muted">当前等级</span>
              <span class="text-xs">{{ TIER_NAMES[selectedToolObj!.tier] }}</span>
            </div>
            <div class="flex items-center justify-between mt-0.5">
              <span class="text-xs text-muted">体力减免</span>
              <span class="text-xs">{{ staminaText(selectedToolObj!.tier) }}</span>
            </div>
            <template v-if="selectedTool === 'fishingRod'">
              <div class="flex items-center justify-between mt-0.5">
                <span class="text-xs text-muted">钩子范围</span>
                <span class="text-xs">{{ ROD_HOOK[selectedToolObj!.tier] }}</span>
              </div>
              <div class="flex items-center justify-between mt-0.5">
                <span class="text-xs text-muted">钓鱼时限</span>
                <span class="text-xs">{{ ROD_TIME[selectedToolObj!.tier] }}秒</span>
              </div>
            </template>
            <div v-if="isUpgrading(selectedTool)" class="flex items-center justify-between mt-1">
              <span class="text-xs text-muted">锻造目标</span>
              <span class="text-xs text-accent">{{ TIER_NAMES[inventoryStore.pendingUpgrade!.targetTier] }}</span>
            </div>
            <div v-if="isUpgrading(selectedTool)" class="flex items-center space-x-2 mt-1.5">
              <span class="text-xs text-muted shrink-0">进度</span>
              <div class="flex-1 h-1 bg-bg rounded-xs border border-accent/10">
                <div
                  class="h-full rounded-xs bg-accent transition-all"
                  :style="{
                    width: ((2 - inventoryStore.pendingUpgrade!.daysRemaining) / 2) * 100 + '%'
                  }"
                />
              </div>
              <span class="text-xs text-muted whitespace-nowrap">{{ 2 - inventoryStore.pendingUpgrade!.daysRemaining }}/2天</span>
            </div>
          </div>

          <!-- 升级信息 -->
          <template v-if="!isUpgrading(selectedTool) && selectedUpgradeCost">
            <div class="border border-accent/10 rounded-xs p-2 mb-2">
              <p class="text-xs text-muted mb-1">升级至 {{ TIER_NAMES[selectedUpgradeCost.toTier] }}</p>
              <div class="flex items-center justify-between">
                <span class="text-xs text-muted">铜钱</span>
                <span class="text-xs" :class="playerStore.money >= selectedUpgradeCost.money ? '' : 'text-danger'">
                  {{ selectedUpgradeCost.money }}文
                </span>
              </div>
              <div v-for="mat in selectedUpgradeCost.materials" :key="mat.itemId" class="flex items-center justify-between mt-0.5">
                <span class="text-xs text-muted">{{ getItemById(mat.itemId)?.name ?? mat.itemId }}</span>
                <span class="text-xs" :class="getCombinedItemCount(mat.itemId) >= mat.quantity ? '' : 'text-danger'">
                  {{ getCombinedItemCount(mat.itemId) }}/{{ mat.quantity }}
                </span>
              </div>
              <template v-if="selectedFriendshipReq">
                <div class="flex items-center justify-between mt-0.5">
                  <span class="text-xs text-muted">{{ smithName }}好感</span>
                  <span
                    class="text-xs"
                    :class="meetsLevel(npcStore.getFriendshipLevel('xiao_man'), selectedFriendshipReq) ? '' : 'text-danger'"
                  >
                    {{ LEVEL_NAMES[npcStore.getFriendshipLevel('xiao_man')] }} /
                    {{ LEVEL_NAMES[selectedFriendshipReq] }}
                  </span>
                </div>
              </template>
            </div>

            <!-- 升级效果预览 -->
            <div class="border border-success/20 rounded-xs p-2 mb-2">
              <p class="text-xs text-muted mb-1">升级效果</p>
              <div class="flex items-center justify-between">
                <span class="text-xs text-muted">体力减免</span>
                <span class="text-xs">
                  {{ staminaText(selectedToolObj!.tier) }} →
                  <span class="text-success">{{ staminaText(selectedUpgradeCost.toTier) }}</span>
                </span>
              </div>
              <template v-if="selectedTool === 'fishingRod'">
                <div class="flex items-center justify-between mt-0.5">
                  <span class="text-xs text-muted">钩子范围</span>
                  <span class="text-xs">
                    {{ ROD_HOOK[selectedToolObj!.tier] }} →
                    <span class="text-success">{{ ROD_HOOK[selectedUpgradeCost.toTier] }}</span>
                  </span>
                </div>
                <div class="flex items-center justify-between mt-0.5">
                  <span class="text-xs text-muted">钓鱼时限</span>
                  <span class="text-xs">
                    {{ ROD_TIME[selectedToolObj!.tier] }}秒 →
                    <span class="text-success">{{ ROD_TIME[selectedUpgradeCost.toTier] }}秒</span>
                  </span>
                </div>
              </template>
            </div>

            <p v-if="getUpgradeBlockReason(selectedTool)" class="text-xs text-danger mb-2">
              {{ getUpgradeBlockReason(selectedTool) }}
            </p>

            <button
              class="btn text-xs w-full justify-center"
              :class="{ '!bg-accent !text-bg': canUpgrade(selectedTool) }"
              :disabled="!canUpgrade(selectedTool)"
              @click="handleUpgradeAndClose(selectedTool)"
            >
              <ArrowUp :size="12" />
              升级 {{ selectedUpgradeCost.money }}文
            </button>
          </template>

          <!-- 满级 -->
          <div v-else-if="!isUpgrading(selectedTool)" class="border border-success/30 rounded-xs p-2">
            <div class="flex items-center justify-center space-x-1">
              <CircleCheck :size="12" class="text-success" />
              <span class="text-xs text-success">已达到最高等级</span>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
  import VillagerPresence from '@/components/game/VillagerPresence.vue'
  import Button from '@/components/game/Button.vue'
  import { ref, computed } from 'vue'
  import { ArrowUp, Wrench, Clock, CircleCheck, X, Sparkles } from 'lucide-vue-next'
  import { useGameStore } from '@/stores/useGameStore'
  import { useInventoryStore } from '@/stores/useInventoryStore'
  import { useNpcStore } from '@/stores/useNpcStore'
  import { usePlayerStore } from '@/stores/usePlayerStore'
  import { getCombinedItemCount, removeCombinedItem } from '@/composables/useCombinedInventory'
  import { getUpgradeCost, TOOL_NAMES, TIER_NAMES, getItemById } from '@/data'
  import { getWeaponById, getEnchantmentById } from '@/data/weapons'
  import { getRingById } from '@/data/rings'
  import { getHatById } from '@/data/hats'
  import { getShoeById } from '@/data/shoes'
  import {
    MAX_ENHANCE_LEVEL,
    EQUIPMENT_EFFECT_NAMES,
    getEnhanceCost,
    getEnhancedAttack,
    scaleEffectValue,
    formatEquipmentEffectValue
  } from '@/data/enhance'
  import { ACTION_TIME_COSTS } from '@/data/timeConstants'
  import { addLog } from '@/composables/useGameLog'
  import { handleEndDay } from '@/composables/useEndDay'
  import { sfxBuy } from '@/composables/useAudio'
  import type { ToolType, ToolTier, FriendshipLevel, EquipmentKind, EquipmentEffect } from '@/types'

  /** 升级目标等级 → 所需小满好感 */
  const TIER_FRIENDSHIP_REQ: Partial<Record<ToolTier, FriendshipLevel>> = {
    iron: 'acquaintance',
    steel: 'friendly',
    iridium: 'bestFriend'
  }

  /** 各等级体力消耗倍率（与 useInventoryStore 一致） */
  const STAMINA_MULTIPLIERS: Record<ToolTier, number> = {
    basic: 1.0,
    iron: 0.8,
    steel: 0.6,
    iridium: 0.4
  }
  const ROD_HOOK: Record<ToolTier, number> = {
    basic: 40,
    iron: 45,
    steel: 50,
    iridium: 60
  }
  const ROD_TIME: Record<ToolTier, number> = {
    basic: 30,
    iron: 33,
    steel: 36,
    iridium: 40
  }

  const staminaText = (tier: ToolTier): string => {
    const r = Math.round((1 - STAMINA_MULTIPLIERS[tier]) * 100)
    return r > 0 ? `-${r}%` : '无加成'
  }
  const LEVEL_ORDER: FriendshipLevel[] = ['stranger', 'acquaintance', 'friendly', 'bestFriend']
  const LEVEL_NAMES: Record<FriendshipLevel, string> = {
    stranger: '陌生',
    acquaintance: '相识',
    friendly: '熟识',
    bestFriend: '挚友'
  }
  const meetsLevel = (current: FriendshipLevel, required: FriendshipLevel): boolean =>
    LEVEL_ORDER.indexOf(current) >= LEVEL_ORDER.indexOf(required)

  const inventoryStore = useInventoryStore()
  const playerStore = usePlayerStore()
  const npcStore = useNpcStore()
  const gameStore = useGameStore()

  /** 铁匠显示名（含玩家备注） */
  const smithName = computed(() => npcStore.getNpcDisplayName('xiao_man'))

  const activeTab = ref<'tool' | 'enhance'>('tool')

  // === 装备强化 ===

  interface EnhanceEntry {
    index: number
    name: string
    level: number
    equipped: boolean
  }

  interface EnhanceRow {
    label: string
    current: string
    next: string
  }

  const ENHANCE_GROUP_LABELS: Record<EquipmentKind, string> = {
    weapon: '武器',
    ring: '戒指',
    hat: '帽子',
    shoe: '鞋子'
  }

  /** 某件装备是否穿戴中 */
  const isEquipped = (kind: EquipmentKind, index: number): boolean => {
    if (kind === 'weapon') return inventoryStore.equippedWeaponIndex === index
    if (kind === 'ring') return inventoryStore.equippedRingSlot1 === index || inventoryStore.equippedRingSlot2 === index
    if (kind === 'hat') return inventoryStore.equippedHatIndex === index
    return inventoryStore.equippedShoeIndex === index
  }

  const getOwnedList = (kind: EquipmentKind): { defId: string }[] => {
    if (kind === 'weapon') return inventoryStore.ownedWeapons
    if (kind === 'ring') return inventoryStore.ownedRings
    if (kind === 'hat') return inventoryStore.ownedHats
    return inventoryStore.ownedShoes
  }

  /** 按种类分组的已拥有装备，穿戴中的排前面 */
  const enhanceGroups = computed(() =>
    (['weapon', 'ring', 'hat', 'shoe'] as EquipmentKind[])
      .map(kind => {
        const entries: EnhanceEntry[] = getOwnedList(kind).map((_, index) => ({
          index,
          name: inventoryStore.getEquipDisplayName(kind, index),
          level: inventoryStore.getEnhanceLevel(kind, index),
          equipped: isEquipped(kind, index)
        }))
        entries.sort((a, b) => Number(b.equipped) - Number(a.equipped))
        return { kind, label: ENHANCE_GROUP_LABELS[kind], entries }
      })
      .filter(group => group.entries.length > 0)
  )

  /** 正在查看的强化目标 */
  const enhanceTarget = ref<{ kind: EquipmentKind; index: number } | null>(null)

  /** 装备效果列表（戒指 / 帽子 / 鞋子） */
  const getPieceEffects = (kind: EquipmentKind, defId: string): EquipmentEffect[] => {
    if (kind === 'ring') return getRingById(defId)?.effects ?? []
    if (kind === 'hat') return getHatById(defId)?.effects ?? []
    if (kind === 'shoe') return getShoeById(defId)?.effects ?? []
    return []
  }

  /** 强化前后的效果对比 */
  const buildEnhanceRows = (kind: EquipmentKind, index: number, level: number): EnhanceRow[] => {
    if (kind === 'weapon') {
      const weapon = inventoryStore.ownedWeapons[index]
      const def = weapon ? getWeaponById(weapon.defId) : undefined
      if (!weapon || !def) return []
      const enchant = weapon.enchantmentId ? getEnchantmentById(weapon.enchantmentId) : undefined
      const base = def.attack + (enchant?.attackBonus ?? 0)
      return [{ label: '攻击力', current: `${getEnhancedAttack(base, level)}`, next: `${getEnhancedAttack(base, level + 1)}` }]
    }
    const owned = getOwnedList(kind)[index]
    if (!owned) return []
    return getPieceEffects(kind, owned.defId).map(eff => ({
      label: EQUIPMENT_EFFECT_NAMES[eff.type] ?? eff.type,
      current: formatEquipmentEffectValue(eff.type, scaleEffectValue(eff.type, eff.value, level)),
      next: formatEquipmentEffectValue(eff.type, scaleEffectValue(eff.type, eff.value, level + 1))
    }))
  }

  const enhanceInfo = computed(() => {
    const target = enhanceTarget.value
    if (!target || !getOwnedList(target.kind)[target.index]) return null
    const level = inventoryStore.getEnhanceLevel(target.kind, target.index)
    return {
      name: inventoryStore.getEquipDisplayName(target.kind, target.index),
      level,
      rows: buildEnhanceRows(target.kind, target.index, level)
    }
  })

  const enhanceCost = computed(() => {
    if (!enhanceInfo.value || enhanceInfo.value.level >= MAX_ENHANCE_LEVEL) return null
    return getEnhanceCost(enhanceInfo.value.level + 1)
  })

  const canEnhanceTarget = computed(() => {
    const target = enhanceTarget.value
    return !!target && inventoryStore.canEnhanceEquipment(target.kind, target.index)
  })

  /** 强化：弹窗保持打开，可连续强化 */
  const handleEnhance = () => {
    const target = enhanceTarget.value
    if (!target) return
    const result = inventoryStore.enhanceEquipment(target.kind, target.index)
    addLog(result.message)
    if (!result.success) return
    sfxBuy()
    const tr = gameStore.advanceTime(ACTION_TIME_COSTS.craftMachine)
    if (tr.message) addLog(tr.message)
    if (tr.passedOut) {
      enhanceTarget.value = null
      handleEndDay()
    }
  }

  // === 弹窗状态 ===

  const selectedTool = ref<ToolType | null>(null)

  const selectedToolObj = computed(() => {
    if (!selectedTool.value) return null
    return inventoryStore.getTool(selectedTool.value) ?? null
  })

  const selectedUpgradeCost = computed(() => {
    if (!selectedToolObj.value) return null
    return getUpgradeCost(selectedToolObj.value.type, selectedToolObj.value.tier) ?? null
  })

  const selectedFriendshipReq = computed(() => {
    if (!selectedUpgradeCost.value) return null
    return TIER_FRIENDSHIP_REQ[selectedUpgradeCost.value.toTier] ?? null
  })

  /** 该工具是否正在升级中 */
  const isUpgrading = (type: ToolType): boolean => {
    return inventoryStore.pendingUpgrade?.toolType === type
  }

  const canUpgrade = (type: ToolType): boolean => {
    // 已有工具在升级中，不能再升级
    if (inventoryStore.pendingUpgrade) return false

    const tool = inventoryStore.getTool(type)
    if (!tool) return false
    const cost = getUpgradeCost(type, tool.tier)
    if (!cost) return false

    const requiredLevel = TIER_FRIENDSHIP_REQ[cost.toTier]
    if (requiredLevel && !meetsLevel(npcStore.getFriendshipLevel('xiao_man'), requiredLevel)) return false

    if (playerStore.money < cost.money) return false
    for (const mat of cost.materials) {
      if (getCombinedItemCount(mat.itemId) < mat.quantity) return false
    }
    return true
  }

  /** 返回升级被阻止的原因（用于 UI 提示），可升级时返回空字符串 */
  const getUpgradeBlockReason = (type: ToolType): string => {
    if (inventoryStore.pendingUpgrade) return `${smithName.value}正在锻造其他工具`

    const tool = inventoryStore.getTool(type)
    if (!tool) return ''
    const cost = getUpgradeCost(type, tool.tier)
    if (!cost) return ''

    const requiredLevel = TIER_FRIENDSHIP_REQ[cost.toTier]
    if (requiredLevel && !meetsLevel(npcStore.getFriendshipLevel('xiao_man'), requiredLevel)) {
      return `需要${smithName.value}好感达到「${LEVEL_NAMES[requiredLevel]}」`
    }

    if (playerStore.money < cost.money) return '铜钱不足'
    for (const mat of cost.materials) {
      if (getCombinedItemCount(mat.itemId) < mat.quantity) {
        const itemName = getItemById(mat.itemId)?.name ?? mat.itemId
        return `${itemName}不足（${getCombinedItemCount(mat.itemId)}/${mat.quantity}）`
      }
    }
    return ''
  }

  const handleUpgradeAndClose = (type: ToolType) => {
    const tool = inventoryStore.getTool(type)
    if (!tool) return
    const cost = getUpgradeCost(type, tool.tier)
    if (!cost) return
    if (!canUpgrade(type)) {
      addLog('条件不足，无法升级。')
      return
    }

    playerStore.spendMoney(cost.money)
    for (const mat of cost.materials) {
      removeCombinedItem(mat.itemId, mat.quantity)
    }
    inventoryStore.startUpgrade(type, cost.toTier)

    addLog(`你把${TOOL_NAMES[type]}和材料交给了小满，${cost.money}文。2天后可以取回升级后的工具。`)
    selectedTool.value = null
    const tr = gameStore.advanceTime(ACTION_TIME_COSTS.toolUpgrade)
    if (tr.message) addLog(tr.message)
    if (tr.passedOut) {
      handleEndDay()
      return
    }
  }
</script>
