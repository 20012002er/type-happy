<template>
  <div class="meditation-pomodoro">
    <div class="content-grid">
      <div class="left-col">
        <div class="stage">
          <div class="ring" :class="{ running }" :style="{ '--cycleMs': cycleSeconds * 1000 + 'ms' }">
            <svg class="ring-svg" viewBox="0 0 200 200">
              <circle cx="100" cy="100" r="90" class="ring-bg" />
              <circle
                cx="100"
                cy="100"
                r="90"
                class="ring-progress"
                :style="{ strokeDasharray: circumference, strokeDashoffset: progressOffset }"
              />
            </svg>
            <div class="center">
              <div class="center-mode">打坐中</div>
              <div class="center-flow">
                <span>心流</span>
                <InfoPopover :title="'心法·心流'" :description="flowDesc" :showUnderline="false">
                  <span class="flow-help" aria-label="心流说明">
                    <svg class="flow-help-icon" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
                      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2" />
                      <line x1="12" y1="10" x2="12" y2="16" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
                      <circle cx="12" cy="7" r="1.5" fill="currentColor" />
                    </svg>
                  </span>
                </InfoPopover>
                <strong>{{ flowStacks }}/5</strong>
              </div>
            </div>
            <div class="float-layer">
              <div
                v-for="f in floaters"
                :key="f.id"
                class="floater"
                :class="f.type"
                :style="{ '--dx': f.dx + 'px', '--dy': f.dy + 'px' }"
              >
                +{{ f.amount }}
              </div>
            </div>
          </div>
        </div>

        <div class="log-feed">
          <div class="log-head">
            <div class="log-title">修炼记录</div>
            <button class="ghost small" :disabled="!breathLogs.length" @click="clearBreathLogs">清空</button>
          </div>
          <ul v-if="breathLogs.length" class="log-list">
            <li v-for="e in breathLogs" :key="e.id" class="log-line">
              <span class="log-text">{{ e.text }}</span>
              <small class="log-time">{{ timeAgo(e.time) }}</small>
            </li>
          </ul>
          <div v-else class="log-empty">开始入定后，这里会记录你的每一次吐纳与周天。</div>
        </div>
      </div>

    </div>
    <!-- 底部 Dock：操作与展开入口 -->
    <div class="dock">
      <div class="dock-inner">
        <div class="cta-row">
          <button v-if="!running" class="primary" @click="start()">开始</button>
          <button v-else class="ghost" @click="pause()">暂停</button>
          <button class="ghost" @click="reset()">结束</button>
        </div>
        <div class="dock-actions">
          <button class="toggle-btn" @click="panelOpen = !panelOpen">
            <span v-if="!panelOpen">↑ 展开属性与设置</span>
            <span v-else>↓ 收起</span>
          </button>
        </div>
      </div>
    </div>

    <!-- 抽屉遮罩与面板 -->
    <div v-if="panelOpen" class="drawer-mask" @click="panelOpen = false"></div>
    <div v-if="panelOpen" class="panel-drawer">
      <div class="stats">
        <div class="stat hp">
          <div class="stat-row"><span>生命</span><strong>{{ hp }}/{{ maxHp }}</strong></div>
          <div class="bar"><div class="fill" :style="{ width: hpPercent + '%' }"></div></div>
        </div>
        <div class="stat stamina">
          <div class="stat-row"><span>体力</span><strong>{{ staminaCurrent }}/{{ staminaMax }}</strong><small>（{{ staminaRegenRate }}/分钟）</small></div>
          <div class="bar"><div class="fill" :style="{ width: staminaPercent + '%' }"></div></div>
        </div>
        <div class="stat energy">
          <div class="stat-row"><span>内力</span><strong>{{ energy }}/{{ maxEnergy }}</strong><small>（{{ energyRegenRate }}/分钟）</small></div>
          <div class="bar"><div class="fill" :style="{ width: energyPercent + '%' }"></div></div>
        </div>
      </div>
      <div class="panel-controls">
        <div class="row">
          <div class="seg">
            <label>偏重</label>
            <div class="seg-buttons">
              <button :class="{ active: bias==='balanced' }" @click="setBias('balanced')">均衡</button>
              <button :class="{ active: bias==='hp' }" @click="setBias('hp')">养血</button>
              <button :class="{ active: bias==='stamina' }" @click="setBias('stamina')">养体</button>
              <button :class="{ active: bias==='energy' }" @click="setBias('energy')">养气</button>
            </div>
          </div>
        </div>
        <div class="row">
          <div class="seg">
            <label>周期</label>
            <div class="seg-buttons">
              <button :class="{ active: pattern==='even' }" @click="setPattern('even')">均匀 6s</button>
              <button :class="{ active: pattern==='424' }" @click="setPattern('424')">4-2-4 10s</button>
            </div>
          </div>
          <div class="seg">
            <input class="slider" type="range" min="4" max="12" step="1" v-model.number="cycleSeconds" />
            <span class="slider-val">{{ cycleSeconds }}s/呼吸</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue';
