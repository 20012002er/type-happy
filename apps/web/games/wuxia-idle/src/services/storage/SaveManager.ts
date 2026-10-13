import { SaveServiceFactory } from './SaveServiceFactory';
import { unref } from 'vue';
import type { GameStorageService, StorageMode } from './types';
import { createCipher, parseCipher } from '../../utils/saveCipher';
import type { Player } from '@/types/player';
import { DEFAULT_PLAYER_CONFIG } from '@/types/player';
import { calculateBaseStats } from '@/utils/calculations';
import { getRequiredExpForNextLevel } from '@/config/levelExpConfig';
import { usePlayerStore } from '@/stores/playerStore';
import { useMapStore } from '@/stores/mapStore';
import { useEquipmentStore } from '@/stores/equipmentStore';
import { useMeditationStore } from '@/stores/meditationStore';
import type { MeditationSnapshot } from '@/types/meditation';
import { useLifeSkillStore } from '@/stores/lifeSkillStore';
import { useMaterialsStore, type MaterialStack } from '@/stores/materialsStore';
import type { PlayerSkillData } from '@/types/lifeSkill';
import type { OfflineSnapshot } from '@/types/offline';
import { useGatherQueueStore } from '@/stores/gatherQueueStore';
import { useSmithingQueueStore } from '@/stores/smithingQueueStore';
import { useCookingQueueStore } from '@/stores/cookingQueueStore';
import { useAlchemyQueueStore } from '@/stores/alchemyQueueStore';
import { useCombatStore } from '@/stores/combatStore';
import { useCombatAutomationStore } from '@/stores/combatAutomationStore';
import { getEnemy } from '@/services/config/EnemyConfigService';
import { useAchievementStore, type AchievementSaveEntry } from '@/stores/achievementStore';
import { useTalentTreeStore } from '@/stores/talentTreeStore';
import { convoyService } from '@/services/ConvoyService';
import { useMeditationQueueStore } from '@/stores/meditationQueueStore';
import { useSeclusionStore } from '@/stores/seclusionStore';
import type { SeclusionSnapshot } from '@/types/seclusion';
import { useReputationStore, type ReputationSaveEntry } from '@/stores/reputationStore';
import { useTitleStore, type TitleSaveEntry } from '@/stores/titleStore';
import { useJianghuRankingStore } from '@/stores/jianghuRankingStore';
import { useSectContributionStore } from '@/stores/sectContributionStore';
import { useSectStore } from '@/stores/sectStore';
import { mergeLegacySectData } from './sectSaveMigration';

export interface GameSnapshotV1 {
  version: '1.0.0';
  timestamp: number;
  player: Player;
  currentLocationId: string;
  inventory?: any[];
  equipped?: any;
  meditation?: MeditationSnapshot;
  lost?: {
    records: { id: string; name: string; timestamp: number; note: string }[];
  };
  lifeSkills?: PlayerSkillData;
  materials?: Record<string, MaterialStack>;
  offline?: OfflineSnapshot; // 离线状态快照

