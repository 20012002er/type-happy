import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { TalentNode } from '@/types/martial';
import { TalentTreeConfigService } from '@/services/config/MartialConfigServices';
import { usePlayerStore } from '@/stores/playerStore';
import { useGameLogStore } from '@/stores/gameLogStore';
import { martialService } from '@/services/martialService';

interface StatEffectMap {
  attack?: number;
  defense?: number;
  maxHp?: number;
  maxEnergy?: number;
  critChance?: number;
  critMultiplier?: number;
}

const appliedNodes = new Set<string>();
let suppressAutoEffects = false;

export const useTalentTreeStore = defineStore('talentTree', () => {
  const playerStore = usePlayerStore();
  const gameLogStore = useGameLogStore();

  const nodes = ref<Record<string, TalentNode>>({});
  const connections = ref<Array<[string, string]>>([]);
  const unlockedNodes = ref<string[]>([]);
  const availableInsight = ref(0);
  const initialized = ref(false);

  async function initialize(): Promise<void> {
    if (initialized.value) return;

    const tree = await TalentTreeConfigService.getTree();
    if (!tree) {
      console.warn('[TalentTreeStore] 未找到天赋树配置');
      initialized.value = true;
      return;
    }

    nodes.value = tree.nodes;
    connections.value = await TalentTreeConfigService.getConnections();
    availableInsight.value = tree.startingPoints ?? 3;

    // 自动解锁的节点（通常是根节点）
    const autoNodes = Object.values(tree.nodes).filter(node => node.autoUnlock);
    unlockedNodes.value = autoNodes.map(node => node.id);
    if (suppressAutoEffects) {
      autoNodes.forEach(node => appliedNodes.add(node.id));
    } else {
      await Promise.all(autoNodes.map(node => applyNodeEffect(node)));
    }
    suppressAutoEffects = false;
    initialized.value = true;
  }

  function isUnlocked(nodeId: string): boolean {
    return unlockedNodes.value.includes(nodeId);
  }

  function getNode(nodeId: string): TalentNode | undefined {
    return nodes.value[nodeId];
  }

  function getInsightCost(node: TalentNode): number {
    if (node.cost?.insight !== undefined) return node.cost.insight;
    return node.type === 'root' ? 0 : 1;
  }

  function hasPrerequisites(node: TalentNode): boolean {
    const prereqs = node.prerequisites ?? [];
    if (prereqs.length === 0) return true;
    return prereqs.every(id => isUnlocked(id));
  }

  function canUnlock(nodeId: string): boolean {
    const node = getNode(nodeId);
    if (!node) return false;
    if (isUnlocked(nodeId)) return false;
    if (!hasPrerequisites(node)) return false;
    const cost = getInsightCost(node);
    return availableInsight.value >= cost;
  }

  function applyStatEffect(effect: StatEffectMap): void {
    const current = playerStore.player.stats;
    const updates: Partial<typeof current> = {};
    let shouldUpdateHp = false;

    if (effect.attack) updates.attack = current.attack + effect.attack;
    if (effect.defense) updates.defense = current.defense + effect.defense;
    if (effect.maxHp) {
      updates.maxHp = current.maxHp + effect.maxHp;
      shouldUpdateHp = true;
    }
    if (effect.maxEnergy) {
      updates.maxEnergy = current.maxEnergy + effect.maxEnergy;
      updates.energy = current.energy + effect.maxEnergy;
    }
    if (effect.critChance) updates.critChance = (current.critChance || 0) + effect.critChance;
    if (effect.critMultiplier) {
      const base = current.critMultiplier ?? 1.5;
      updates.critMultiplier = base + effect.critMultiplier;
    }

    if (Object.keys(updates).length > 0) {
      if (shouldUpdateHp) {
        const newMax = updates.maxHp ?? current.maxHp;
        updates.hp = newMax;
      }
      playerStore.updateStats(updates);
    }
  }

  async function applyNodeEffect(node: TalentNode): Promise<void> {
    if (!node.effect) return;
    if (appliedNodes.has(node.id)) return;
    appliedNodes.add(node.id);

    if (node.effect.stats) {
      applyStatEffect(node.effect.stats);
      const bonuses = Object.entries(node.effect.stats)
        .map(([key, value]) => `${key}+${value}`)
        .join('、');
      gameLogStore.addInfoLog(`天赋【${node.name}】激活：${bonuses}`);
    }

    if (node.effect.moveId) {
      const move = await martialService.unlockMove(playerStore.player, node.effect.moveId);
      if (move) {
        gameLogStore.addRewardLog(`你通过天赋【${node.name}】悟得招式：${move.name}`);
      }
    } else if (node.effect.move) {
      const move = await martialService.unlockMove(playerStore.player, node.effect.move.id);
      if (move) {
        gameLogStore.addRewardLog(`你通过天赋【${node.name}】悟得招式：${move.name}`);
      }
    }
  }

  async function unlockNode(nodeId: string): Promise<boolean> {
    await initialize();
    const node = getNode(nodeId);
    if (!node) return false;
    if (!canUnlock(nodeId)) return false;

    const cost = getInsightCost(node);
    if (cost > 0) {
      availableInsight.value -= cost;
    }

    unlockedNodes.value = [...unlockedNodes.value, nodeId];
    gameLogStore.addInfoLog(`点亮天赋【${node.name}】`);
    await applyNodeEffect(node);
    return true;
  }

  function grantInsight(points: number): void {
    availableInsight.value += points;
  }

  const allNodes = computed(() => Object.values(nodes.value));
  const connectionList = computed(() => connections.value);

  function getSaveData() {
    return {
      unlockedNodes: [...unlockedNodes.value],
      availableInsight: availableInsight.value
    };
  }

  async function loadFromSave(data?: { unlockedNodes?: string[]; availableInsight?: number }) {
    suppressAutoEffects = true;
    await initialize();
    if (!data) return;

    if (typeof data.availableInsight === 'number') {
      availableInsight.value = data.availableInsight;
    }

    const merged = new Set<string>(unlockedNodes.value);
    (data.unlockedNodes || []).forEach(id => merged.add(id));
    unlockedNodes.value = Array.from(merged);

    unlockedNodes.value.forEach(id => appliedNodes.add(id));
  }

  return {
    nodes,
    connections: connectionList,
    availableInsight,
    unlockedNodes,
    initialize,
    getNode,
    allNodes,
    canUnlock,
    isUnlocked,
    unlockNode,
    grantInsight,
    getSaveData,
    loadFromSave
  };
});

