import { ref, readonly, computed } from 'vue';
import { AutoRunner } from '@/services/auto/AutoRunner';
import { useQueueManager, type QueueTask } from '@/services/QueueManagerService';
import { getConvoyRoute } from '@/services/config/ConvoyRoutesService';
import { ReputationService } from '@/services/reputationService';
import { useGameLogStore } from '@/stores/gameLogStore';
import { usePlayerStore } from '@/stores/playerStore';
import { useMapStore } from '@/stores/mapStore';
import { useCombatStore } from '@/stores/combatStore';
import { pickEnemyId } from '@/services/config/MonsterGroupService';
import { getEnemy } from '@/services/config/EnemyConfigService';
import { dropService } from '@/services/loot/DropService';
import { useEquipmentStore } from '@/stores/equipmentStore';
import { useMaterialsStore } from '@/stores/materialsStore';
import { getBlueprint } from '@/services/config/EquipmentBlueprintService';

type Phase = 'idle' | 'preparing' | 'traveling' | 'event' | 'fighting' | 'settling' | 'stopping';

class ConvoyServiceImpl {
  private phase: Phase = 'idle';
  private runner: AutoRunner | null = null;
  private taskId: string | null = null;
  private routeId: string | null = null;
  private routeName = '';
  private totalMs = 0;
  private elapsedMs = 0;
  private segments = 0;
  private segIndex = 0;
  private segMs = 0;
  private segElapsedMs = 0;
  private integrity = 100;
  private minRewardRatio = 0.5;
  private stopRequested = false;
  private lastPhaseText = '';
  private insured = false;
  private insuranceCostUsed = 0;

  // 懒加载 stores，避免在模块加载时初始化 Pinia
  private _queue?: ReturnType<typeof useQueueManager>;
  private _logs?: ReturnType<typeof useGameLogStore>;
  private _playerStore?: ReturnType<typeof usePlayerStore>;
  private _mapStore?: ReturnType<typeof useMapStore>;
  private _combatStore?: ReturnType<typeof useCombatStore>;

  private get queue() {
    if (!this._queue) this._queue = useQueueManager();
    return this._queue;
  }

  private get logs() {
    if (!this._logs) this._logs = useGameLogStore();
    return this._logs;
  }

  private get playerStore() {
    if (!this._playerStore) this._playerStore = usePlayerStore();
    return this._playerStore;
  }

  private get mapStore() {
    if (!this._mapStore) this._mapStore = useMapStore();
    return this._mapStore;
  }

  private get combatStore() {
    if (!this._combatStore) this._combatStore = useCombatStore();
    return this._combatStore;
  }

  // reactive state for UI binding
  private rPhase = ref<Phase>('idle');
  private rPhaseText = ref('空闲');
  private rRouteId = ref<string | null>(null);
  private rRouteName = ref('');
  private rIntegrity = ref(100);
  private rSegIndex = ref(0);
  private rSegments = ref(0);
  private rElapsedMs = ref(0);
  private rTotalMs = ref(0);

  // public readonly refs
  phaseRef = readonly(this.rPhase);
  phaseTextRef = readonly(this.rPhaseText);
  routeIdRef = readonly(this.rRouteId);
  routeNameRef = readonly(this.rRouteName);
  integrityRef = readonly(this.rIntegrity);
  segmentIndexRef = readonly(this.rSegIndex);
  segmentsRef = readonly(this.rSegments);
  elapsedMsRef = readonly(this.rElapsedMs);
  totalMsRef = readonly(this.rTotalMs);
  progressPercentRef = computed(() => {
    const phase = this.rPhase.value;
    if (phase === 'fighting') return -1;
    const total = this.rTotalMs.value;
    const elapsed = this.rElapsedMs.value;
    if (total <= 0) return 0;
    return Math.min(100, (elapsed / total) * 100);
  });
  isRunningRef = computed(() => this.rPhase.value !== 'idle' && this.rPhase.value !== 'stopping');