  // 队列状态（用于刷新后恢复）
  meditationQueue?: {
    currentMeditation: {
      startTime: number;
      bias: string;
      pattern: string;
      cycleSeconds: number;
      currentCycle: number;
    } | null;
  };
  gatherQueue?: {
    currentGathering: {
      skillType: string;
      resourceId: string;
      resourceName: string;
      gatherTime: number;
      startTime: number;
      currentCycle: number;
    } | null;
  };
  smithingQueue?: {
    currentSmithing: {
      recipeId: string;
      recipeName: string;
      startTime: number;
      craftTime: number;
      currentCycle: number;
    } | null;
  };
  cookingQueue?: {
    currentCooking: {
      recipeId: string;
      recipeName: string;
      startTime: number;
      duration: number;
      currentCycle: number;
    } | null;
  };
  alchemyQueue?: {
    currentAlchemy: {
      recipeId: string;
      recipeName: string;
      startTime: number;
      craftTime: number;
      currentCycle: number;
    } | null;
  };
  combatStats?: {
    wins: number;
    losses: number;
  };
  talentTree?: {
    unlockedNodes: string[];
    availableInsight: number;
  };
  achievements?: AchievementSaveEntry[];
  convoyState?: any; // 押镖状态
  /** 闭关修炼状态 */
  seclusion?: SeclusionSnapshot;
  /** 自动战斗（刷怪）状态（用于刷新后恢复） */
  combatAutomation?: {
    running: boolean;
    currentEnemyId?: string;
    wins: number;
    losses: number;
    waitingRemainingMs: number;
  };
  /** 声望系统状态 */
  reputation?: ReputationSaveEntry;
  /** 称号系统状态 */
  titles?: TitleSaveEntry;
  /** 江湖榜系统状态 */
  jianghuRanking?: Record<string, any>;
  /** 门派系统状态 */
  sect?: Record<string, any>;
  /** 门派贡献系统状态 */
  contribution?: Record<string, any>;
}

export class SaveManager {
  private storage: GameStorageService;

  constructor(mode: StorageMode = 'local') {
    this.storage = SaveServiceFactory.create(mode);
  }

  async export(): Promise<string> {
    const snapshot = await this.buildSnapshot();
    const json = JSON.stringify(snapshot);
    const encrypted = await createCipher(json);
    await this.storage.save(encrypted);
    return encrypted;
  }

  async import(encryptedPayload: string): Promise<boolean> {
    try {
      const json = await parseCipher(encryptedPayload);
      const parsed = JSON.parse(json);
      return await this.applySnapshot(parsed);
    } catch {
      return false;
    }
  }

  async load(): Promise<boolean> {
    const encrypted = await this.storage.load();
    if (!encrypted) return false;
    return await this.import(encrypted);
  }

  /**
   * 获取离线快照（用于计算离线收益）
   */
  async getOfflineSnapshot(): Promise<OfflineSnapshot | null> {
    const encrypted = await this.storage.load();
    if (!encrypted) return null;

    try {
      const json = await parseCipher(encrypted);
      const parsed = JSON.parse(json);

      // 返回离线快照，如果不存在则构建一个默认的
      if (parsed.offline) {
        return parsed.offline;
      }

      // 兼容旧存档：使用timestamp作为lastActiveTime
      if (parsed.timestamp) {
        return {
          lastActiveTime: parsed.timestamp,
        };
      }

      return null;
    } catch {
      return null;
    }
  }

  async getLastSaveTime(): Promise<number> {
    return this.storage.getLastSaveTime();
  }

  // 自动保存：调用 export 即可
  async autoSave(): Promise<void> {
    await this.export();
  }