import { usePlayerStore } from '@/stores/playerStore';
import { PlayerState } from '@/types/player';
import { staminaService } from '@/services/staminaService';
import InfoPopover from '@/components/InfoPopover.vue';
import { useMeditationQueueStore } from '@/stores/meditationQueueStore';
import { useQueueManager } from '@/services/QueueManagerService';

const playerStore = usePlayerStore();

// 入定状态与吐纳参数
const running = ref(false);
const panelOpen = ref(false);
type Bias = 'balanced' | 'hp' | 'stamina' | 'energy';
const bias = ref<Bias>('balanced');
const pattern = ref<'even' | '424'>('even');
const cycleSeconds = ref(6); // 单次呼吸周期（均匀模式可调）
const flowStacks = ref(0);   // 心流层数 [0,5]
const breathCount = ref(0);  // 已完成呼吸次数
const zhouTianSize = 5;      // 每 N 次呼吸触发一次“周天”

// 进度环（用于轻微动效，非倒计时）
const circumference = 2 * Math.PI * 90;
const progressOffset = computed(() => String(circumference * 0.25));

const staminaGauge = computed(() => (playerStore as any).stamina || { current: 0, max: 0 });
const hp = computed(() => playerStore.player.stats.hp);
const maxHp = computed(() => playerStore.player.stats.maxHp);
const energy = computed(() => Math.floor(playerStore.player.stats.energy || 0));
const maxEnergy = computed(() => playerStore.player.stats.maxEnergy || 0);
const staminaCurrent = computed(() => Math.floor(staminaGauge.value.current || 0));
const staminaMax = computed(() => staminaGauge.value.max || 0);

const hpPercent = computed(() => maxHp.value ? Math.round((hp.value / maxHp.value) * 100) : 0);
const staminaPercent = computed(() => staminaMax.value ? Math.round((staminaCurrent.value / staminaMax.value) * 100) : 0);
const energyPercent = computed(() => maxEnergy.value ? Math.round((energy.value / maxEnergy.value) * 100) : 0);

const staminaRegenRate = computed(() => staminaService.getStaminaRegenRate());
const energyRegenRate = computed(() => staminaService.getEnergyRegenRate(playerStore.player));

const flowDesc = '连续稳定吐纳将累积“心流”层数，最多5层。\n' +
  '· 每完成一次呼吸：心流+1。\n' +
  '· 中断/停下后：心流会随时间缓慢衰减。\n' +
  '· 每5次呼吸：触发一次“小周天”，按当前偏重为对应属性+1。';

// Floaters
interface Floater { id: string; type: 'hp' | 'stamina' | 'energy'; amount: number; dx: number; dy: number; }
const floaters = reactive<Floater[]>([]);
function pushFloater(type: Floater['type'], amount = 1) {
  const angle = Math.random() * Math.PI * 2;
  const r = 40 + Math.random() * 30;
  const dx = Math.cos(angle) * r;
  const dy = Math.sin(angle) * r;
  const id = `${Date.now()}-${Math.random()}`;
  floaters.push({ id, type, amount, dx, dy });
  // 自动清理
  setTimeout(() => {
    const idx = floaters.findIndex(f => f.id === id);
    if (idx >= 0) floaters.splice(idx, 1);
  }, 1500);
}

