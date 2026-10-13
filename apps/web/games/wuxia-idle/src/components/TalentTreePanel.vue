<template>
  <div class="talent-tree-panel">
    <header class="tree-header">
      <div class="tree-header__info">
        <h1 class="tree-title">武学修炼 · 天赋树</h1>
        <p class="tree-subtitle">以悟性点点亮脉络，逐层悟得属性与招式</p>
      </div>
      <div class="tree-header__meta">
        <span class="meta-label">悟性点</span>
        <span class="meta-value">{{ availableInsight }}</span>
      </div>
    </header>

    <div class="tree-body">
      <section class="tree-canvas-wrapper">
        <div
          class="tree-canvas"
          ref="canvasRef"
          :style="{ width: canvasWidth + 'px', height: canvasHeight + 'px' }"
        >
          <svg
            class="tree-links"
            :width="canvasWidth"
            :height="canvasHeight"
          >
            <line
              v-for="edge in edges"
              :key="`${edge[0]}-${edge[1]}`"
              :x1="getNodeCenter(edge[0]).x"
              :y1="getNodeCenter(edge[0]).y"
              :x2="getNodeCenter(edge[1]).x"
              :y2="getNodeCenter(edge[1]).y"
            />
          </svg>

          <button
            v-for="node in positionedNodes"
            :key="node.id"
            class="talent-node"
            :class="{
              unlocked: isUnlocked(node.id),
              available: canUnlock(node.id) && !isUnlocked(node.id),
              locked: !canUnlock(node.id) && !isUnlocked(node.id)
            }"
            :style="getNodeStyle(node)"
            @mouseenter="onNodeEnter(node, $event)"
            @mouseleave="scheduleHideDetail"
            @click="handleNodeClick(node, $event)"
          >
            <span class="node-name">{{ node.name }}</span>
            <span class="node-type">{{ renderNodeType(node.type) }}</span>
            <span class="node-cost" v-if="formatCost(node)">{{ formatCost(node) }}</span>
          </button>

          <transition name="fade">
            <div
              v-if="hoveredNode"
              ref="detailContainerRef"
              class="node-detail-float"
              :style="detailStyle"
              @mouseenter="cancelHideDetail"
              @mouseleave="scheduleHideDetail"
            >
              <DetailCard
                :title="hoveredNode.name"
                :subtitle="renderNodeType(hoveredNode.type)"
                dense
              >
                <template #meta>
                  <span class="status-chip" :class="statusClass">{{ statusLabel }}</span>
                </template>

                <p class="detail-description">{{ hoveredNode.description }}</p>

                <div class="detail-section" v-if="statEntries.length">
                  <div class="section-title">属性增益</div>
                  <ul class="detail-list">
                    <li v-for="stat in statEntries" :key="stat.key">
                      <span>{{ stat.label }}</span>
                      <span class="value">+{{ stat.value }}</span>
                    </li>
                  </ul>
                </div>

                <div class="detail-section" v-if="selectedMove">
                  <div class="section-title">悟得招式</div>
                  <div class="move-head">
                    <span class="move-name">{{ selectedMove.name }}</span>
                    <span class="move-emojis" v-if="selectedMove.emojis?.length">{{ selectedMove.emojis.join(' ') }}</span>
                  </div>
                  <div class="detail-list inline">
                    <span>{{ renderMoveCategory(selectedMove.category) }}</span>
                    <span>内力 {{ selectedMove.energyCost }}</span>
                    <span>倍率 {{ selectedMove.damageMultiplier }}x</span>
                    <span>附加 {{ selectedMove.damageFlat }}</span>
                    <span v-if="selectedMove.extraCritChance">暴击 +{{ (selectedMove.extraCritChance * 100).toFixed(0) }}%</span>
                  </div>
                  <p class="move-desc">{{ selectedMove.description }}</p>
                </div>

                <div class="detail-section" v-if="prerequisiteList.length">
                  <div class="section-title">前置节点</div>
                  <ul class="detail-list">
                    <li v-for="item in prerequisiteList" :key="item.id">
                      <span>{{ item.name }}</span>
                      <span class="value" :class="{ done: item.unlocked }">
                        {{ item.unlocked ? '已点亮' : '未点亮' }}
                      </span>
                    </li>
                  </ul>
                </div>

                <div class="detail-section" v-if="costLabel">
                  <div class="section-title">点亮消耗</div>
                  <span class="cost-label">{{ costLabel }}</span>
                </div>
              </DetailCard>
            </div>
          </transition>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import type { TalentNode, Move } from '@/types/martial';
import { useTalentTreeStore } from '@/stores/talentTreeStore';
import DetailCard from '@/components/common/DetailCard.vue';

const UNIT_X = 180;
const UNIT_Y = 160;
const PADDING = 80;

