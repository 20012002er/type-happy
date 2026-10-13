<template>
  <!-- 
    悬浮提示组件
    - 鼠标悬停在锚点元素上时，显示提示信息
    - 支持多种预设类型（装备、敌人、玩家、属性等）
    - 支持自定义描述和插槽内容
  -->
  <span 
    ref="anchorRef" 
    class="popover-anchor" 
    :class="{ 'no-underline': !showUnderline }"
    @mouseenter="onEnter" 
    @mouseleave="onLeave"
  >
    <!-- 锚点内容：触发提示的元素 -->
    <slot />
    
    <!-- 提示弹窗：使用 teleport 挂载到 body，避免层级问题 -->
    <teleport to="body">
      <div 
        v-show="visible"
        ref="popoverRef"
        class="popover"
        :style="fixedStyle"
        @mouseenter="onEnter" 
        @mouseleave="onLeave"
      >
        <!-- 标题 -->
        <div class="pop-title">{{ titleText }}</div>
        
        <!-- 内容主体 -->
        <div class="pop-body">
          
          <!-- 类型1: 装备信息 -->
          <template v-if="type === 'item' && item">
            <div class="row">
              <span>类型：</span>
              <span>装备·{{ item.slot || '其他' }}</span>
            </div>
            <div class="row" v-if="item.rarity">
              <span>稀有：</span>
              <span>{{ rarityText(item.rarity) }}</span>
            </div>
            <div class="row" v-if="item.enhanceLevel">
              <span>强化：</span>
              <span>+{{ item.enhanceLevel }}</span>
            </div>
            <div class="row" v-if="item.affixes && item.affixes.length">
              <span>词缀：</span>
              <span>《{{ item.affixes.join('》《') }}》</span>
            </div>
            <div class="row" v-if="item.bonuses">
              <span>加成：</span>
              <span>
                <template v-if="item.bonuses.attack">攻+{{ item.bonuses.attack }} </template>
                <template v-if="item.bonuses.defense">防+{{ item.bonuses.defense }} </template>
                <template v-if="item.bonuses.hp">命+{{ item.bonuses.hp }}</template>
              </span>
            </div>
            <div class="divider" />
            <div class="row gag" v-if="item.comment">
              <span>评价：</span>
              <span>{{ item.comment }}</span>
            </div>
          </template>
          
          <!-- 类型2: 敌人信息 -->
          <template v-else-if="type === 'enemy' && enemy">
            <div class="row"><span>身份：</span><span>江湖人士（可能不太友好）</span></div>
            <div class="row"><span>等级：</span><span>{{ enemy.stats.level }}</span></div>
            <div class="row"><span>生命：</span><span>{{ enemy.stats.hp }}/{{ enemy.stats.maxHp }}</span></div>
            <div class="row"><span>攻击：</span><span>{{ enemy.stats.attack }}</span></div>
            <div class="row"><span>防御：</span><span>{{ enemy.stats.defense }}</span></div>
            <div class="row" v-if="enemy.description"><span>传闻：</span><span>{{ enemy.description }}</span></div>
            <div class="portrait-wrap" v-if="enemy.image">
              <div class="portrait-skeleton" v-show="portraitLoading"></div>
              <img
                class="portrait-img"
                :class="{ loaded: !portraitLoading }"
                :src="enemy.image"
                alt="enemy-portrait"
                loading="lazy"
                @load="onPortraitLoad"
                @error="onPortraitError"
              />
            </div>
            <div class="divider" />
            <div class="row gag"><span>传说：</span><span>被你盯久了会害羞（然后暴击你）。</span></div>
          </template>
          
          <!-- 类型3: 玩家信息 -->
          <template v-else-if="type === 'player' && player">
            <div class="row"><span>等级：</span><span>{{ player.stats.level }}</span></div>
            <div class="row"><span>生命：</span><span>{{ player.stats.hp }}/{{ player.stats.maxHp }}</span></div>
            <div class="row"><span>攻击：</span><span>{{ player.stats.attack }}</span></div>
            <div class="row"><span>防御：</span><span>{{ player.stats.defense }}</span></div>
            <div class="divider" />
            <div class="row gag"><span>气质：</span><span>路过的大侠都点了个赞（看你不出手）。</span></div>
          </template>
          
          <!-- 类型4: 属性/材料信息 - 修复：移除 statKey 的必须条件 -->
          <template v-else-if="type === 'stat'">
            <div class="row" v-if="statTitle">
              <span>{{ statKey ? '属性：' : '名称：' }}</span>
              <span>{{ statTitle }}</span>
            </div>
            <div class="row" v-if="statValue !== undefined && statValue !== null">
              <span>{{ statKey ? '当前：' : '数量：' }}</span>
              <span>{{ statValue }}</span>
            </div>
            <div class="divider" v-if="formattedDescription" />
            <div class="description-text" v-if="formattedDescription">
              {{ formattedDescription }}
            </div>
          </template>
          
          <!-- 类型5: 自定义插槽内容 -->
          <template v-else-if="type === 'custom'">
            <slot name="popover-content">
              <div class="description-text" v-if="formattedDescription">
                {{ formattedDescription }}
              </div>
            </slot>
          </template>
          
          <!-- 类型6: 通用描述 - 只显示描述文本 -->
          <template v-else-if="formattedDescription">
            <div class="description-text">{{ formattedDescription }}</div>
          </template>
          
        </div>
      </div>
    </teleport>
  </span>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue';
