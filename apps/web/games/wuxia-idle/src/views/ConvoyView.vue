<template>
  <div class="convoy-view">
    <!-- 顶部标题与状态 -->
    <div class="header">
      <span class="title"><Truck class="title-icon" /> 押镖</span>
      <div class="meta">
        <span v-if="isRunning">当前：{{ routeName }}（{{ phaseText }}）</span>
      </div>
    </div>

    <!-- 押镖状态舞台：类似战斗舞台 -->
    <div v-if="isRunning" class="convoy-stage">
      <!-- 起点区域 -->
      <div class="location-area start-area">
        <div class="location-text">
          {{ currentRoute ? locName(currentRoute.fromLocationId) : '起点' }}
        </div>
        <Building class="location-emoji" />
      </div>

      <!-- 中间状态区域 -->
      <div class="status-area">
        <div class="status-icon" :class="`phase-${phaseText}`">
          <component :is="getPhaseIcon()" class="phase-icon" />
        </div>
        <div class="status-text">{{ getPhaseText() }}</div>
        
        <!-- 进度信息 -->
        <div class="progress-info">
          <div class="segment-info">第 {{ segIndex + 1 }} / {{ segments }} 段</div>
          <div class="progress-bar-wrapper">
            <div class="progress-bar-fill" :style="{ width: progressPercentDisplay + '%' }"></div>
          </div>
          <div class="integrity-info" :class="{ 'low': integrity < 30 }">
            <Package class="info-icon" /> 货物: {{ integrity }}%
          </div>
        </div>
      </div>

      <!-- 终点区域 -->
      <div class="location-area end-area">
        <Castle class="location-emoji" />
        <div class="location-text">
          {{ currentRoute ? locName(currentRoute.toLocationId) : '终点' }}
        </div>
      </div>
    </div>

    <!-- 押镖控制按钮 -->
    <div v-if="isRunning" class="convoy-controls">
      <button class="control-btn stop-btn" @click="stopConvoy">
        停止押镖（按失败结算）
      </button>
    </div>

    <!-- 押镖行程日志（简易列表） -->
    <div v-if="isRunning" class="convoy-log-panel">
      <div class="log-title">行程日志</div>
      <ul class="log-list">
        <li v-for="log in recentConvoyLogs" :key="log.id" class="log-item" :class="'type-' + log.type">
          <span class="time">{{ gameLogStore.formatLogTime(log.timestamp) }}</span>
          <span class="msg">{{ log.message }}</span>
        </li>
        <li v-if="recentConvoyLogs.length === 0" class="log-item empty">暂无行程日志</li>
      </ul>
    </div>

    <!-- 未运行：路线列表（显示所有路线） -->
    <div v-else class="routes">
      <div class="section-title">所有押镖路线</div>
      <div class="route-grid">
        <div class="route-card" v-for="rt in availableRoutes" :key="rt.id">
          <div class="card-title">{{ rt.name }}</div>
          <div class="row"><span>起点：</span><span>{{ locName(rt.fromLocationId) }}</span></div>
          <div class="row"><span>终点：</span><span>{{ locName(rt.toLocationId) }}</span></div>
          <div class="row"><span>时长：</span><span>{{ Math.ceil(rt.durationSec/60) }} 分钟</span></div>
          <div class="row"><span>分段：</span><span>{{ rt.segments }} 段</span></div>
          <div class="row" v-if="rt.minLevel"><span>要求：</span><span>等级 ≥ {{ rt.minLevel }}</span></div>
          <div class="row"><span>费用：</span><span>佣金 {{ rt.costs.commission }} 金，押金 {{ rt.costs.deposit }} 金</span></div>
          <div class="row" v-if="rt.costs.materials && rt.costs.materials.length > 0">
            <span>材料：</span>
            <span>
              <span v-for="(mat, idx) in rt.costs.materials" :key="mat.itemId">
                <span :class="{ 'material-insufficient': !hasMaterial(mat.itemId, mat.qty) }">
                  {{ mat.name || mat.itemId }} ×{{ mat.qty }}
                </span>
                <span v-if="idx < rt.costs.materials.length - 1">、</span>
              </span>
            </span>
          </div>
          <div class="row" v-if="!isUnlocked(rt.id) && rt.unlock?.gold">
            <span>解锁：</span><span>{{ rt.unlock.gold }} 金（首次）</span>
          </div>
          <div class="row" v-if="rt.limits?.daily">
            <span>次数：</span><span>{{ getDaily(rt.id) }} / {{ rt.limits.daily }} / 天</span>
          </div>
          <div class="row" v-if="rt.limits?.cooldownSec">
            <span>冷却：</span><span>{{ getCooldown(rt.id, rt.limits.cooldownSec) }} 秒</span>
          </div>

          <div class="divider" />

          <label class="insure-row">
            <input type="checkbox" v-model="insuredMap[rt.id]" />
            <span>投保（失败提高补偿，费用为押金的 20%）</span>
          </label>

          <div class="actions">
            <button 
              class="btn start" 
              :class="{ 
                'btn-unlock': getStartButtonText(rt).startsWith('解锁'),
                'active': isRunning && routeId === rt.id
              }"
              @click="startConvoy(rt.id, !!insuredMap[rt.id])" 
              :disabled="!canClickButton(rt)"
            >
              <!-- 进度条（当该路线正在运行时） -->
              <div 
                v-if="isRunning && routeId === rt.id" 
                class="btn-progress-bar"
                :style="{ width: progressPercentDisplay + '%' }"
              ></div>
              <span class="btn-text">{{ getButtonText(rt) }}</span>
            </button>
          </div>
        </div>
      </div>
      <div class="empty" v-if="availableRoutes.length === 0">
        暂无押镖路线。
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue';
import { Truck, Building, Package, Castle, Target, CircleStop, Swords, HelpCircle, Check, X, PackageCheck } from 'lucide-vue-next';
import { useMapStore } from '@/stores/mapStore';
import { usePlayerStore } from '@/stores/playerStore';
import { useMaterialsStore } from '@/stores/materialsStore';
import { useGameLogStore } from '@/stores/gameLogStore';
import { convoyService } from '@/services/ConvoyService';
import { listConvoyRoutes, type ConvoyRouteConfig } from '@/services/config/ConvoyRoutesService';