const store = useTalentTreeStore();
const nodes = computed(() => store.allNodes);
const canvasRef = ref<HTMLElement | null>(null);
const detailContainerRef = ref<HTMLElement | null>(null);
const detailPosition = ref({ x: 0, y: 0 });
const hoveredNodeId = ref<string | null>(null);
let currentAnchor: HTMLElement | null = null;
let hideTimer: number | null = null;

onMounted(async () => {
  await store.initialize();
});

const nodesById = computed<Record<string, TalentNode>>(() => {
  const map: Record<string, TalentNode> = {};
  nodes.value.forEach(node => {
    map[node.id] = node;
  });
  return map;
});

const moveById = computed<Record<string, Move>>(() => {
  const map: Record<string, Move> = {};
  nodes.value.forEach(node => {
    if (node.effect?.move) {
      map[node.effect.move.id] = node.effect.move;
    }
  });
  return map;
});

const bounds = computed(() => {
  if (nodes.value.length === 0) {
    return { minX: 0, maxX: 0, minY: 0, maxY: 0 };
  }
  const xs = nodes.value.map(node => node.position.x);
  const ys = nodes.value.map(node => node.position.y);
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys)
  };
});

const canvasWidth = computed(() => {
  const { minX, maxX } = bounds.value;
  return (maxX - minX + 1) * UNIT_X + PADDING * 2;
});

const canvasHeight = computed(() => {
  const { minY, maxY } = bounds.value;
  return (maxY - minY + 1) * UNIT_Y + PADDING * 2;
});

const positionedNodes = computed(() => nodes.value);
const edges = computed(() => store.connections);
const availableInsight = computed(() => store.availableInsight);

const hoveredNode = computed<TalentNode | null>(() => {
  const id = hoveredNodeId.value;
  return id ? nodesById.value[id] ?? null : null;
});

const statusLabel = computed(() => {
  if (!hoveredNode.value) return '';
  if (store.isUnlocked(hoveredNode.value.id)) return '已点亮';
  if (store.canUnlock(hoveredNode.value.id)) return '可点亮';
  return '未解锁';
});

const statusClass = computed(() => {
  if (!hoveredNode.value) return 'status--locked';
  if (store.isUnlocked(hoveredNode.value.id)) return 'status--unlocked';
  if (store.canUnlock(hoveredNode.value.id)) return 'status--available';
  return 'status--locked';
});

const selectedMove = computed<Move | null>(() => {
  const node = hoveredNode.value;
  if (!node?.effect) return null;
  if (node.effect.move) return node.effect.move;
  if (node.effect.moveId) {
    return moveById.value[node.effect.moveId] ?? null;
  }
  return null;
});

const statEntries = computed(() => {
  if (!hoveredNode.value?.effect?.stats) return [];
  return Object.entries(hoveredNode.value.effect.stats).map(([key, value]) => ({
    key,
    label: renderStatName(key),
    value
  }));
});

const prerequisiteList = computed(() => {
  if (!hoveredNode.value?.prerequisites?.length) return [];
  return hoveredNode.value.prerequisites.map(id => ({
    id,
    name: nodesById.value[id]?.name ?? id,
    unlocked: store.isUnlocked(id)
  }));
});

const costLabel = computed(() => {
  if (!hoveredNode.value) return '';
  return formatCost(hoveredNode.value);
});

function translatePosition(position: { x: number; y: number }) {
  const { minX, minY } = bounds.value;
  const x = (position.x - minX) * UNIT_X + PADDING;
  const y = (position.y - minY) * UNIT_Y + PADDING;
  return { x, y };
}

function getNodeStyle(node: TalentNode) {
  const pos = translatePosition(node.position);
  return {
    left: `${pos.x - 70}px`,
    top: `${pos.y - 44}px`
  };
}

function getNodeCenter(nodeId: string) {
  const node = nodesById.value[nodeId];
  if (!node) {
    return { x: 0, y: 0 };
  }
  const pos = translatePosition(node.position);
  return {
    x: pos.x,
    y: pos.y
  };
}

function isUnlocked(nodeId: string): boolean {
  return store.isUnlocked(nodeId);
}

function canUnlock(nodeId: string): boolean {
  return store.canUnlock(nodeId);
}

function onNodeEnter(node: TalentNode, event: MouseEvent) {
  cancelHideDetail();
  hoveredNodeId.value = node.id;
  currentAnchor = event.currentTarget as HTMLElement;
  nextTick(() => updateDetailPosition());
}