  // 版本化快照构建
  private async buildSnapshot(): Promise<GameSnapshotV1> {
    const player = usePlayerStore().player;
    const mapStore = useMapStore();
    const eq = useEquipmentStore();
    const med = useMeditationStore();
    const lifeSkill = useLifeSkillStore();
    const materials = useMaterialsStore();
    const gatherQueue = useGatherQueueStore();
    const smithingQueue = useSmithingQueueStore();
    const cookingQueue = useCookingQueueStore();
    const alchemyQueue = useAlchemyQueueStore();
    const meditationQueue = useMeditationQueueStore();
    const combat = useCombatStore();
    const combatAuto = useCombatAutomationStore();
    const talentTree = useTalentTreeStore();
    const achievementStore = useAchievementStore();
    const seclusionStore = useSeclusionStore();
    const reputationStore = useReputationStore();
    const titleStore = useTitleStore();
    const jianghuRankingStore = useJianghuRankingStore();
    const sectStore = useSectStore();
    const sectContributionStore = useSectContributionStore();

    // 注意：不要在这里调用 sectStore.load()，数据已通过 restoreFromSave 恢复
    // 手动加载会导致覆盖已恢复的数据

    await talentTree.initialize();
    await achievementStore.init();
    await reputationStore.init();
    await titleStore.init();
    await jianghuRankingStore.init();
    await sectContributionStore.init();

    return {
      version: '1.0.0',
      timestamp: Date.now(),
      player: JSON.parse(JSON.stringify(player)),
      currentLocationId: mapStore.currentLocationId,
      inventory: JSON.parse(JSON.stringify(eq.inventory)),
      equipped: JSON.parse(JSON.stringify(eq.equipped)),
      meditation: med.snapshot(),
      lost: { records: JSON.parse(JSON.stringify(eq.lostRecords)) },
      lifeSkills: lifeSkill.getSaveData(),
      materials: materials.getSaveData(),
      offline: this.buildOfflineSnapshot(),

      // 保存所有队列状态
      meditationQueue: {
        currentMeditation: meditationQueue.currentMeditation
          ? JSON.parse(JSON.stringify(meditationQueue.currentMeditation))
          : null,
      },
      gatherQueue: {
        currentGathering: gatherQueue.currentGathering
          ? JSON.parse(JSON.stringify(gatherQueue.currentGathering))
          : null,
      },
      smithingQueue: {
        currentSmithing: smithingQueue.currentSmithing
          ? JSON.parse(JSON.stringify(smithingQueue.currentSmithing))
          : null,
      },
      cookingQueue: {
        currentCooking: cookingQueue.currentCooking
          ? JSON.parse(JSON.stringify(cookingQueue.currentCooking))
          : null,
      },
      alchemyQueue: {
        currentAlchemy: alchemyQueue.currentAlchemy
          ? JSON.parse(JSON.stringify(alchemyQueue.currentAlchemy))
          : null,
      },
      combatStats: {
        wins: combat.combatStats.wins,
        losses: combat.combatStats.losses,
      },
      talentTree: talentTree.getSaveData(),
      achievements: achievementStore.getSaveData(),
      convoyState: convoyService.getSaveData(), // 保存押镖状态
      seclusion: seclusionStore.snapshot(), // 保存闭关状态
      combatAutomation: {
        running: !!unref(combatAuto.isRunning),
        currentEnemyId: unref(combatAuto.currentEnemy)?.id,
        wins: unref(combatAuto.wins),
        losses: unref(combatAuto.losses),
        waitingRemainingMs: unref(combatAuto.waitingRemainingMs),
      },
      reputation: reputationStore.getSaveData(), // 保存声望状态
      titles: titleStore.getSaveData(), // 保存称号状态
      jianghuRanking: jianghuRankingStore.getSaveData(), // 保存江湖榜状态
      sect: sectStore.getSaveData(), // 保存门派状态
      contribution: sectContributionStore.getSaveData(), // 保存门派贡献状态
    } as GameSnapshotV1;
  }

  /**
   * 构建离线状态快照
   */
  private buildOfflineSnapshot(): OfflineSnapshot {
    const gatherQueue = useGatherQueueStore();
    const meditationQueue = useMeditationQueueStore();
    const combatAuto = useCombatAutomationStore();
    const now = Date.now();

    // 1) 打坐活动优先
    if (meditationQueue.isMeditating && meditationQueue.currentMeditation) {
      const med = meditationQueue.currentMeditation;
      return {
        lastActiveTime: now,
        activeActivity: {
          type: 'meditation' as any,
          data: {
            startTime: med.startTime,
            bias: med.bias,
            pattern: med.pattern,
            cycleSeconds: med.cycleSeconds,
          },
        },
      };
    }

    // 2) 采集活动
    if (gatherQueue.isGathering && gatherQueue.currentGathering) {
      const gathering = gatherQueue.currentGathering;
      return {
        lastActiveTime: now,
        activeActivity: {
          type: 'gathering' as any,
          data: {
            resourceId: gathering.resourceId,
            skillType: gathering.skillType,
            startTime: gathering.startTime,
            duration: gathering.gatherTime,
          },
        },
      };
    }

    // 3) 自动战斗活动
    if (unref(combatAuto.isRunning) && unref(combatAuto.currentEnemy)) {
      const enemy = unref(combatAuto.currentEnemy)!;
      return {
        lastActiveTime: now,
        activeActivity: {
          type: 'combat' as any,
          data: {
            enemyId: enemy.id,
          },
        },
      };
    }

    // TODO: 检查其他活动（打坐、武学修炼等）

    // 没有活动
    return {
      lastActiveTime: now,
    };
  }