const mapStore = useMapStore();
const playerStore = usePlayerStore();
const materialsStore = useMaterialsStore();
const gameLogStore = useGameLogStore();

const currentLocationName = computed(() => mapStore.currentLocation?.name || '未知');

const routeName = computed(() => convoyService.routeNameRef.value);
const routeId = computed(() => convoyService.routeIdRef.value);
const phaseText = computed(() => convoyService.phaseTextRef.value);
const isRunning = computed(() => convoyService.isRunningRef.value);
const integrity = computed(() => convoyService.integrityRef.value);
const progressPercentDisplay = computed(() => Math.max(0, Math.floor(convoyService.progressPercentRef.value as number)));
const segIndex = computed(() => convoyService.segmentIndexRef.value);
const segments = computed(() => convoyService.segmentsRef.value);

// 当前路线配置
const currentRoute = computed(() => {
  const id = routeId.value;
  if (!id) return null;
  return routes.value.find(r => r.id === id) || null;
});

const routes = ref<ConvoyRouteConfig[]>([]);
const insuredMap = reactive<Record<string, boolean>>({});

// 最近行程日志（取最新的8条全局日志，简单直观，不做虚拟列表）
const recentConvoyLogs = computed(() => {
  // 直接使用全局过滤后的日志，取前8条
  const list = gameLogStore.filteredLogs as any;
  try {
    // Pinia 会自动解包 computed，直接切片
    return (list || []).slice(0, 8);
  } catch {
    // 兜底：如果未解包，则按 .value 访问
    return (list?.value || []).slice(0, 8);
  }
});

onMounted(async () => {
  try {
    routes.value = await listConvoyRoutes();
  } catch (e) {
    console.warn('[ConvoyView] 加载路线失败', e);
    routes.value = [];
  }
});

// 显示所有路线，不再按当前位置过滤
const availableRoutes = computed(() => routes.value);