async function handleNodeClick(node: TalentNode, event: MouseEvent) {
  cancelHideDetail();
  hoveredNodeId.value = node.id;
  currentAnchor = event.currentTarget as HTMLElement;
  await nextTick();
  updateDetailPosition();
  if (store.isUnlocked(node.id)) return;
  if (!store.canUnlock(node.id)) return;
  const unlocked = await store.unlockNode(node.id);
  if (unlocked) {
    hoveredNodeId.value = store.getNode(node.id)?.id ?? node.id;
    await nextTick();
    updateDetailPosition();
  }
}

function scheduleHideDetail() {
  if (hideTimer) window.clearTimeout(hideTimer);
  hideTimer = window.setTimeout(() => {
    hoveredNodeId.value = null;
    currentAnchor = null;
  }, 120);
}

function cancelHideDetail() {
  if (hideTimer) {
    window.clearTimeout(hideTimer);
    hideTimer = null;
  }
}

function updateDetailPosition() {
  const canvasEl = canvasRef.value;
  const detailEl = detailContainerRef.value;
  if (!canvasEl || !detailEl || !currentAnchor) return;

  const canvasRect = canvasEl.getBoundingClientRect();
  const anchorRect = currentAnchor.getBoundingClientRect();
  const detailRect = detailEl.getBoundingClientRect();

  let left = anchorRect.right - canvasRect.left + 16;
  let top = anchorRect.top - canvasRect.top + anchorRect.height / 2 - detailRect.height / 2;

  if (left + detailRect.width > canvasRect.width - 8) {
    left = anchorRect.left - canvasRect.left - detailRect.width - 16;
  }
  left = Math.max(8, Math.min(left, canvasRect.width - detailRect.width - 8));

  if (top < 8) top = 8;
  if (top + detailRect.height > canvasRect.height - 8) {
    top = canvasRect.height - detailRect.height - 8;
  }

  detailPosition.value = { x: left, y: top };
}

function handleCanvasScroll() {
  if (!hoveredNode.value) return;
  updateDetailPosition();
}

watch(
  () => hoveredNodeId.value,
  id => {
    if (id) {
      nextTick(() => updateDetailPosition());
    }
  }
);

watch(
  () => nodes.value,
  () => {
    if (hoveredNodeId.value) {
      nextTick(() => updateDetailPosition());
    }
  }
);

onMounted(() => {
  const canvasEl = canvasRef.value;
  if (canvasEl) {
    canvasEl.addEventListener('scroll', handleCanvasScroll, { passive: true });
  }
  window.addEventListener('resize', updateDetailPosition);
});

onUnmounted(() => {
  const canvasEl = canvasRef.value;
  if (canvasEl) {
    canvasEl.removeEventListener('scroll', handleCanvasScroll);
  }
  window.removeEventListener('resize', updateDetailPosition);
  cancelHideDetail();
});

function formatCost(node: TalentNode): string | null {
  const insightCost = node.cost?.insight ?? (node.type === 'root' ? 0 : 1);
  const materials = node.cost?.materials;
  const fragments: string[] = [];
  if (insightCost > 0) fragments.push(`悟性 ${insightCost}`);
  if (materials?.length) {
    materials.forEach(m => fragments.push(`${m.id} x${m.quantity}`));
  }
  return fragments.length > 0 ? fragments.join(' / ') : null;
}

function renderNodeType(type: string): string {
  switch (type) {
    case 'root':
      return '根基';
    case 'stat':
      return '属性';
    case 'skill':
      return '招式';
    case 'utility':
      return '辅助';
    default:
      return type;
  }
}

function renderStatName(key: string): string {
  const map: Record<string, string> = {
    attack: '攻击',
    defense: '防御',
    maxHp: '最大生命',
    maxEnergy: '最大内力',
    critChance: '暴击率',
    critMultiplier: '暴击倍率'
  };
  return map[key] || key;
}

function renderMoveCategory(category: Move['category']): string {
  const map: Record<string, string> = {
    outer: '外功',
    inner: '内功',
    universal: '通用'
  };
  return map[category] || category;
}

const detailStyle = computed(() => ({
  left: `${detailPosition.value.x}px`,
  top: `${detailPosition.value.y}px`
}));
</script>

<style scoped>
.talent-tree-panel {
  display: flex;
  flex-direction: column;
  gap: 28px;
  padding: 32px;
  background: #fdfdfc;
  color: #1a1a1a;
  min-height: 100%;
}

.tree-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  border-bottom: 1px solid rgba(17, 17, 17, 0.08);
  padding-bottom: 12px;
}