import type { Item } from '@/types/equipment';
import type { Enemy } from '@/types/enemy';
import type { Player } from '@/types/player';

/**
 * InfoPopover 组件的属性定义
 */
interface Props {
  /**
   * 提示类型
   * - 'item': 装备信息，需要传入 item 对象
   * - 'enemy': 敌人信息，需要传入 enemy 对象
   * - 'player': 玩家信息，需要传入 player 对象
   * - 'stat': 属性/材料信息，可传入 statTitle、statValue、statDesc
   * - 'custom': 自定义内容，使用插槽 popover-content
   * - 'generic': 通用类型，仅显示 description
   */
  type?: 'item' | 'enemy' | 'player' | 'stat' | 'custom' | 'generic';
  
  /** 装备对象（type='item' 时使用） */
  item?: Item;
  
  /** 敌人对象（type='enemy' 时使用） */
  enemy?: Enemy;
  
  /** 玩家对象（type='player' 时使用） */
  player?: Player;
  
  /** 提示标题（优先级最高，会覆盖自动生成的标题） */
  title?: string;
  
  /** 
   * 弹窗位置
   * - 'auto': 自动选择最佳位置（默认）
   * - 'top': 锚点上方
   * - 'bottom': 锚点下方
   * - 'left': 锚点左侧
   * - 'right': 锚点右侧
   */
  placement?: 'top' | 'bottom' | 'left' | 'right' | 'auto';
  
  /** 弹窗与锚点的距离（像素），默认 8px */
  offset?: number;
  
  /** 是否显示下划线，默认 true */
  showUnderline?: boolean;
  
  /** 属性键名（type='stat' 时使用，用于区分是属性还是材料） */
  statKey?: string;
  
  /** 属性/材料名称（type='stat' 时使用） */
  statTitle?: string;
  
  /** 属性/材料当前值或数量（type='stat' 时使用） */
  statValue?: string | number;
  
  /** 属性/材料说明（type='stat' 时使用） */
  statDesc?: string;
  
  /** 
   * 通用描述文本（适用于所有类型）
   * - 在 type='stat' 时作为 statDesc 的后备
   * - 在 type='generic' 或 type='custom' 时直接显示
   * - 支持换行符 \n
   */
  description?: string;
}

const props = withDefaults(defineProps<Props>(), {
  type: 'generic',
  placement: 'auto',
  offset: 8,
  showUnderline: true
});

// ==================== 状态管理 ====================

/** 提示框是否可见 */
const visible = ref(false);

/** 锚点元素的引用 */
const anchorRef = ref<HTMLElement | null>(null);

/** 弹窗元素的引用 */
const popoverRef = ref<HTMLElement | null>(null);

/** 鼠标是否在弹窗内（用于防止鼠标移入弹窗时关闭） */
let lastInside = false;