function locName(id: string): string {
  const world = mapStore.mapData;
  const loc = world?.locationsById?.[id];
  return loc?.name || id;
}

function getDaily(routeId: string): number {
  return convoyService.getDailyCountPublic(routeId);
}

// 冷却倒计时刷新（每秒触发一次重算）
const cdTick = ref(0);
let cdTimer: any = null;
onMounted(() => {
  cdTimer = setInterval(() => { cdTick.value++; }, 1000);
});
onUnmounted(() => {
  if (cdTimer) clearInterval(cdTimer);
});

function getCooldown(routeId: string, cdSec?: number): number {
  // 依赖 cdTick 以触发重新计算
  void cdTick.value;
  return convoyService.getCooldownRemainSeconds(routeId, cdSec);
}

function isUnlocked(routeId: string): boolean {
  return convoyService.isRouteUnlockedPublic(routeId);
}

// 检查材料是否足够
function hasMaterial(itemId: string, qty: number): boolean {
  const owned = materialsStore.stacks[itemId]?.qty || 0;
  return owned >= qty;
}

// 获取阶段图标
function getPhaseIcon() {
  const phase = phaseText.value;
  if (phase.includes('准备')) return Target;
  if (phase.includes('赶路') || phase.includes('行进')) return Target;
  if (phase.includes('战斗') || phase.includes('遇战')) return Swords;
  if (phase.includes('事件')) return HelpCircle;
  if (phase.includes('失败')) return X;
  if (phase.includes('成功')) return Check;
  return CircleStop;
}

// 获取阶段文本
function getPhaseText(): string {
  const phase = phaseText.value;
  if (phase.includes('准备')) return '整装待发';
  if (phase.includes('赶路') || phase.includes('行进')) return '押镖路上';
  if (phase.includes('战斗') || phase.includes('遇战')) return '遇到贼寇！';
  if (phase.includes('事件')) return '遭遇意外';
  if (phase.includes('失败')) return '押镖失败';
  if (phase.includes('成功')) return '押镖成功！';
  return phase || '路上';
}

// 获取按钮文本（区别于 getStartButtonText）
function getButtonText(rt: ConvoyRouteConfig): string {
  // 如果该路线正在运行，显示进行中
  if (isRunning.value && routeId.value === rt.id) {
    return '进行中...';
  }
  // 否则返回正常的按钮文本
  return getStartButtonText(rt);
}

// 检查是否可以出发（仅检查是否正在运行）
function canStart(rt: ConvoyRouteConfig): boolean {
  if (isRunning.value) return false;
  return true;
}

// 获取按钮显示文本和限制原因
function getStartButtonText(rt: ConvoyRouteConfig): string {
  if (isRunning.value) return '进行中...';
  
  // 检查等级
  if (rt.minLevel && playerStore.player.stats.level < rt.minLevel) {
    return `等级不足（需要${rt.minLevel}级）`;
  }
  
  // 检查每日次数
  if (rt.limits?.daily && getDaily(rt.id) >= rt.limits.daily) {
    return `次数已用尽（${getDaily(rt.id)}/${rt.limits.daily}）`;
  }
  
  // 检查冷却
  const cd = getCooldown(rt.id, rt.limits?.cooldownSec);
  if (cd > 0) {
    return `冷却中（${cd}秒）`;
  }
  
  // 【关键修复】检查是否已解锁 - 优先显示解锁按钮
  if (!isUnlocked(rt.id) && rt.unlock?.gold) {
    const owned = playerStore.player.resources.gold;
    const need = rt.unlock.gold;
    if (owned < need) {
      return `金币不足（需${need}金解锁）`;
    }
    // 金币足够，显示解锁按钮
    return `解锁（${need}金）`;
  }
  
  // 已解锁后，才检查材料和费用
  // 检查材料
  if (rt.costs.materials && rt.costs.materials.length > 0) {
    for (const mat of rt.costs.materials) {
      if (!hasMaterial(mat.itemId, mat.qty)) {
        return `材料不足（${mat.name || mat.itemId}）`;
      }
    }
  }
  
  // 检查费用金币
  const totalCost = rt.costs.commission + rt.costs.deposit + (insuredMap[rt.id] ? Math.floor(rt.costs.deposit * 0.2) : 0);
  const owned = playerStore.player.resources.gold;
  if (owned < totalCost) {
    return `金币不足（需${totalCost}金）`;
  }
  
  return '出发';
}