// 呼吸/周天与心流
let breathTimer: number | null = null;
let flowDecayTimer: number | null = null;

const breathMs = computed(() => pattern.value === 'even' ? cycleSeconds.value * 1000 : 10000);

// 快照：用于计算飘字增量
const snap = reactive({ hp: 0, stamina: 0, energy: 0 });
function updateSnapshot() {
  snap.hp = playerStore.player.stats.hp;
  snap.energy = Math.floor(playerStore.player.stats.energy || 0);
  snap.stamina = Math.floor(((playerStore as any).stamina?.current) || 0);
}

function setBias(b: Bias) { bias.value = b; }
function setPattern(p: 'even' | '424') { pattern.value = p; }

function onBreathComplete() {
  // 生成呼吸期间的自然恢复飘字（由全局tick产生的差值）
  const afterHp = playerStore.player.stats.hp;
  const afterEnergy = Math.floor(playerStore.player.stats.energy || 0);
  const afterStamina = Math.floor(((playerStore as any).stamina?.current) || 0);

  if (afterHp > snap.hp) pushFloater('hp', afterHp - snap.hp);
  if (afterStamina > snap.stamina) pushFloater('stamina', afterStamina - snap.stamina);
  if (afterEnergy > snap.energy) pushFloater('energy', afterEnergy - snap.energy);

  updateSnapshot();

  // 心流与周天
  flowStacks.value = Math.min(5, flowStacks.value + 1);
  breathCount.value += 1;
  // 队列累积次数（用于离线/刷新恢复展示）
  try {
    const mq = useMeditationQueueStore();
    if (mq.currentMeditation) {
      mq.currentMeditation.currentCycle += 1;
    }
  } catch (e) {
    console.warn('[MeditationPomodoro] Failed to update cycle:', e);
  }

  // 文案：每次呼吸的沉浸式提示（轻量）
  pushBreathLog(randomBreathLine());

  if (breathCount.value % zhouTianSize === 0) {
    // 周天奖励：按偏重+1（未满）
    const p: any = playerStore.player as any;
    const ratios = {
      hp: p.stats.maxHp ? p.stats.hp / p.stats.maxHp : 1,
      stamina: p.stamina?.max ? (p.stamina.current / p.stamina.max) : 1,
      energy: p.stats.maxEnergy ? (Math.floor(p.stats.energy || 0) / p.stats.maxEnergy) : 1
    } as Record<'hp'|'stamina'|'energy', number>;

    let target: 'hp'|'stamina'|'energy' = bias.value === 'balanced'
      ? (Object.entries(ratios).sort((a,b) => a[1] - b[1]).map(x => x[0] as any).find(k => {
          if (k === 'hp') return p.stats.hp < p.stats.maxHp;
          if (k === 'stamina') return p.stamina?.current < p.stamina?.max;
          if (k === 'energy') return Math.floor(p.stats.energy||0) < p.stats.maxEnergy;
          return false;
        }) || 'energy')
      : bias.value;

    if (target === 'hp' && p.stats.hp < p.stats.maxHp) {
      playerStore.updateStats({ hp: Math.min(p.stats.maxHp, p.stats.hp + 1) });
      pushFloater('hp', 1);
    } else if (target === 'stamina' && p.stamina && p.stamina.current < p.stamina.max) {
      p.stamina.current = Math.min(p.stamina.max, Math.floor(p.stamina.current || 0) + 1);
      pushFloater('stamina', 1);
    } else if (target === 'energy' && Math.floor(p.stats.energy||0) < p.stats.maxEnergy) {
      playerStore.updateStats({ energy: Math.min(p.stats.maxEnergy, Math.floor(p.stats.energy || 0) + 1) } as any);
      pushFloater('energy', 1);
    }
    // 更新快照，避免重复计入
    updateSnapshot();

    // 文案：周天完成提示（重一点）
    pushBreathLog(zhouTianLine(target));
  }
}