// ==================== 交互处理 ====================

/**
 * 鼠标进入锚点或弹窗时的处理
 * 显示提示框并更新位置
 */
const onEnter = () => {
  visible.value = true;
  nextTick(updatePosition);
};

/**
 * 鼠标离开锚点或弹窗时的处理
 * 如果鼠标移入到弹窗内，保持显示；否则隐藏
 */
const onLeave = (e?: MouseEvent) => {
  const rel = e?.relatedTarget as Node | null;
  const pop = popoverRef.value;
  // 若从锚点移入到弹层，保持显示
  if (pop && rel && pop.contains(rel)) {
    lastInside = true;
    return;
  }
  lastInside = false;
  visible.value = false;
};

// ==================== 计算属性 ====================

/**
 * 提示框标题
 * 优先级：props.title > 根据类型自动生成
 */
const titleText = computed(() => {
  if (props.title) return props.title;
  if (props.type === 'item' && props.item) return props.item.name;
  if (props.type === 'enemy' && props.enemy) return props.enemy.name;
  if (props.type === 'player' && props.player) return '你·这位江湖人士';
  if (props.type === 'stat') return props.statTitle || '详情';
  return '信息';
});

/**
 * 处理描述文本中的换行符
 * 将字面量 \n 转换为实际的换行符
 */
const formattedDescription = computed(() => {
  const text = props.description || props.statDesc || '';
  // 将 \n 替换为实际的换行符
  return text.replace(/\\n/g, '\n');
});

// ==================== 立绘加载状态 ====================
const portraitLoading = ref(false);

watch(
  () => props.enemy?.image,
  (img) => {
    // 有图片地址时，进入加载中；否则保持不显示
    portraitLoading.value = Boolean(img);
  },
  { immediate: true }
);

function onPortraitLoad() {
  portraitLoading.value = false;
}

function onPortraitError() {
  portraitLoading.value = false;
}

// ==================== 辅助方法 ====================

/**
 * 将装备稀有度转换为中文文本
 */
const rarityText = (r: NonNullable<Item['rarity']>) => {
  switch (r) {
    case 'common': return '普通';
    case 'uncommon': return '罕见';
    case 'rare': return '稀有';
    case 'epic': return '史诗';
  }
};

// ==================== 位置计算 ====================

/** 弹窗的样式对象（position: fixed 的定位） */
const fixedStyle = ref<Record<string, string>>({});

/**
 * 选择最佳弹窗位置
 * @param rect 锚点元素的位置信息
 * @returns 最佳位置方向
 * 
 * 逻辑：
 * 1. 如果指定了 placement，直接返回
 * 2. 计算四个方向的可用空间
 * 3. 优先选择能完整显示弹窗的方向
 * 4. 如果都不能完整显示，选择空间最大的方向
 */
const choosePlacement = (rect: DOMRect): 'top' | 'bottom' | 'left' | 'right' => {
  if (props.placement && props.placement !== 'auto') return props.placement;
  
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const topSpace = rect.top;
  const bottomSpace = vh - rect.bottom;
  const leftSpace = rect.left;
  const rightSpace = vw - rect.right;
  
  // 估算弹窗尺寸
  const estW = 260;
  const estH = 160;
  
  const candidates: Array<{p: 'top'|'bottom'|'left'|'right', score: number, fits: boolean}> = [
    { p: 'top', score: topSpace, fits: topSpace >= estH },
    { p: 'bottom', score: bottomSpace, fits: bottomSpace >= estH },
    { p: 'right', score: rightSpace, fits: rightSpace >= estW },
    { p: 'left', score: leftSpace, fits: leftSpace >= estW }
  ];
  
  // 优先选择能完整显示的方向
  const fit = candidates.filter(c => c.fits).sort((a,b) => b.score - a.score);
  if (fit.length) return fit[0].p;
  
  // 否则选择空间最大的方向
  return candidates.sort((a,b) => b.score - a.score)[0].p;
};

/**
 * 更新弹窗位置
 * 根据锚点位置和选定的 placement，计算弹窗的 fixed 定位坐标
 */