// 是否可以点击按钮
function canClickButton(rt: ConvoyRouteConfig): boolean {
  // 如果某个路线正在运行，则不能点击其他路线按钮
  if (isRunning.value) {
    return false;
  }
  const btnText = getStartButtonText(rt);
  // 可以点击的情况：出发、解锁（金币足够时）
  return btnText === '出发' || btnText.startsWith('解锁（');
}

function startConvoy(routeId: string, insured: boolean) {
  if (!isUnlocked(routeId)) {
    convoyService.unlockRoutePublic(routeId);
    return;
  }
  convoyService.start(routeId, { insured });
}

function stopConvoy() {
  convoyService.requestStop();
}
</script>

<style scoped>
/* 与 GatheringSkillLayout 保持一致的样式风格 */
.convoy-view {
  padding: 18px 20px;
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.header { 
  padding: 16px 18px;
  background: #fdfdfc;
  border: 1px solid rgba(17, 17, 17, 0.12);
  border-radius: 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.title { 
  margin: 0;
  font-size: 20px; 
  font-weight: 600;
  letter-spacing: 0.8px;
  color: #111;
}

.meta { 
  display: flex; 
  gap: 12px; 
  color: rgba(17,17,17,0.7); 
  font-size: 13px;
  align-items: center;
}

.running-panel { 
  display: flex; 
  flex-direction: column; 
  gap: 12px; 
  padding: 16px 18px; 
  border: 1px solid rgba(17,17,17,0.12); 
  border-radius: 14px; 
  background: #fdfdfc; 
}

.progress-row { 
  display: grid; 
  grid-template-columns: 80px 1fr 80px; 
  align-items: center; 
  gap: 10px; 
}

.label { 
  font-size: 12px; 
  color: rgba(17,17,17,0.7); 
  font-weight: 500;
}

.bar { 
  position: relative; 
  height: 12px; 
  background: rgba(17,17,17,0.08); 
  border-radius: 999px; 
  overflow: hidden; 
}

.bar .fill { 
  position: absolute; 
  left: 0; 
  top: 0; 
  bottom: 0; 
  background: linear-gradient(90deg, #111, #333);
  transition: width 0.3s ease;
}

.bar.integrity .fill { 
  background: linear-gradient(90deg, #39c24f, #2ecc71); 
}

.info { 
  font-size: 12px; 
  color: rgba(17,17,17,0.7); 
  text-align: right;
  font-weight: 600;
}

.actions { 
  display: flex; 
  gap: 10px; 
  margin-top: 4px;
}

.btn { 
  position: relative;
  border: 1px solid #111; 
  border-radius: 10px; 
  padding: 10px 14px; 
  background: #111; 
  color: #fff;
  cursor: pointer; 
  font-size: 13px;
  font-weight: 600;
  transition: all 0.15s ease;
  overflow: hidden;
}

.btn:hover:not(:disabled) {
  background: #fff;
  color: #111;
}

.btn.stop { 
  background: #fff; 
  color: #c0392b; 
  border-color: #c0392b; 
}

.btn.stop:hover {
  background: #fff5f5;
}

.btn.btn-unlock {
  background: #2ecc71;
  border-color: #2ecc71;
  color: #fff;
}

.btn.btn-unlock:hover:not(:disabled) {
  background: #27ae60;
  border-color: #27ae60;
  color: #fff;
}

/* 押镖状态舞台：参考战斗舞台设计 */
.convoy-stage {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 32px;
  padding: 28px 32px;
  border-radius: 18px;
  background: radial-gradient(circle at 30% 20%, rgba(255, 255, 255, 0.16), transparent 55%),
    radial-gradient(circle at 70% 80%, rgba(255, 255, 255, 0.1), transparent 60%),
    #141417;
  color: #fff;
  overflow: hidden;
  min-height: 200px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.04), 0 12px 30px rgba(20, 20, 23, 0.35);
}

.convoy-stage::before,
.convoy-stage::after {
  content: '';
  position: absolute;
  width: 45%;
  height: 220%;
  top: -60%;
  background: radial-gradient(circle, rgba(255, 255, 255, 0.25) 0%, rgba(255, 255, 255, 0) 65%);
  filter: blur(32px);
  opacity: 0.35;
  transform: rotate(18deg);
}

.convoy-stage::before {
  left: -5%;
}

.convoy-stage::after {
  right: -5%;
  transform: rotate(-18deg);
}

.location-area {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  gap: 12px;
  align-items: center;
  width: 22%;
}

.location-text {
  font-size: 16px;
  font-weight: 600;
  letter-spacing: 0.5px;
  text-align: center;
  color: rgba(255, 255, 255, 0.95);
  text-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.location-emoji {
  font-size: 48px;
  filter: drop-shadow(0 8px 16px rgba(0, 0, 0, 0.4));
}

.status-area {
  position: relative;
  z-index: 1;
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}

.status-icon {
  font-size: 64px;
  animation: statusPulse 1.6s ease-in-out infinite;
  filter: drop-shadow(0 12px 24px rgba(0, 0, 0, 0.5));
}

@keyframes statusPulse {
  0%, 100% {
    transform: scale(1);
    opacity: 0.85;
  }
  50% {
    transform: scale(1.08);
    opacity: 1;
  }
}

.status-icon.phase-战斗,
.status-icon.phase-遇战 {
  animation: statusShake 0.5s ease-in-out infinite;
}

@keyframes statusShake {
  0%, 100% { transform: translateX(0) rotate(0deg); }
  25% { transform: translateX(-4px) rotate(-3deg); }
  75% { transform: translateX(4px) rotate(3deg); }
}

.status-text {
  font-size: 20px;
  font-weight: 700;
  letter-spacing: 1.2px;
  color: rgba(255, 255, 255, 0.95);
  text-shadow: 0 6px 18px rgba(0, 0, 0, 0.4);
  text-align: center;
}

.progress-info {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px 18px;
  background: rgba(0, 0, 0, 0.25);
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.segment-info {
  font-size: 13px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.8);
  text-align: center;
}

.progress-bar-wrapper {
  position: relative;
  height: 10px;
  background: rgba(255, 255, 255, 0.12);
  border-radius: 999px;
  overflow: hidden;
}

.progress-bar-fill {
  position: absolute;
  inset: 0;
  background: linear-gradient(90deg, #8adfff, #35a5ff);
  transition: width 0.5s ease;
  box-shadow: 0 0 12px rgba(138, 223, 255, 0.6);
}

.integrity-info {
  font-size: 14px;
  font-weight: 600;
  color: #7befb2;
  text-align: center;
  text-shadow: 0 2px 8px rgba(123, 239, 178, 0.4);
}

.integrity-info.low {
  color: #ff7575;
  text-shadow: 0 2px 8px rgba(255, 117, 117, 0.4);
  animation: lowIntegrityBlink 1s ease-in-out infinite;
}

@keyframes lowIntegrityBlink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}

/* 押镖控制按钮 */
.convoy-controls {
  display: flex;
  justify-content: center;
  gap: 12px;
}

.control-btn {
  padding: 12px 24px;
  border-radius: 12px;
  border: 1px solid rgba(17, 17, 17, 0.2);
  background: #fff;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.stop-btn {
  color: #c0392b;
  border-color: #c0392b;
}

.stop-btn:hover {
  background: #fff5f5;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(192, 57, 43, 0.2);
}

.control-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 行程日志面板 */
.convoy-log-panel {
  margin-top: 12px;
  border: 1px solid rgba(17, 17, 17, 0.08);
  border-radius: 14px;
  background: #fff;
  overflow: hidden;
}

.convoy-log-panel .log-title {
  padding: 10px 12px;
  font-size: 13px;
  font-weight: 700;
  color: rgba(17,17,17,0.85);
  border-bottom: 1px solid rgba(17, 17, 17, 0.06);
}

.convoy-log-panel .log-list {
  list-style: none;
  margin: 0;
  padding: 8px 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.convoy-log-panel .log-item {
  display: flex;
  gap: 8px;
  align-items: baseline;
  padding: 6px 8px;
  border: 1px solid rgba(17,17,17,0.06);
  border-radius: 10px;
  background: rgba(249, 249, 248, 0.8);
  font-size: 12.5px;
}

.convoy-log-panel .log-item .time {
  font-family: var(--font-family-mono);
  color: rgba(17,17,17,0.6);
  font-size: 11px;
}

.convoy-log-panel .log-item .msg {
  color: #111;
  font-weight: 600;
}

.convoy-log-panel .log-item.type-error { border-color: rgba(231, 76, 60, 0.25); }
.convoy-log-panel .log-item.type-reward { border-color: rgba(26, 188, 156, 0.25); }
.convoy-log-panel .log-item.type-action { border-color: rgba(17, 17, 17, 0.12); }
.convoy-log-panel .log-item.type-info { border-color: rgba(17, 17, 17, 0.12); }
.convoy-log-panel .log-item.empty { color: rgba(17,17,17,0.5); font-weight: normal; border-style: dashed; }

/* 按钮进度条（采集风格） */
.btn.active {
  background: rgba(17, 17, 17, 0.06);
  color: #111;
  cursor: default;
}

.btn-progress-bar {
  position: absolute;
  inset: 0;
  background: linear-gradient(90deg, rgba(17, 17, 17, 0.1), rgba(17, 17, 17, 0.35));
  transition: width 0.5s linear;
}

.btn-text {
  position: relative;
  z-index: 1;
}

.routes { 
  display: flex; 
  flex-direction: column; 
  gap: 14px; 
}

.section-title { 
  font-size: 14px; 
  font-weight: 600; 
  color: rgba(17,17,17,0.8);
  padding-bottom: 6px;
  border-bottom: 1px solid rgba(17,17,17,0.1);
}

.route-grid { 
  display: grid; 
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); 
  gap: 14px; 
}

.route-card { 
  border: 1px solid rgba(17,17,17,0.1); 
  border-radius: 14px; 
  padding: 14px; 
  background: #fff; 
  display: flex; 
  flex-direction: column; 
  gap: 8px;
  transition: border-color 0.15s ease, transform 0.15s ease;
}

.route-card:hover {
  border-color: rgba(17,17,17,0.35);
  transform: translateY(-1px);
}

.card-title { 
  font-weight: 600; 
  font-size: 15px;
  color: #111;
  padding-bottom: 6px;
  border-bottom: 1px solid rgba(17,17,17,0.07);
}

.row { 
  display: flex; 
  gap: 8px; 
  font-size: 11.5px; 
  color: rgba(17,17,17,0.7); 
  line-height: 1.5;
}

.row > span:first-child { 
  min-width: 48px; 
  color: rgba(17,17,17,0.55);
  font-weight: 500;
}

.row > span:last-child {
  color: #111;
  font-weight: 600;
}

.divider { 
  border-top: 1px solid rgba(17,17,17,0.1); 
  margin: 4px 0; 
}

.insure-row { 
  display: flex; 
  align-items: center; 
  gap: 6px; 
  font-size: 11.5px; 
  color: rgba(17,17,17,0.7);
  padding: 8px;
  background: rgba(249, 249, 248, 0.8);
  border-radius: 10px;
  border: 1px solid rgba(17,17,17,0.08);
}

.insure-row input[type="checkbox"] {
  cursor: pointer;
}

.empty { 
  font-size: 12px; 
  color: rgba(17,17,17,0.6); 
  text-align: center; 
  padding: 24px;
  background: rgba(249, 249, 248, 0.8);
  border-radius: 12px;
  border: 1px dashed rgba(17,17,17,0.14);
}

.material-insufficient { 
  color: #c0392b; 
  font-weight: 600; 
}

.btn:disabled { 
  background: rgba(17,17,17,0.06);
  color: rgba(17,17,17,0.4);
  border-color: rgba(17,17,17,0.12);
  cursor: not-allowed;
}

@media (max-width: 1024px) {
  .convoy-view {
    padding: 16px;
  }

  .route-grid {
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  }
}
</style>