  // 版本兼容恢复
  private async applySnapshot(data: any): Promise<boolean> {
    console.log('[SaveManager] ★★★ APPLY SNAPSHOT START ★★★');
    console.log('[SaveManager] data keys:', data ? Object.keys(data) : 'null');
    // 🔧 BUG-005 修复：兼容没有 version 字段的旧存档
    if (!data) return false;

    // 旧存档没有 version 字段，尝试作为 V1 加载
    if (!data.version) {
      console.warn('[SaveManager] 检测到旧存档（无版本号），尝试兼容加载...');
      // 检查是否是有效的存档（至少有 player 数据）
      if (data.player) {
        // 添加版本号并尝试作为 V1 处理
        data.version = '1.0.0';
        return await this.applyV1(data as GameSnapshotV1);
      }
      return false;
    }

    switch (data.version) {
      case '1.0.0':
        return await this.applyV1(data as GameSnapshotV1);
      default:
        // 未来版本可在此做降级或迁移
        console.warn(`[SaveManager] 未知版本 ${data.version}，无法加载`);
        return false;
    }
  }

  private async applyV1(s: GameSnapshotV1): Promise<boolean> {
    try {
      const playerStore = usePlayerStore();
      const mapStore = useMapStore();
      const eq = useEquipmentStore();
      const med = useMeditationStore();
      const ach = useAchievementStore();
      await ach.init();
      const talentTreeStore = useTalentTreeStore();

      // 兼容旧存档：补齐新增属性字段
      const p = s.player as any;
      const ensureStats = () => {
        const base = calculateBaseStats(p.stats?.level || 1, DEFAULT_PLAYER_CONFIG);
        const st: any = p.stats || (p.stats = {});

        // 基础属性
        st.hp = typeof st.hp === 'number' ? st.hp : base.hp;
        st.maxHp = typeof st.maxHp === 'number' ? st.maxHp : base.maxHp;
        st.attack = typeof st.attack === 'number' ? st.attack : base.attack;
        st.defense = typeof st.defense === 'number' ? st.defense : base.defense;
        st.level = typeof st.level === 'number' ? st.level : 1;
        st.totalExp = typeof st.totalExp === 'number' ? st.totalExp : 0;
        st.currentExp = typeof st.currentExp === 'number' ? st.currentExp : 0;
        st.requiredExp = typeof st.requiredExp === 'number' ? st.requiredExp : 100;

        // 基础四维
        st.strength = typeof st.strength === 'number' ? st.strength : base.strength;
        st.agility = typeof st.agility === 'number' ? st.agility : base.agility;
        st.vitality = typeof st.vitality === 'number' ? st.vitality : base.vitality;
        st.spirit = typeof st.spirit === 'number' ? st.spirit : base.spirit;

        // 内力系统
        st.maxEnergy = typeof st.maxEnergy === 'number' ? st.maxEnergy : base.maxEnergy;
        st.energy = typeof st.energy === 'number' ? st.energy : base.maxEnergy;

        // 战斗属性
        st.accuracy = typeof st.accuracy === 'number' ? st.accuracy : base.accuracy;
        st.dodgeChance = typeof st.dodgeChance === 'number' ? st.dodgeChance : base.dodgeChance;
        st.critChance = typeof st.critChance === 'number' ? st.critChance : base.critChance;
        st.critMultiplier =
          typeof st.critMultiplier === 'number' ? st.critMultiplier : base.critMultiplier;
        st.blockChance = typeof st.blockChance === 'number' ? st.blockChance : base.blockChance;
        st.tenacity = typeof st.tenacity === 'number' ? st.tenacity : base.tenacity;
        st.armorPenetration =
          typeof st.armorPenetration === 'number' ? st.armorPenetration : base.armorPenetration;
        st.speed = typeof st.speed === 'number' ? st.speed : base.speed;

        // 武侠特色
        st.qinggongLevel =
          typeof st.qinggongLevel === 'number' ? st.qinggongLevel : base.qinggongLevel;
        st.neigongLevel = typeof st.neigongLevel === 'number' ? st.neigongLevel : base.neigongLevel;
        st.energyRegen = typeof st.energyRegen === 'number' ? st.energyRegen : base.energyRegen;

        // 其他属性
        st.luck = typeof st.luck === 'number' ? st.luck : base.luck;
      };
      ensureStats();

      // 🔧 修复旧存档：如果 requiredExp 为 0 但等级小于最大等级，重新计算
      // 这是因为旧版本最大等级是10，现在扩展到66级了
      const st: any = p.stats;
      if (st.requiredExp === 0 && st.level < 66) {
        st.requiredExp = getRequiredExpForNextLevel(st.level);
        console.log(
          `[SaveManager] 修复旧存档：Lv${st.level} 的 requiredExp 从 0 更新为 ${st.requiredExp}`
        );
      }

      // 兼容：补齐 avatar 字段（新增）
      if (!p.avatar || typeof p.avatar !== 'string') {
        p.avatar = 'ninja'; // 默认头像
      }

      // 兼容：补齐 martial 字段
      if (!p.martial) {
        p.martial = { learnedArtIds: [], learnedMoveIds: [], equipped: {}, proficiency: {} };
      } else {
        const m = p.martial as any;
        m.learnedArtIds = Array.isArray(m.learnedArtIds) ? m.learnedArtIds : [];
        m.learnedMoveIds = Array.isArray(m.learnedMoveIds) ? m.learnedMoveIds : [];
        m.equipped = m.equipped && typeof m.equipped === 'object' ? m.equipped : {};
        m.proficiency = m.proficiency && typeof m.proficiency === 'object' ? m.proficiency : {};
      }

      // 兼容：补齐体力/饱食度
      if (!p.stamina) p.stamina = { current: 100, max: 100 };
      if (!p.satiety) p.satiety = { current: 100, max: 100 };

      playerStore.player = p;
      if (s.currentLocationId) {
        mapStore.currentLocationId = s.currentLocationId as any;
      }
      if (s.inventory || s.equipped) {
        const inv = ((s.inventory as any[]) || []).map(it => ({ ...it }));
        const fixedEquipped: any = {};
        const srcEquipped = (s.equipped as any) || {};
        // 支持所有新旧装备槽位
        const slots = [
          'head',
          'weapon',
          'offhand',
          'armor',
          'belt',
          'gloves',
          'boots',
          'accessory1',
          'accessory2',
          'ring',
        ];
        for (const slot of slots) {
          const e = srcEquipped[slot];
          if (!e) continue;
          const match =
            inv.find(i => i.id === e.id) ||
            inv.find(i => i.blueprintId === e.blueprintId && i.name === e.name);
          if (match) fixedEquipped[slot] = match;
        }
        eq.setState(inv as any, fixedEquipped);
      }
      if (s.meditation) {
        med.restore(s.meditation);
      }
      if ((s as any).lost && Array.isArray((s as any).lost.records)) {
        try {
          useEquipmentStore().setLostRecords((s as any).lost.records);
        } catch (e) {
          console.warn('[SaveManager] Failed to restore lost records:', e);
        }
      }
      if (s.lifeSkills) {
        try {
          useLifeSkillStore().loadFromSave(s.lifeSkills);
        } catch (e) {
          console.warn('[SaveManager] 加载生活技能数据失败:', e);
        }
      }
      if (s.materials) {
        try {
          useMaterialsStore().loadFromSave(s.materials);
        } catch (e) {
          console.warn('[SaveManager] 加载材料数据失败:', e);
        }
      }

      // 恢复所有队列状态
      if (s.gatherQueue && s.gatherQueue.currentGathering) {
        try {
          const gatherQueueStore = useGatherQueueStore();
          gatherQueueStore.restoreGathering(s.gatherQueue.currentGathering as any);
          console.log('[SaveManager] 恢复采集队列成功');
        } catch (e) {
          console.warn('[SaveManager] 恢复采集队列失败:', e);
        }
      }

      // 恢复打坐队列
      if (s.meditationQueue && s.meditationQueue.currentMeditation) {
        try {
          const meditationQueueStore = useMeditationQueueStore();
          meditationQueueStore.restoreMeditation(s.meditationQueue.currentMeditation as any);
          console.log('[SaveManager] 恢复打坐队列成功');
        } catch (e) {
          console.warn('[SaveManager] 恢复打坐队列失败:', e);
        }
      }

      if (s.smithingQueue && s.smithingQueue.currentSmithing) {
        try {
          const smithingQueueStore = useSmithingQueueStore();
          const data = s.smithingQueue.currentSmithing;
          smithingQueueStore.startSmithing(data.recipeId, data.recipeName, data.craftTime);
          // 恢复循环次数和开始时间
          if (smithingQueueStore.currentSmithing) {
            smithingQueueStore.currentSmithing.currentCycle = data.currentCycle;
            smithingQueueStore.currentSmithing.startTime = data.startTime;
          }
          console.log('[SaveManager] 恢复铸造队列成功');
        } catch (e) {
          console.warn('[SaveManager] 恢复铸造队列失败:', e);
        }
      }

      if (s.cookingQueue && s.cookingQueue.currentCooking) {
        try {
          const cookingQueueStore = useCookingQueueStore();
          const data = s.cookingQueue.currentCooking;
          cookingQueueStore.startCooking(data.recipeId, data.recipeName, data.duration);
          // 恢复循环次数和开始时间
          if (cookingQueueStore.currentCooking) {
            cookingQueueStore.currentCooking.currentCycle = data.currentCycle;
            cookingQueueStore.currentCooking.startTime = data.startTime;
          }
          console.log('[SaveManager] 恢复烹饪队列成功');
        } catch (e) {
          console.warn('[SaveManager] 恢复烹饪队列失败:', e);
        }
      }

      // 恢复炼丹队列
      if (s.alchemyQueue && s.alchemyQueue.currentAlchemy) {
        try {
          const alchemyQueueStore = useAlchemyQueueStore();
          const data = s.alchemyQueue.currentAlchemy;
          alchemyQueueStore.restoreAlchemy({
            recipeId: data.recipeId,
            recipeName: data.recipeName,
            startTime: data.startTime,
            craftTime: data.craftTime,
            currentCycle: data.currentCycle,
          });
          console.log('[SaveManager] 恢复炼丹队列成功');
        } catch (e) {
          console.warn('[SaveManager] 恢复炼丹队列失败:', e);
        }
      }

      // 恢复战绩统计
      if (s.combatStats) {
        try {
          const combatStore = useCombatStore();
          combatStore.combatStats.wins = s.combatStats.wins || 0;
          combatStore.combatStats.losses = s.combatStats.losses || 0;
          console.log('[SaveManager] 恢复战绩统计成功:', s.combatStats);
        } catch (e) {
          console.warn('[SaveManager] 恢复战绩统计失败:', e);
        }
      }

      if ((s as any).talentTree) {
        try {
          await talentTreeStore.loadFromSave((s as any).talentTree);
        } catch (e) {
          console.warn('[SaveManager] 加载武学天赋数据失败:', e);
        }
      } else {
        await talentTreeStore.initialize();
      }

      if ((s as any).achievements) {
        try {
          ach.loadFromSave((s as any).achievements);
        } catch (e) {
          console.warn('[SaveManager] 加载成就数据失败:', e);
        }
      } else {
        ach.checkUnlocks();
      }

      // 恢复押镖状态
      if ((s as any).convoyState) {
        try {
          await convoyService.loadFromSave((s as any).convoyState);
          console.log('[SaveManager] 恢复押镖状态成功');
        } catch (e) {
          console.warn('[SaveManager] 恢复押镖状态失败:', e);
        }
      }

      // 恢复闭关修炼状态
      if ((s as any).seclusion) {
        try {
          const seclusionStore = useSeclusionStore();
          seclusionStore.restore((s as any).seclusion);
          console.log('[SaveManager] 恢复闭关状态成功');

          // 如果闭关仍在进行中，重新启动 AutoRunner
          if (seclusionStore.isActive) {
            const { seclusionService } = await import('@/services/SeclusionService');
            seclusionService.startRunner();
            console.log('[SaveManager] 已重启闭关 AutoRunner');
          }
        } catch (e) {
          console.warn('[SaveManager] 恢复闭关状态失败:', e);
        }
      }

      // 恢复自动战斗（刷怪）状态
      if ((s as any).combatAutomation && (s as any).combatAutomation.running) {
        const id = (s as any).combatAutomation.currentEnemyId as string | undefined;
        if (id) {
          try {
            const enemy = await getEnemy(id);
            if (enemy) {
              const auto = useCombatAutomationStore();
              auto.start(enemy as any);
              console.log('[SaveManager] 恢复自动战斗: ', enemy.name);
            }
          } catch (e) {
            console.warn('[SaveManager] 恢复自动战斗失败:', e);
          }
        }
      }

      // 恢复声望状态
      if ((s as any).reputation) {
        try {
          const reputationStore = useReputationStore();
          await reputationStore.init();
          reputationStore.restoreFromSave((s as any).reputation);
          console.log('[SaveManager] 恢复声望状态成功');
        } catch (e) {
          console.warn('[SaveManager] 恢复声望状态失败:', e);
        }
      }

      // 恢复称号状态
      if ((s as any).titles) {
        try {
          const titleStore = useTitleStore();
          await titleStore.init();
          titleStore.restoreFromSave((s as any).titles);
          console.log('[SaveManager] 恢复称号状态成功');
        } catch (e) {
          console.warn('[SaveManager] 恢复称号状态失败:', e);
        }
      }

      // 恢复江湖榜状态
      if ((s as any).jianghuRanking) {
        try {
          const jianghuRankingStore = useJianghuRankingStore();
          await jianghuRankingStore.init();
          jianghuRankingStore.loadFromSave((s as any).jianghuRanking);
          console.log('[SaveManager] 恢复江湖榜状态成功');
        } catch (e) {
          console.warn('[SaveManager] 恢复江湖榜状态失败:', e);
        }
      }

      // 恢复门派状态
      console.log('[SaveManager] checking sect restore, sect data:', (s as any).sect);
      if ((s as any).sect || (s as any).contribution || (s as any).reputation?.sectReputations) {
        try {
          const sectStore = useSectStore();
          console.log('[SaveManager] calling sectStore.restoreFromSave');
          sectStore.restoreFromSave(
            mergeLegacySectData((s as any).sect, (s as any).contribution, (s as any).reputation)
          );
          console.log('[SaveManager] sectStore restored, sectType:', sectStore.sectType);
        } catch (e) {
          console.warn('[SaveManager] 恢复门派状态失败:', e);
        }
      }

      // 恢复门派贡献状态
      if ((s as any).contribution) {
        try {
          const sectContributionStore = useSectContributionStore();
          await sectContributionStore.init();
          sectContributionStore.restoreFromSave((s as any).contribution);
          console.log('[SaveManager] 恢复门派贡献状态成功');
        } catch (e) {
          console.warn('[SaveManager] 恢复门派贡献状态失败:', e);
        }
      }

      return true;
    } catch (error) {
      console.error('[SaveManager] 恢复存档失败:', error);
      return false;
    }
  }
}