function start() {
  if (running.value) return;
  // 启动队列任务（全局互斥 + 离线可恢复）
  const mq = useMeditationQueueStore();
  mq.startMeditation({ bias: bias.value, pattern: pattern.value, cycleSeconds: cycleSeconds.value });
  const { startTask } = useQueueManager();
  startTask(mq.createQueueTask());

  running.value = true;
  updateSnapshot();
  if (!breathTimer) {
    breathTimer = window.setInterval(onBreathComplete, breathMs.value);
  }
  if (!flowDecayTimer) {
    flowDecayTimer = window.setInterval(() => {
      if (!running.value && flowStacks.value > 0) flowStacks.value = Math.max(0, flowStacks.value - 1);
    }, 30000);
  }
  pushBreathLog('你席地盘膝，调息入定，尘念尽散。');
}

function pause() {
  const { stopTask } = useQueueManager();
  stopTask();
  running.value = false;
  if (breathTimer) { clearInterval(breathTimer); breathTimer = null; }
  pushBreathLog('你暂缓吐纳，收摄心神，静待气定。');
}

function reset() {
  const { stopTask } = useQueueManager();
  stopTask();
  flowStacks.value = 0;
  breathCount.value = 0;
  pushBreathLog('拂衣起身，本次修炼告一段落。');
}

// 当用户调整周期/模式时，若正在入定则重启计时器
watch([cycleSeconds, pattern], () => {
  if (!running.value) return;
  if (breathTimer) { clearInterval(breathTimer); breathTimer = null; }
  breathTimer = window.setInterval(onBreathComplete, breathMs.value);
});

// 将参数变化同步到队列存档（用于离线/刷新恢复）
watch([bias, pattern, cycleSeconds], () => {
  try {
    const mq = useMeditationQueueStore();
    if (mq.currentMeditation) {
      mq.currentMeditation.bias = bias.value as any;
      mq.currentMeditation.pattern = pattern.value as any;
      mq.currentMeditation.cycleSeconds = cycleSeconds.value;
    }
  } catch (e) {
    console.warn('[MeditationPomodoro] Failed to sync snapshot:', e);
  }
});

onMounted(() => {
  updateSnapshot();
  // 若刷新后仍在队列中打坐，则恢复本地动画与日志
  const mq = useMeditationQueueStore();
  if (mq.isMeditating && mq.currentMeditation) {
    // 同步参数到本地UI
    bias.value = mq.currentMeditation.bias as any;
    pattern.value = mq.currentMeditation.pattern as any;
    cycleSeconds.value = mq.currentMeditation.cycleSeconds;
    running.value = true;
    if (!breathTimer) breathTimer = window.setInterval(onBreathComplete, breathMs.value);
    if (!flowDecayTimer) flowDecayTimer = window.setInterval(() => {
      if (!running.value && flowStacks.value > 0) flowStacks.value = Math.max(0, flowStacks.value - 1);
    }, 30000);
  }
});

onUnmounted(() => {
  if (breathTimer) clearInterval(breathTimer);
  if (flowDecayTimer) clearInterval(flowDecayTimer);
});