.tree-header__info {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.tree-title {
  font-size: 20px;
  font-weight: 600;
  letter-spacing: 1px;
}

.tree-subtitle {
  font-size: 13px;
  color: rgba(26, 26, 26, 0.55);
}

.tree-header__meta {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 14px;
}

.meta-label {
  letter-spacing: 4px;
  text-transform: uppercase;
  color: rgba(17, 17, 17, 0.4);
}

.meta-value {
  font-size: 22px;
  font-weight: 600;
  color: #101010;
}

.tree-body {
  display: flex;
  gap: 28px;
  align-items: flex-start;
}

.tree-canvas-wrapper {
  flex: 1;
  overflow: auto;
  background: linear-gradient(135deg, rgba(17, 17, 17, 0.03), rgba(17, 17, 17, 0.01));
  border: 1px solid rgba(17, 17, 17, 0.08);
  border-radius: 18px;
  min-height: 520px;
}

.tree-canvas {
  position: relative;
  background: radial-gradient(circle at top, rgba(17, 17, 17, 0.05), rgba(255, 255, 255, 0));
  border-radius: 16px;
}

.tree-links {
  position: absolute;
  left: 0;
  top: 0;
  pointer-events: none;
}

.tree-links line {
  stroke: rgba(26, 26, 26, 0.18);
  stroke-width: 2;
  stroke-dasharray: 6;
}

.talent-node {
  position: absolute;
  width: 140px;
  min-height: 88px;
  padding: 14px;
  background: #ffffff;
  border: 1px solid rgba(26, 26, 26, 0.15);
  border-radius: 14px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  align-items: flex-start;
  justify-content: flex-start;
  cursor: pointer;
  transition: transform 0.15s ease, border-color 0.15s ease, background 0.15s ease, box-shadow 0.15s ease;
  box-shadow: 0 10px 18px rgba(0, 0, 0, 0.08);
  text-align: left;
  color: #1a1a1a;
}

.talent-node:hover {
  transform: translateY(-6px);
  border-color: rgba(17, 17, 17, 0.32);
  box-shadow: 0 16px 26px rgba(0, 0, 0, 0.12);
}

.talent-node.unlocked {
  background: #101010;
  color: #f5f5f5;
  border-color: rgba(0, 0, 0, 0.7);
  box-shadow: 0 18px 28px rgba(0, 0, 0, 0.22);
}

.talent-node.available {
  border-color: rgba(26, 26, 26, 0.32);
}

.talent-node.locked {
  color: rgba(17, 17, 17, 0.45);
  border-color: rgba(17, 17, 17, 0.08);
}

.node-name {
  font-weight: 600;
  font-size: 14px;
  letter-spacing: 0.3px;
}

.node-type {
  font-size: 12px;
  color: rgba(26, 26, 26, 0.45);
}

.talent-node.unlocked .node-type {
  color: rgba(255, 255, 255, 0.6);
}

.node-cost {
  font-size: 12px;
  color: rgba(26, 26, 26, 0.4);
}

.talent-node.unlocked .node-cost {
  color: rgba(255, 255, 255, 0.55);
}

.node-detail-float {
  position: absolute;
  width: 320px;
  pointer-events: auto;
  z-index: 10;
}

.node-detail-float :deep(.detail-card) {
  background: #ffffff;
  color: #1a1a1a;
  border: 1px solid rgba(17, 17, 17, 0.1);
  box-shadow: 0 18px 32px rgba(0, 0, 0, 0.12);
}

.status-chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 11px;
  letter-spacing: 2px;
  text-transform: uppercase;
}

.status--unlocked {
  background: rgba(16, 16, 16, 0.92);
  color: #ffffff;
}

.status--available {
  background: rgba(16, 16, 16, 0.08);
  color: #111;
}

.status--locked {
  background: rgba(16, 16, 16, 0.04);
  color: rgba(17, 17, 17, 0.45);
}

.detail-description {
  font-size: 13px;
  color: rgba(26, 26, 26, 0.7);
  line-height: 1.6;
}

.detail-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 12px;
}

.section-title {
  font-size: 12px;
  letter-spacing: 3px;
  text-transform: uppercase;
  color: rgba(17, 17, 17, 0.45);
}

.detail-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 13px;
  color: rgba(26, 26, 26, 0.82);
}

.detail-list.inline {
  flex-direction: row;
  flex-wrap: wrap;
  gap: 6px 16px;
  font-size: 12px;
  color: rgba(26, 26, 26, 0.55);
}

.detail-list li {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.detail-list .value {
  color: rgba(26, 26, 26, 0.8);
}

.detail-list .value.done {
  color: rgba(55, 180, 98, 0.9);
}

.move-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

.move-name {
  font-weight: 600;
  letter-spacing: 0.6px;
}

.move-emojis {
  font-size: 16px;
  opacity: 0.85;
}

.move-desc {
  font-size: 13px;
  color: rgba(26, 26, 26, 0.6);
  line-height: 1.6;
}

.cost-label {
  font-size: 13px;
  color: rgba(26, 26, 26, 0.7);
}

@media (max-width: 1280px) {
  .tree-body {
    flex-direction: column;
  }

  .node-detail-float {
    width: 280px;
  }
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>

