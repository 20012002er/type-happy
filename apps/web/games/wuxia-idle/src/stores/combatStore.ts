import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { Player } from '@/types/player';
import type { Enemy } from '@/types/enemy';
import { combatService } from '@/services/combatService';
import { useGameLogStore } from '@/stores/gameLogStore';
import { pickEnemyId } from '@/services/config/MonsterGroupService';
import { getEnemy } from '@/services/config/EnemyConfigService';
import { useMapStore } from '@/stores/mapStore';
import { usePlayerStore } from '@/stores/playerStore';
import { calculateLevelExp } from '@/utils/calculations';
import { getRequiredExpForNextLevel, getCurrentLevelExp } from '@/config/levelExpConfig';
import { dropService } from '@/services/loot/DropService';
import { useEquipmentStore } from '@/stores/equipmentStore';
import { useSectStore } from '@/stores/sectStore';

export const useCombatStore = defineStore('combat', () => {
  const inCombat = ref(false);
  const currentEnemy = ref<Enemy | null>(null);
  
  // 战绩统计
  const combatStats = ref({
    wins: 0,
    losses: 0
  });

  const startCombat = async (player: Player, enemy: Enemy) => {
    if (inCombat.value) return;
    const logs = useGameLogStore();
    const playerStore = usePlayerStore();
    inCombat.value = true;
    currentEnemy.value = enemy;
    logs.addCombatLog(`遭遇【${enemy.name}】！`, { enemy });

    // 🆕 读取战斗设置（技能槽配置）
    let activeSkills: string[] = [];
    try {
      const savedSettings = localStorage.getItem('wuxia_combat_settings');
      if (savedSettings) {
        const settings = JSON.parse(savedSettings);
        activeSkills = settings.activeSkills || [];
      }
    } catch (error) {
      console.error('[CombatStore] 读取战斗设置失败:', error);
    }

    const result = await combatService.start(
      player,
      enemy,
      300,
      (round) => logs.addCombatLog(round.message, {
        skillId: round.skillId,
        skillEmoji: round.skillEmoji,
        attacker: round.attacker,
        defender: round.defender,
        damage: round.damage
      }),
      (playerHp, enemyHp, playerEnergy) => {
        // 实时刷新玩家生命
        playerStore.updateStats({ hp: playerHp, energy: typeof playerEnergy === 'number' ? playerEnergy : playerStore.player.stats.energy });
        // 实时刷新敌人生命
        if (currentEnemy.value) {
          currentEnemy.value.stats.hp = enemyHp;
        }
      },
      {
        playerCritChance: player.stats.critChance ?? 0.1,
        playerCritMultiplier: player.stats.critMultiplier ?? 1.5,
        playerDodgeChance: player.stats.dodgeChance ?? 0.05,
        skillUseChance: 0.5,
        activeSkills // 🆕 技能槽配置
        // 敌人相关保持默认，未来可从敌人配置扩展
      }
    );

    if (result.winner === 'player') {
      logs.addCombatLog('战斗胜利！');
      // 更新战绩：胜利+1
      combatStats.value.wins++;
      const sectStore = useSectStore();
      if (sectStore.sectType && sectStore.canClaimVictoryReward(sectStore.sectType)) {
        sectStore.addSectContribution(sectStore.sectType, 10);
        sectStore.markVictoryRewardClaimed(sectStore.sectType);
        logs.addRewardLog(`门派首胜奖励：${sectStore.currentSect?.name || '当前门派'}贡献 +10`);
      }
      // 胜利奖励：根据地点 idle 配置发放
      const map = useMapStore();
      const loc = map.getCurrentLocationSnapshot();
      if (loc && loc.idle) {
        const baseExpPerSec = loc.idle.baseExpPerSec || 0;
        const baseGoldPerSec = loc.idle.baseGoldPerSec || 0;
        const seconds = loc.idle.victorySeconds ?? Math.max(8, Math.floor(10 * (loc.idle.difficulty || 1))); // 配置优先，退化为难度系数
        const expGain = Math.max(1, Math.floor(baseExpPerSec * seconds));
        const goldGain = Math.max(0, Math.floor(baseGoldPerSec * seconds));
        const levelUpResult = playerStore.gainExperience(expGain);
        playerStore.updateResources({ gold: playerStore.player.resources.gold + goldGain });
        logs.addRewardLog(`获得经验+${expGain}、金币+${goldGain}`);
        if (levelUpResult) {
          logs.addLevelUpLog(`等级提升到${levelUpResult.newLevel}级！`);
        }
        // 装备掉落：从蓝图池（示例直接用固定池）生成（可将池与地点关联扩展）
        const eqStore = useEquipmentStore();
        const blueprintPool = loc.idle.blueprintPool || [
          'qinggang_jian','hanfeng_jian','tieji_jian',
          'yunwen_pao','mianjia','huxin_jia',
          'mu_jiezhi','yinyue_jiezhi',
          'bu_xie','fengxing_xue'
        ];
        const mapLevel = loc.requirements?.minLevel || 1;
        const item = await dropService.rollEquipment(blueprintPool, mapLevel);
        if (item) {
          eqStore.inventory.push(item);
          logs.addRewardLog(
            `获得 ${item.name}${item.affixes && item.affixes.length > 0 ? '（' + item.affixes.join('、') + '）' : ''}`,
            { item }
          );
        }
      }
      // 小概率掉落武学（从敌人配置读取）
      if ((enemy as any).martialArtDrop && Math.random() < ((enemy as any).martialArtDrop.chance || 0)) {
        const pool: string[] = (enemy as any).martialArtDrop.pool || [];
        if (pool.length > 0) {
          const artId = pool[Math.floor(Math.random() * pool.length)];
          const gained = await (await import('@/services/martialService')).martialService.learnArt(playerStore.player, artId);
          if (gained.length > 0) {
            logs.addRewardLog(`你从【${enemy.name}】残篇中领悟了《${artId}》的要义`);
          } else {
            logs.addInfoLog(`你获得了《${artId}》残篇，但暂未领悟新招。`);
          }
        }
      }
    } else {
      logs.addCombatLog('你被击败了……');
      // 更新战绩：失败+1
      combatStats.value.losses++;
      // 惩罚：经验池扣减（不降级），金币掉落
      const playerStore = usePlayerStore();
      const level = playerStore.player.stats.level;
      const totalExp = playerStore.player.stats.totalExp;
      const thresholdForLevel = calculateLevelExp(level); // 当前等级累计阈值
      const required = getRequiredExpForNextLevel(level);
      const penalty = Math.floor(required * 0.1); // 扣当前等级经验条10%
      const newTotal = Math.max(thresholdForLevel, totalExp - penalty);
      playerStore.updateStats({ totalExp: newTotal });
      // 同步当前等级进度
      const current = getCurrentLevelExp(level, newTotal);
      playerStore.updateStats({ currentExp: current });
      // 随机掉金币（10%~30% 当前持有金币）
      const goldOwned = playerStore.player.resources.gold;
      const goldPenalty = Math.floor(goldOwned * (0.1 + Math.random() * 0.2));
      playerStore.updateResources({ gold: Math.max(0, goldOwned - goldPenalty) });
      logs.addRewardLog(`因战败损失经验${penalty}（不降级）、金币${goldPenalty}`);
      // 立即复活为1点生命
      playerStore.updateStats({ hp: 1 });
      logs.addSystemLog('你在原地醒来，奄奄一息（生命恢复至1）');
    }

    inCombat.value = false;
    currentEnemy.value = null;
    return result;
  };

  // 基于当前地图与怪物组的动态遭遇
  const encounter = async (player: Player) => {
    const map = useMapStore();
    const logs = useGameLogStore();
    const loc = map.getCurrentLocationSnapshot();
    if (!loc) return null;
    // 先判定是否触发地点事件
    const world = map.mapData;
    if (loc.idle?.eventChance && Math.random() < loc.idle.eventChance) {
      const eventId = loc.idle.eventList && loc.idle.eventList.length > 0 ?
        loc.idle.eventList[Math.floor(Math.random() * loc.idle.eventList.length)] : undefined;
      const eventCfg = world?.eventsById && eventId ? world.eventsById[eventId] : undefined;
      if (eventCfg) {
        logs.addInfoLog(`触发事件【${eventId}】`);
        if (eventCfg.type === 'quest') {
          const expGain = Math.floor((eventCfg.rewardExp || 0));
          const goldGain = Math.floor((eventCfg.rewardGold || 0));
          const playerStore = usePlayerStore();
          const levelUpResult = playerStore.gainExperience(expGain);
          playerStore.updateResources({ gold: playerStore.player.resources.gold + goldGain });
          logs.addRewardLog(`事件奖励：经验+${expGain}、金币+${goldGain}`);
          if (levelUpResult) logs.addLevelUpLog(`等级提升到${levelUpResult.newLevel}级！`);
          return { success: true, event: eventId } as any;
        }
        if (eventCfg.type === 'shop') {
          logs.addInfoLog('你遇到一位行商，出售各类物品（商店系统预留）');
          return { success: true, event: eventId } as any;
        }
        if (eventCfg.type === 'grantMartial') {
          // 事件授予武学（小概率，可由地图配置权重控制）
          const pool: string[] = eventCfg.pool || [];
          const artId = pool.length > 0 ? pool[Math.floor(Math.random() * pool.length)] : undefined;
          if (artId) {
            const gained = await (await import('@/services/martialService')).martialService.learnArt(usePlayerStore().player, artId);
            if (gained.length > 0) {
              logs.addRewardLog(`你在江湖奇遇中领悟了《${artId}》的要义`);
            } else {
              logs.addInfoLog(`你获得了《${artId}》线索，但暂未领悟新招。`);
            }
          }
          return { success: true, event: eventId } as any;
        }
        if (eventCfg.type === 'battle' && eventCfg.monsterGroup) {
          // 替换怪物组为事件指定
          const picked = await pickEnemyId(eventCfg.monsterGroup);
          if (picked) {
            const enemy = await getEnemy(picked.enemyId);
            if (!enemy) return null;
            logs.addCombatLog(
              `事件引发战斗！${picked.tier === 'elite' ? '精英' : picked.tier === 'boss' ? 'BOSS' : '普通'}【${enemy.name}】出现！`,
              { enemy }
            );
            return startCombat(player, enemy);
          }
        }
      }
    }

    const mg = loc.idle?.monsterGroup;
    if (!mg) return null;
    const picked = await pickEnemyId(mg);
    if (!picked) return null;
    // 优先用配置文件中的敌人；无则退回 TS 常量
    const base = await getEnemy(picked.enemyId);
    const mod = picked.modifier;
    const enemy = base && mod ? {
      ...base,
      name: `${picked.tier === 'elite' ? '【精英】' : picked.tier === 'boss' ? '【BOSS】' : ''}${base.name}`,
      stats: {
        ...base.stats,
        attack: (() => {
          const baseAttack = base.attackBase ?? base.stats.attack;
          const levelGrowth = base.levelAttackGrowth ?? 0.0;
          const levelFactor = 1 + levelGrowth * (base.stats.level - 1);
          const tierAttack = baseAttack * levelFactor * mod.attack;
          // 5% 随机波动
          const variance = 0.95 + Math.random() * 0.1;
          return Math.max(1, Math.floor(tierAttack * variance));
        })(),
        defense: Math.max(0, Math.floor(base.stats.defense * mod.defense)),
        maxHp: Math.max(1, Math.floor(base.stats.maxHp * mod.hp)),
        hp: Math.max(1, Math.floor(base.stats.maxHp * mod.hp))
      }
    } as typeof base : base;
    if (!enemy) return null;
    (enemy as any).tier = picked.tier;
    logs.addInfoLog(
      `你遭遇了${picked.tier === 'elite' ? '精英' : picked.tier === 'boss' ? 'BOSS' : '普通'}【${enemy.name}】！`,
      { enemy }
    );
    return startCombat(player, enemy);
  };

  return {
    inCombat,
    currentEnemy,
    combatStats,
    startCombat,
    encounter
  };
});