// ——— 修炼日志 ———
type BreathLog = { id: string; text: string; time: number };
const breathLogs = ref<BreathLog[]>([]);
function pushBreathLog(text: string) {
  const entry = { id: `${Date.now()}-${Math.random()}`, text, time: Date.now() };
  breathLogs.value = [entry, ...breathLogs.value].slice(0, 8);
}
function clearBreathLogs() { breathLogs.value = []; }
function timeAgo(t: number) {
  const d = Date.now() - t;
  if (d < 5000) return '刚刚';
  if (d < 60000) return `${Math.floor(d/1000)}秒前`;
  if (d < 3600000) return `${Math.floor(d/60000)}分钟前`;
  return new Date(t).toLocaleTimeString();
}
function randomBreathLine() {
  const common = [
    '闭目调息，风过青衫。',
    '丹田微热，似有龙吟。',
    '呼吸若丝，脉走周身。',
    '气归丹田，周天若水。',
    '袖底清风，心静如禅。',
    '一息两息，神游江湖。',
    '夜雨入梦，气定神凝。',
    '桥小河窄，意守丹田。',
    '真意若水，循环无端。',
    '筋骨舒展，毛孔尽开。'
  ];
  const h = new Date().getHours();
  let active: string[] = [];
  const dawn = [
    '鸡鸣露冷，心气初生。',
    '东方既白，清气上腾。',
    '晨钟初响，息若游丝。',
    '露重草凉，神凝气定。',
    '晓风微起，意守丹田。',
    '一缕曦光，照彻灵台。',
    '薄雾轻笼，心如明镜。',
    '松间晨露，肺腑生春。',
    '初阳未出，真息绵长。',
    '静坐听更，念起即灭。'
  ];
  const morning = [
    '日华渐盛，胸次开阔。',
    '清气入鼻，神采奕奕。',
    '朝露未散，血脉轻鸣。',
    '山光动色，意行周身。',
    '微汗初生，气机通达。',
    '心平气和，万事可为。',
    '松肩垂肘，丹田温润。',
    '早风拂面，内景自现。',
    '一呼一吸，自成章法。',
    '精神内守，不窥于外。'
  ];
  const noon = [
    '日正当中，心火可熄。',
    '骄阳在上，真息下行。',
    '暑气外散，清凉内生。',
    '气沉丹田，火不上炎。',
    '脾胃调和，百骸俱静。',
    '静里观阳，心不浮躁。',
    '汗下如珠，经络舒展。',
    '大暑将至，神守中宫。',
    '午鼓三闻，神识澄明。',
    '内外相安，气海鼓荡。'
  ];
  const afternoon = [
    '日影西斜，真息平稳。',
    '风过林梢，意随徐行。',
    '劳而不倦，气脉如环。',
    '神不外驰，念念归根。',
    '甘露在舌，津液自生。',
    '心息相依，绵延不绝。',
    '背若横梁，腰如束素。',
    '肌理松开，周天将成。',
    '清风入袖，胸次自宽。',
    '阴阳相济，呼吸有序。'
  ];
  const dusk = [
    '斜阳入窗，神气内敛。',
    '暮鼓渐远，息逐余晖。',
    '霞光散尽，心湖不兴。',
    '鸟归林栖，意守中宫。',
    '灯火初上，神不外驰。',
    '收摄六根，清凉自来。',
    '气归丹田，小周天转。',
    '晚风微拂，经络轻鸣。',
    '影长于地，息短于声。',
    '余辉绸缪，念起即灭。'
  ];
  const night = [
    '月白风清，真气自足。',
    '更漏初定，心如止水。',
    '微风入夜，神藏于内。',
    '清辉如练，灵台明净。',
    '星汉灿然，真息若存。',
    '万籁俱寂，周身熨贴。',
    '明月在天，气脉绵长。',
    '夜色沉沉，意不随境。',
    '一灯如豆，照彻玄关。',
    '静极生动，周而复始。'
  ];
  const midnight = [
    '子夜无声，意守丹田。',
    '夜气最清，真息细长。',
    '星斗在天，神定魄宁。',
    '寒露入怀，气入内景。',
    '更尽漏残，心火自息。',
    '阴极将阳，念起即灭。',
    '天地寂然，唯息可闻。',
    '百会微颤，气机渐盛。',
    '夜半一息，周天若环。',
    '杳然无声，内听自鸣。'
  ];
  if (h >= 5 && h <= 6) active = dawn;
  else if (h >= 7 && h <= 10) active = morning;
  else if (h >= 11 && h <= 13) active = noon;
  else if (h >= 14 && h <= 16) active = afternoon;
  else if (h >= 17 && h <= 19) active = dusk;
  else if (h >= 20 && h <= 22) active = night;
  else active = midnight;
  const pool = active.length ? active : common;
  return pool[Math.floor(Math.random()*pool.length)];
}
function zhouTianLine(target: 'hp'|'stamina'|'energy') {
  if (target === 'hp') return '小周天一转，气血更盛（生命+1）。';
  if (target === 'stamina') return '小周天一圈，筋骨更劲（体力+1）。';
  return '小周天行圆，真气更足（内力+1）。';
}
</script>