const updatePosition = () => {
  const anchor = anchorRef.value;
  const popover = popoverRef.value;
  if (!anchor || !popover) return;

  const rect = anchor.getBoundingClientRect();
  const placement = choosePlacement(rect);
  const offset = props.offset;
  const margin = 8;
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  const width = popover.offsetWidth || 240;
  const height = popover.offsetHeight || 160;

  let top = rect.top;
  let left = rect.left;

  switch (placement) {
    case 'top':
      top = rect.top - offset - height;
      left = rect.left + rect.width / 2 - width / 2;
      break;
    case 'bottom':
      top = rect.bottom + offset;
      left = rect.left + rect.width / 2 - width / 2;
      break;
    case 'left':
      top = rect.top + rect.height / 2 - height / 2;
      left = rect.left - offset - width;
      break;
    case 'right':
    default:
      top = rect.top + rect.height / 2 - height / 2;
      left = rect.right + offset;
      break;
  }

  top = Math.min(Math.max(top, margin), vh - height - margin);
  left = Math.min(Math.max(left, margin), vw - width - margin);

  fixedStyle.value = {
    position: 'fixed',
    top: `${top}px`,
    left: `${left}px`
  };
};

// ==================== 生命周期与监听 ====================

/** 窗口滚动或缩放时更新位置 */
const onWindow = () => { 
  if (visible.value) updatePosition(); 
};

onMounted(() => {
  window.addEventListener('scroll', onWindow, true);
  window.addEventListener('resize', onWindow, true);
});

onBeforeUnmount(() => {
  window.removeEventListener('scroll', onWindow, true);
  window.removeEventListener('resize', onWindow, true);
});

/** 当可见性变化时，更新位置 */
watch(visible, (v) => {
  if (v) nextTick(updatePosition);
});
</script>

<style scoped>
/* ==================== 锚点样式 ==================== */
.popover-anchor {
  position: relative;
  text-decoration: underline;
  text-underline-offset: 2px;
  cursor: help;
  color: rgba(17, 17, 17, 0.85);
}

.popover-anchor.no-underline {
  text-decoration: none;
}

.popover {
  position: fixed;
  z-index: 1000;
  min-width: 200px;
  max-width: 280px;
  background: #fff;
  border: 1px solid rgba(17, 17, 17, 0.16);
  border-radius: 12px;
  padding: 10px 12px;
  box-shadow: 0 18px 32px rgba(0, 0, 0, 0.08);
}

.pop-title {
  font-weight: 600;
  font-size: 12.5px;
  margin-bottom: 6px;
  color: rgba(17, 17, 17, 0.9);
}

.pop-body {
  font-size: 11.5px;
  color: rgba(17, 17, 17, 0.85);
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.row {
  display: flex;
  gap: 6px;
  line-height: 1.35;
}

.row > span:first-child {
  min-width: 42px;
  color: rgba(17, 17, 17, 0.55);
}

.divider {
  border-top: 1px solid rgba(17, 17, 17, 0.1);
  margin: 6px 0;
}

.gag {
  font-style: italic;
  color: rgba(17, 17, 17, 0.6);
}

.description-text {
  white-space: pre-line;
  line-height: 1.45;
  color: rgba(17, 17, 17, 0.8);
}

/* ========== 敌人立绘 ========== */
.portrait-wrap {
  position: relative;
  margin-top: 6px;
  width: 100%;
  height: 140px;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid rgba(17, 17, 17, 0.08);
  background: rgba(17, 17, 17, 0.04);
}

.portrait-skeleton {
  position: absolute;
  inset: 0;
  background: linear-gradient(90deg, rgba(0,0,0,0.06) 25%, rgba(0,0,0,0.12) 37%, rgba(0,0,0,0.06) 63%);
  background-size: 400% 100%;
  animation: skeletonShimmer 1.2s ease-in-out infinite;
  pointer-events: none;
}

@keyframes skeletonShimmer {
  0% { background-position: 100% 0; }
  100% { background-position: 0 0; }
}

.portrait-img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: contain; /* 适配横/竖/方图，不裁剪，留信箱/边框 */
  object-position: center;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.portrait-img.loaded {
  opacity: 1;
}
</style>