  private ensureRunner() {
    if (this.runner) return;
    this.runner = new AutoRunner({
      shouldRun: async () => this.phase !== 'idle',
      onTick: async ({ dtSeconds }) => {
        await this.onTick(dtSeconds);
      },
      options: {
        tickMinSeconds: 1,
        tickMaxSeconds: 1,
        tickIntervalMs: 500,
        autoPauseOnHidden: false,
        progressUpdateIntervalMs: 100,
      },
    });
  }

  private setPhase(p: Phase) {
    this.phase = p;
    this.rPhase.value = p;
    this.setPhaseText();
  }

  private syncStateRefs() {
    this.rRouteId.value = this.routeId;
    this.rRouteName.value = this.routeName;
    this.rIntegrity.value = this.integrity;
    this.rSegIndex.value = this.segIndex;
    this.rSegments.value = this.segments;
    this.rElapsedMs.value = this.elapsedMs;
    this.rTotalMs.value = this.totalMs;
  }

  private createQueueTask(): QueueTask {
    const id = this.taskId ?? `convoy_${Date.now()}`;
    this.taskId = id;
    return {
      id,
      type: 'exploring',
      name: `押镖·${this.routeName}`,
      stopQueue: () => {
        this.requestStop(true);
      },
      isRunning: () => this.phase !== 'idle',
      getProgress: () => {
        if (this.phase === 'fighting') return -1;
        if (this.totalMs <= 0) return 0;
        return Math.min(100, (this.elapsedMs / this.totalMs) * 100);
      },
      getRemainingTime: () => {
        if (this.phase === 'fighting') return 0;
        return Math.max(0, this.totalMs - this.elapsedMs);
      },
      getPhaseDescription: () => this.lastPhaseText || '进行中',
    };
  }

  private setPhaseText(): void {
    if (this.phase === 'preparing') this.lastPhaseText = '准备出发';
    else if (this.phase === 'traveling')
      this.lastPhaseText = `在途 第${this.segIndex + 1}/${this.segments}段`;
    else if (this.phase === 'event')
      this.lastPhaseText = `在途事件 第${this.segIndex + 1}/${this.segments}段`;
    else if (this.phase === 'fighting') this.lastPhaseText = '遭遇战';
    else if (this.phase === 'settling') this.lastPhaseText = '结算中';
    else if (this.phase === 'stopping') this.lastPhaseText = '正在停止';
    else this.lastPhaseText = '空闲';
    this.rPhaseText.value = this.lastPhaseText;
  }