<style scoped>
.meditation-pomodoro {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 18px 20px;
  background: #f8f8f7;
  min-height: 100vh;
}

.content-grid { 
  display: grid; 
  grid-template-columns: 1fr; 
  gap: 20px; 
  align-items: start; 
  justify-items: center;
  flex: 1;
}
.left-col { display: flex; flex-direction: column; align-items: center; gap: 10px; width: 100%; }
.right-col { display: none; }
.panel { 
  background: #fff; 
  border: 1px solid rgba(17,17,17,0.1); 
  border-radius: 14px; 
  padding: 12px; 
  width: 100%; 
  max-width: 100%;
  margin: 0 auto 6px;
  display: flex; 
  flex-direction: column; 
  gap: 12px; 
}

.panel-full { width: 100%; }

.stage { display: flex; justify-content: center; align-items: center; padding: 12px; min-height: 380px; }
.ring { position: relative; width: 320px; height: 320px; }
.ring.running { animation: breath var(--cycleMs) ease-in-out infinite; }

.ring-svg { width: 100%; height: 100%; transform: rotate(-90deg); }
.ring-bg { fill: none; stroke: rgba(17,17,17,0.08); stroke-width: 12; }
.ring-progress { fill: none; stroke: #111; stroke-width: 12; stroke-linecap: round; transition: stroke-dashoffset 0.2s linear; }

.center { position: absolute; inset: 0; display: flex; flex-direction: column; justify-content: center; align-items: center; gap: 6px; text-align: center; }
.center-icon { font-size: 40px; filter: drop-shadow(0 2px 6px rgba(0,0,0,0.15)); animation: iconFloat 2.5s ease-in-out infinite, iconBreath var(--cycleMs) ease-in-out infinite; }
.center-mode { font-weight: 800; color: #111; letter-spacing: 0.8px; font-size: 16px; }
.center-time { font-family: var(--font-family-mono, ui-monospace, SFMono-Regular); font-size: 22px; font-weight: 800; }

.center-flow { display: inline-flex; align-items: center; gap: 6px; color: rgba(17,17,17,0.8); }
.center-flow strong { color: #111; }
.flow-help { display: inline-flex; align-items: center; justify-content: center; width: 16px; height: 16px; border-radius: 4px; line-height: 1; cursor: help; color: rgba(17,17,17,0.78); }
.flow-help-icon { display: block; }

.float-layer { position: absolute; inset: 0; pointer-events: none; overflow: visible; }
.floater { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); font-weight: 800; font-size: 14px; opacity: 0; animation: fly 1.5s ease-out forwards; }
.floater.hp { color: #e74c3c; }
.floater.stamina { color: #2ecc71; }
.floater.energy { color: #3498db; }

.stats { display: grid; gap: 10px; }
.panel .stats { background: transparent; border: none; padding: 0; }
.stat { display: flex; flex-direction: column; gap: 6px; }
.stat-row { display: flex; align-items: baseline; gap: 8px; justify-content: space-between; font-size: 13px; color: #111; }
.stat-row small { color: rgba(17,17,17,0.6); font-weight: 600; }
.bar { height: 8px; border-radius: 999px; background: rgba(17,17,17,0.08); overflow: hidden; }
.fill { height: 100%; width: 0%; transition: width 0.25s ease; background: #111; }
.stat.hp .fill { background: #e74c3c; }
.stat.stamina .fill { background: #2ecc71; }
.stat.energy .fill { background: #3498db; }

.panel-controls { display:flex; flex-direction:column; gap: 10px; }
.row { display:flex; gap: 10px; flex-wrap: wrap; }
.seg { display:flex; align-items:center; gap: 10px; }
.seg label { font-size: 12px; color: rgba(17,17,17,0.7); }
.seg-buttons { display:flex; gap: 8px; }
.seg-buttons button { border:1px solid #111; background:#fff; color:#111; border-radius: 10px; padding: 8px 12px; font-weight: 700; cursor:pointer; }
.seg-buttons button.active, .seg-buttons button.primary { background:#111; color:#fff; }
.seg-buttons button.ghost { background:#fff; color:#111; }

.cta-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 10px; width: 100%; }
.cta-row .primary, .cta-row .ghost { border:1px solid #111; border-radius: 12px; padding: 10px 12px; font-weight: 700; cursor:pointer; }
.cta-row .primary { background:#111; color:#fff; }
.cta-row .ghost { background:#fff; color:#111; }
.cta-row button { min-width: 0; }

/* 底部 Dock 与抽屉 */
.dock { position: relative; }
.dock-inner { 
  background: #fff; 
  border: 1px solid rgba(17,17,17,0.1); 
  border-radius: 16px; 
  padding: 10px 12px calc(10px + env(safe-area-inset-bottom)); 
  display: flex; 
  flex-direction: column; 
  gap: 8px; 
}
.dock-actions { display: flex; justify-content: center; }
.toggle-btn { border: 1px dashed rgba(17,17,17,0.3); background: #fff; color: #111; border-radius: 999px; padding: 6px 12px; font-size: 12px; cursor: pointer; }

.drawer-mask { position: fixed; inset: 0; background: rgba(0,0,0,0.2); z-index: 40; }
.panel-drawer { 
  position: fixed; left: 0; right: 0; bottom: 0; height: 70vh; 
  background: #fff; border-top-left-radius: 16px; border-top-right-radius: 16px; 
  border: 1px solid rgba(17,17,17,0.1); border-bottom: none; 
  padding: 12px 14px 16px; 
  display: flex; flex-direction: column; gap: 12px; 
  z-index: 50; overflow: auto;
}

.slider { width: 160px; accent-color: #111; }
.slider-val { font-size: 12px; color: rgba(17,17,17,0.7); }

/* 修炼日志 */
.log-feed { width: 100%; background: #fff; border: 1px solid rgba(17,17,17,0.1); border-radius: 14px; padding: 10px; }
.log-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; }
.log-title { font-weight: 700; font-size: 13px; }
.log-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 6px; max-height: 140px; overflow-y: auto; }
.log-line { display: flex; justify-content: space-between; gap: 8px; font-size: 12px; border-bottom: 1px dashed rgba(17,17,17,0.08); padding-bottom: 4px; }
.log-line:last-child { border-bottom: none; padding-bottom: 0; }
.log-text { color: #111; }
.log-time { color: rgba(17,17,17,0.6); }
.log-empty { font-size: 12px; color: rgba(17,17,17,0.6); }
.ghost.small { border: 1px solid rgba(17,17,17,0.25); background: #fff; color: #111; border-radius: 999px; padding: 4px 10px; font-size: 11px; }

@keyframes fly {
  0% { opacity: 0; transform: translate(-50%, -50%) translate(0, 0) scale(0.9); }
  10% { opacity: 1; }
  100% { opacity: 0; transform: translate(-50%, -50%) translate(var(--dx), var(--dy)) scale(1.1); }
}

@keyframes iconFloat {
  0%,100% { transform: translateY(0) scale(1); }
  50% { transform: translateY(-4px) scale(1.05); }
}

@keyframes breath {
  0% { transform: scale(0.98); }
  50% { transform: scale(1.02); }
  100% { transform: scale(0.98); }
}

@keyframes iconBreath {
  0% { transform: translateY(0) scale(0.98); opacity: 1; }
  50% { transform: translateY(-2px) scale(1.04); opacity: 0.95; }
  100% { transform: translateY(0) scale(0.98); opacity: 1; }
}

@media (max-width: 960px) {
  .content-grid { grid-template-columns: 1fr; }
  .left-col { align-items: center; }
  .cta-row { grid-template-columns: 1fr; max-width: 360px; margin: 0 auto; }
}

@media (max-width: 768px) {
  .ring { width: 260px; height: 260px; }
}
</style>