  private getDateKey(): string {
    const d = new Date();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}${mm}${dd}`;
  }

  private getDailyCount(routeId: string): number {
    const key = `convoy_daily_${routeId}_${this.getDateKey()}`;
    const raw = localStorage.getItem(key);
    return raw ? parseInt(raw, 10) || 0 : 0;
  }

  private incDailyCount(routeId: string): void {
    const key = `convoy_daily_${routeId}_${this.getDateKey()}`;
    const v = this.getDailyCount(routeId) + 1;
    localStorage.setItem(key, String(v));
  }

  private getCooldownRemainMs(routeId: string, cooldownSec?: number): number {
    if (!cooldownSec || cooldownSec <= 0) return 0;
    const key = `convoy_cd_${routeId}`;
    const last = parseInt(localStorage.getItem(key) || '0', 10) || 0;
    const now = Date.now();
    const remain = last + cooldownSec * 1000 - now;
    return Math.max(0, remain);
  }

  private markCooldown(routeId: string): void {
    const key = `convoy_cd_${routeId}`;
    localStorage.setItem(key, String(Date.now()));
  }

  private isUnlocked(routeId: string): boolean {
    const raw = localStorage.getItem('convoy_unlocks');
    if (!raw) return false;
    try {
      const obj = JSON.parse(raw);
      return !!obj[routeId];
    } catch {
      return false;
    }
  }

  private unlockRoute(routeId: string): void {
    const raw = localStorage.getItem('convoy_unlocks');
    const obj = raw
      ? (() => {
          try {
            return JSON.parse(raw);
          } catch {
            return {};
          }
        })()
      : {};
    obj[routeId] = true;
    localStorage.setItem('convoy_unlocks', JSON.stringify(obj));
  }

  private async onTick(dtSeconds: number) {
    if (this.phase === 'traveling') {
      this.segElapsedMs += dtSeconds * 1000;
      this.elapsedMs += dtSeconds * 1000;
      this.syncStateRefs();
      if (this.segElapsedMs >= this.segMs) {
        this.setPhase('event');
        await this.handleSegmentEvent();
      }
      return;
    }
    if (this.phase === 'stopping') {
      if (this.runner && !this.runner.isRunning()) {
        this.finalizeStop();
      }
      return;
    }
  }

  private async handleSegmentEvent() {
    const route = await getConvoyRoute(this.routeId!);
    if (!route) {
      this.fail('配置丢失');
      return;
    }
    const ev = this.rollEvent(route.events);
    if (!ev) {
      await this.nextSegmentOrFinish();
      return;
    }
    if (ev.log) this.logs.addInfoLog(ev.log);
    if (ev.type === 'none') {
      await this.nextSegmentOrFinish();
      return;
    }
    if (ev.type === 'toll') {
      const gold = Math.max(0, ev.gold || 0);
      const owned = this.playerStore.player.resources.gold;
      if (owned >= gold) this.playerStore.updateResources({ gold: owned - gold });
      await this.nextSegmentOrFinish();
      return;
    }
    if (ev.type === 'wear') {
      const [a, b] = ev.integrityLoss || [5, 10];
      const loss = a + Math.floor(Math.random() * Math.max(1, b - a + 1));
      this.integrity = Math.max(0, this.integrity - loss);
      this.syncStateRefs();
      if (this.integrity <= 0) {
        this.fail('货物尽毁');
        return;
      }
      await this.nextSegmentOrFinish();
      return;
    }
    if (ev.type === 'lucky') {
      // 好运事件：增加完整度
      const [a, b] = ev.integrityBonus || [3, 8];
      const bonus = a + Math.floor(Math.random() * Math.max(1, b - a + 1));
      this.integrity = Math.min(100, this.integrity + bonus);
      this.syncStateRefs();
      this.logs.addInfoLog(`货物完整度 +${bonus}%`);
      await this.nextSegmentOrFinish();
      return;
    }
    if (ev.type === 'rest') {
      // 休整事件：恢复完整度
      const [a, b] = ev.integrityRestore || [5, 10];
      const restore = a + Math.floor(Math.random() * Math.max(1, b - a + 1));
      this.integrity = Math.min(100, this.integrity + restore);
      this.syncStateRefs();
      this.logs.addInfoLog(`休整修复，货物完整度恢复 ${restore}%`);
      await this.nextSegmentOrFinish();
      return;
    }
    if (ev.type === 'fortune') {
      // 意外之财事件：增加金币
      const [a, b] = ev.goldBonus || [30, 60];
      const bonus = a + Math.floor(Math.random() * Math.max(1, b - a + 1));
      const owned = this.playerStore.player.resources.gold;
      this.playerStore.updateResources({ gold: owned + bonus });
      this.logs.addRewardLog(`意外收获 ${bonus} 金币！`);
      await this.nextSegmentOrFinish();
      return;
    }
    if (ev.type === 'danger_chain') {
      // 险象环生事件：连续损耗，损失更大
      const [a, b] = ev.integrityLoss || [15, 25];
      const loss = a + Math.floor(Math.random() * Math.max(1, b - a + 1));
      this.integrity = Math.max(0, this.integrity - loss);
      this.syncStateRefs();
      this.logs.addErrorLog(`险象环生！货物完整度 -${loss}%`);
      if (this.integrity <= 0) {
        this.fail('货物尽毁');
        return;
      }
      await this.nextSegmentOrFinish();
      return;
    }
    if (ev.type === 'ambush_normal' || ev.type === 'ambush_elite') {
      const pick = await pickEnemyId(ev.groupId || 'trail_monsters');
      if (!pick) {
        await this.nextSegmentOrFinish();
        return;
      }
      const enemy = await getEnemy(pick.enemyId);
      if (!enemy) {
        await this.nextSegmentOrFinish();
        return;
      }
      this.setPhase('fighting');
      const res = await this.combatStore.startCombat(this.playerStore.player, enemy);
      if (!res || res.winner !== 'player') {
        this.fail('遭遇战失败');
        return;
      }
      if (this.stopRequested) {
        await this.finish(false);
        return;
      }
      await this.nextSegmentOrFinish();
      return;
    }
    await this.nextSegmentOrFinish();
  }

  private rollEvent(events: { weight: number }[]): any | null {
    if (!events || events.length === 0) return null;
    const total = events.reduce((s: number, e: any) => s + Math.max(0, e.weight || 0), 0) || 0;
    if (total <= 0) return null;
    let roll = Math.random() * total;
    for (const e of events) {
      roll -= Math.max(0, e.weight || 0);
      if (roll <= 0) return e;
    }
    return events[events.length - 1];
  }

  private async nextSegmentOrFinish() {
    this.segIndex += 1;
    this.syncStateRefs();
    if (this.segIndex >= this.segments) {
      await this.finish(true);
      return;
    }
    this.segElapsedMs = 0;
    this.setPhase('traveling');
  }

  private calcReward(base: number): number {
    const r = Math.max(this.minRewardRatio, this.integrity / 100);
    return Math.floor(base * r);
  }

  private async finish(success: boolean) {
    this.setPhase('settling');
    const route = await getConvoyRoute(this.routeId!);
    if (!route) {
      this.fail('配置丢失');
      return;
    }
    const base = Math.max(0, route.rewards.goldBase || 0);
    const dep = Math.max(0, route.costs.deposit || 0);
    if (success) {
      const gain = this.calcReward(base) + dep;
      const g = this.playerStore.player.resources.gold + gain;
      this.playerStore.updateResources({ gold: g });
      this.logs.addRewardLog(`押镖成功，返还押金${dep}，获得金币${gain - dep}`);

      // 声望奖励
      ReputationService.onConvoyComplete();

      // 掉落接入（按 dropGroups 概率）；优先按地图 dropGroups，缺失时回退蓝图池
      if (route.rewards.dropGroups && route.rewards.dropGroups.length > 0) {
        try {
          const world = this.mapStore.mapData;
          const loc = this.mapStore.getCurrentLocationSnapshot();
          const eqStore = useEquipmentStore();
          const matStore = useMaterialsStore();
          const fallbackBlueprintPool = loc?.idle?.blueprintPool || [
            'qinggang_jian',
            'hanfeng_jian',
            'tieji_jian',
            'yunwen_pao',
            'mianjia',
            'huxin_jia',
            'mu_jiezhi',
            'yinyue_jiezhi',
            'bu_xie',
            'fengxing_xue',
          ];
          for (const grp of route.rewards.dropGroups) {
            const chance = Math.max(0, Math.min(1, grp.chance || 0));
            if (Math.random() >= chance) continue;

            const groupList = world?.dropGroupsById?.[grp.id];
            if (Array.isArray(groupList) && groupList.length > 0) {
              // 一次权重抽取，支持子组
              const pickFrom = (items: any[]): any | null => {
                const total =
                  items.reduce((s: number, it: any) => s + Math.max(0, it.weight || 0), 0) || 0;
                if (total <= 0) return null;
                let roll = Math.random() * total;
                for (const it of items) {
                  roll -= Math.max(0, it.weight || 0);
                  if (roll <= 0) return it;
                }
                return items[items.length - 1];
              };

              let entry: any = pickFrom(groupList);
              if (
                entry?.type === 'subGroup' &&
                entry.groupId &&
                world?.dropGroupsById?.[entry.groupId]
              ) {
                const sub = world.dropGroupsById[entry.groupId];
                if (Array.isArray(sub) && sub.length > 0) entry = pickFrom(sub) || entry;
              }

              const itemId = entry?.itemId as string | undefined;
              if (itemId) {
                const minQ = Math.max(1, Number(entry.minQty || 1));
                const maxQ = Math.max(minQ, Number(entry.maxQty || minQ));
                const qty = minQ + Math.floor(Math.random() * (maxQ - minQ + 1));
                const bp = await getBlueprint(itemId);
                if (bp) {
                  for (let i = 0; i < qty; i++) await useEquipmentStore().addItemById(itemId);
                  this.logs.addRewardLog(`押镖额外获得装备：${bp.name} x${qty}`);
                } else {
                  matStore.add(itemId, qty);
                  this.logs.addRewardLog(`押镖额外获得物资：${itemId} x${qty}`);
                }
                continue;
              }
            }

            // 回退：使用蓝图池生成一件装备
            const item = await dropService.rollEquipment(
              fallbackBlueprintPool,
              this.playerStore.player.stats.level
            );
            if (item) {
              (eqStore.inventory as any).value.push(item as any);
              this.logs.addRewardLog(
                `押镖额外获得：${item.name}${item.affixes && item.affixes.length > 0 ? '（' + item.affixes.join('、') + '）' : ''}`
              );
            }
          }
        } catch (e) {
          console.warn('[Convoy] 掉落处理失败:', e);
        }
      }
    } else {
      const baseRatio = Math.max(0, Math.min(1, route.failure?.consolationGoldRatio ?? 0));
      const ratio = this.insured ? Math.max(baseRatio, 0.4) : baseRatio;
      const gain = this.calcReward(Math.floor(base * ratio));
      const g = this.playerStore.player.resources.gold + gain;
      this.playerStore.updateResources({ gold: g });
      this.logs.addRewardLog(
        `押镖失败，押金没收${this.insured ? '（已投保，提高补偿）' : ''}，获得补偿金币${gain}`
      );
    }
    this.markCooldown(this.routeId!);
    this.stopInternal();
  }

  private fail(msg: string) {
    this.logs.addErrorLog(`押镖失败：${msg}`);
    this.finish(false);
  }

  private stopInternal() {
    this.setPhase('idle');
    this.segElapsedMs = 0;
    this.elapsedMs = 0;
    this.segments = 0;
    this.segIndex = 0;
    this.totalMs = 0;
    this.segMs = 0;
    this.routeId = null;
    this.routeName = '';
    this.insured = false;
    this.insuranceCostUsed = 0;
    this.taskId = null;
    if (this.runner) {
      this.runner.stop();
      this.runner = null;
    }
    this.syncStateRefs();
  }

  private finalizeStop() {
    this.stopInternal();
  }

  async start(routeId: string, options?: { insured?: boolean }): Promise<boolean> {
    if (this.phase !== 'idle') return false;
    const cfg = await getConvoyRoute(routeId);
    if (!cfg) {
      this.logs.addErrorLog('押镖配置不存在');
      return false;
    }
    // 不再检查起点位置，押镖可以从任意地点开始
    if (cfg.minLevel && this.playerStore.player.stats.level < cfg.minLevel) {
      this.logs.addInfoLog(`需要等级${cfg.minLevel}`);
      return false;
    }
    const cdRemain = this.getCooldownRemainMs(cfg.id, cfg.limits?.cooldownSec);
    if (cdRemain > 0) {
      this.logs.addInfoLog('路线冷却中');
      return false;
    }
    if (cfg.limits?.daily) {
      if (this.getDailyCount(cfg.id) >= cfg.limits.daily) {
        this.logs.addInfoLog('今日次数已用尽');
        return false;
      }
    }
    if (!this.isUnlocked(cfg.id)) {
      const need = Math.max(0, cfg.unlock?.gold || 0);
      if (need > 0) {
        const owned = this.playerStore.player.resources.gold;
        if (owned < need) {
          this.logs.addInfoLog('金币不足，无法解锁');
          return false;
        }
        this.playerStore.updateResources({ gold: owned - need });
        this.logs.addActionLog(`解锁押镖·${cfg.name}，消耗金币${need}`);
      }
      this.unlockRoute(cfg.id);
    }
    const commission = Math.max(0, cfg.costs.commission || 0);
    const deposit = Math.max(0, cfg.costs.deposit || 0);
    const ownedGold = this.playerStore.player.resources.gold;
    // 保险（可选）：成本为押金的20%，失败提高补偿
    this.insured = !!options?.insured;
    this.insuranceCostUsed = 0;
    if (this.insured) {
      this.insuranceCostUsed = Math.floor(deposit * 0.2);
    }
    if (ownedGold < commission + deposit + this.insuranceCostUsed) {
      this.logs.addInfoLog('金币不足，无法出发');
      return false;
    }

    // 检查材料需求
    const matStore = useMaterialsStore();
    if (cfg.costs.materials && cfg.costs.materials.length > 0) {
      for (const mat of cfg.costs.materials) {
        const owned = matStore.stacks[mat.itemId]?.qty || 0;
        if (owned < mat.qty) {
          this.logs.addInfoLog(
            `材料不足：${mat.name || mat.itemId}（需要${mat.qty}，拥有${owned}）`
          );
          return false;
        }
      }
      // 消耗材料
      for (const mat of cfg.costs.materials) {
        matStore.consume(mat.itemId, mat.qty);
      }
    }

    this.playerStore.updateResources({
      gold: ownedGold - commission - deposit - this.insuranceCostUsed,
    });
    this.logs.addActionLog(`启程押镖·${cfg.name}，支付佣金${commission}与押金${deposit}`);
    if (cfg.costs.materials && cfg.costs.materials.length > 0) {
      const matList = cfg.costs.materials.map(m => `${m.name || m.itemId}×${m.qty}`).join('、');
      this.logs.addActionLog(`消耗材料：${matList}`);
    }
    if (this.insured && this.insuranceCostUsed > 0) {
      this.logs.addActionLog(`已购买押镖保险，费用${this.insuranceCostUsed}`);
    }

    this.routeId = cfg.id;
    this.routeName = cfg.name;
    this.totalMs = Math.max(1, cfg.durationSec * 1000);
    this.elapsedMs = 0;
    this.segments = Math.max(1, cfg.segments);
    this.segIndex = 0;
    this.segMs = Math.floor(this.totalMs / this.segments);
    this.segElapsedMs = 0;
    this.integrity = Math.max(0, Math.min(100, cfg.integrity.start));
    this.minRewardRatio = Math.max(0, Math.min(1, cfg.integrity.minRewardRatio));
    this.stopRequested = false;
    this.syncStateRefs();

    this.setPhase('preparing');
    this.taskId = `convoy_${Date.now()}`;
    this.queue.startTask(this.createQueueTask());

    this.ensureRunner();
    this.setPhase('traveling');
    this.incDailyCount(cfg.id);
    this.runner?.start();
    return true;
  }

  requestStop(fromQueue = false): void {
    if (this.phase === 'idle') return;
    this.stopRequested = true;
    if (!fromQueue && this.taskId) {
      this.queue.stopTask(this.taskId);
      return;
    }
    if (this.phase === 'fighting') {
      this.setPhase('stopping');
      return;
    }
    this.finish(false);
  }

  isRunning(): boolean {
    return this.phase !== 'idle' && this.phase !== 'stopping';
  }

  // public helpers for UI
  getDailyCountPublic(routeId: string): number {
    return this.getDailyCount(routeId);
  }
  getCooldownRemainSeconds(routeId: string, cooldownSec?: number): number {
    return Math.ceil(this.getCooldownRemainMs(routeId, cooldownSec) / 1000);
  }
  isRouteUnlockedPublic(routeId: string): boolean {
    return this.isUnlocked(routeId);
  }
  async unlockRoutePublic(routeId: string): Promise<boolean> {
    if (this.isUnlocked(routeId)) return true;
    const cfg = await getConvoyRoute(routeId);
    if (!cfg) {
      this.logs.addErrorLog('押镖配置不存在');
      return false;
    }
    const need = Math.max(0, cfg.unlock?.gold || 0);
    if (need > 0) {
      const owned = this.playerStore.player.resources.gold;
      if (owned < need) {
        this.logs.addInfoLog('金币不足，无法解锁');
        return false;
      }
      this.playerStore.updateResources({ gold: owned - need });
      this.logs.addActionLog(`解锁押镖·${cfg.name}，消耗金币${need}`);
    }
    this.unlockRoute(cfg.id);
    return true;
  }

  /**
   * 获取保存数据（用于SaveManager）
   */
  getSaveData() {
    if (this.phase === 'idle') return null;

    return {
      phase: this.phase,
      routeId: this.routeId,
      routeName: this.routeName,
      totalMs: this.totalMs,
      elapsedMs: this.elapsedMs,
      segments: this.segments,
      segIndex: this.segIndex,
      segMs: this.segMs,
      segElapsedMs: this.segElapsedMs,
      integrity: this.integrity,
      minRewardRatio: this.minRewardRatio,
      insured: this.insured,
      insuranceCostUsed: this.insuranceCostUsed,
      taskId: this.taskId,
      saveTimestamp: Date.now(),
    };
  }

  /**
   * 从保存数据恢复押镖状态
   */
  async loadFromSave(data: any): Promise<boolean> {
    if (!data || !data.routeId || !data.phase || data.phase === 'idle') {
      return false;
    }

    try {
      // 获取路线配置
      const cfg = await getConvoyRoute(data.routeId);
      if (!cfg) {
        console.warn('[ConvoyService] 恢复失败：路线不存在', data.routeId);
        return false;
      }

      // 计算离线时间
      const now = Date.now();
      const offlineMs = now - (data.saveTimestamp || now);

      // 恢复基础状态
      this.routeId = data.routeId;
      this.routeName = data.routeName || cfg.name;
      this.totalMs = data.totalMs || 0;
      this.elapsedMs = (data.elapsedMs || 0) + offlineMs;
      this.segments = data.segments || 0;
      this.segIndex = data.segIndex || 0;
      this.segMs = data.segMs || 0;
      this.segElapsedMs = (data.segElapsedMs || 0) + offlineMs;
      this.integrity = data.integrity !== undefined ? data.integrity : 100;
      this.minRewardRatio = data.minRewardRatio || 0.5;
      this.insured = data.insured || false;
      this.insuranceCostUsed = data.insuranceCostUsed || 0;
      this.taskId = data.taskId || `convoy_${Date.now()}`;
      this.stopRequested = false;

      // 恢复阶段
      this.setPhase(data.phase as Phase);
      this.syncStateRefs();

      // 启动QueueTask
      const task = this.createQueueTask();
      this.queue.startTask(task);

      // 启动runner
      this.ensureRunner();
      this.runner?.start();

      this.logs.addInfoLog(`恢复押镖·${this.routeName}（离线${Math.floor(offlineMs / 1000)}秒）`);
      return true;
    } catch (error) {
      console.error('[ConvoyService] 恢复押镖状态失败:', error);
      this.stopInternal();
      return false;
    }
  }
}

export const convoyService = new ConvoyServiceImpl();
