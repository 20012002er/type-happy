<template>
  <DraggableModal
    :visible="showDebug"
    title="调试面板"
    :width="350"
    :height="500"
    :x="debugPanelX"
    :y="debugPanelY"
    :minimizable="true"
    :closable="true"
    :resizable="true"
    :min-width="300"
    :max-width="500"
    :min-height="400"
    :show-backdrop="false"
    @update:visible="showDebug = $event"
    @move="updateDebugPosition"
  >
    <template #controls>
      <button class="debug-control-btn" @click="toggleDebug">隐藏</button>
    </template>

    <div class="debug-content">
      <div class="debug-section">
        <h5>玩家状态</h5>
        <div class="debug-grid">
          <div>等级: {{ player.stats.level }}</div>
          <div>经验: {{ player.stats.currentExp }}/{{ player.stats.requiredExp }}</div>
          <div>生命值: {{ player.stats.hp }}/{{ player.stats.maxHp }}</div>
          <div>攻击力: {{ player.stats.attack }}</div>
          <div>防御力: {{ player.stats.defense }}</div>
          <div>金币: {{ player.resources.gold }}</div>
          <div>声望: {{ player.resources.reputation }}</div>
          <div>体力: {{ stamina.current }}/{{ stamina.max }}</div>
          <div>饱食度: {{ satiety.current }}/{{ satiety.max }}</div>
          <div>状态: {{ player.state }}</div>
        </div>
      </div>
      
      <div class="debug-section">
        <h5>快速测试</h5>
        <div class="debug-buttons">
          <button class="debug-btn" @click="addExp">+100 经验</button>
          <button class="debug-btn" @click="addGold">+50 金币</button>
          <button class="debug-btn" @click="takeDamage">受到10伤害</button>
          <button class="debug-btn" @click="fullHeal">完全恢复</button>
          <button class="debug-btn" @click="levelUp">强制升级</button>
          <button class="debug-btn" @click="resetPlayer">重置玩家</button>
          <button class="debug-btn" @click="simulateDrop">模拟装备掉落</button>
        </div>
      </div>

      <div class="debug-section">
        <h5>体力 / 饱食度 调整</h5>
        <div class="debug-buttons">
          <button class="debug-btn" @click="staminaAdd(10)">体力 +10</button>
          <button class="debug-btn" @click="staminaAdd(-10)">体力 -10</button>
          <button class="debug-btn" @click="satietyAdd(10)">饱食度 +10</button>
          <button class="debug-btn" @click="satietyAdd(-10)">饱食度 -10</button>
          <button class="debug-btn" @click="staminaFull">体力回满</button>
          <button class="debug-btn" @click="satietyFull">饱食度回满</button>
        </div>
      </div>

      <div class="debug-section">
        <h5>素材发放（洗炼）</h5>
        <div class="debug-buttons">
          <button class="debug-btn" @click="grantMaterial('cold_water','寒水')">+ 寒水 ×1</button>
          <button class="debug-btn" @click="grantMaterial('black_charcoal','乌炭')">+ 乌炭 ×1</button>
        </div>
      </div>

      <div class="debug-section">
        <h5>回复品发放（战斗测试）</h5>
        <div class="debug-buttons">
          <button class="debug-btn debug-btn-heal" @click="grantConsumableBatch('pill_healing_basic','金疮药',20)">
            <FlaskConical class="btn-icon" /> 金疮药 ×20<br><small>(+50HP)</small>
          </button>
          <button class="debug-btn debug-btn-heal" @click="grantConsumableBatch('pill_healing_medium','回血丹',20)">
            <FlaskConical class="btn-icon" /> 回血丹 ×20<br><small>(+120HP)</small>
          </button>
          <button class="debug-btn debug-btn-heal" @click="grantConsumableBatch('herb_soup_item','草药汤',50)">
            <Coffee class="btn-icon" /> 草药汤 ×50<br><small>(+50HP)</small>
          </button>
          <button class="debug-btn debug-btn-heal" @click="grantConsumableBatch('grilled_fish_item','烤鱼',30)">
            <Fish class="btn-icon" /> 烤鱼 ×30<br><small>(+30HP +20体力)</small>
          </button>
          <button class="debug-btn debug-btn-heal" @click="grantConsumableBatch('pill_healing_advanced','大还丹',10)">
            <FlaskConical class="btn-icon" /> 大还丹 ×10<br><small>(+250HP)</small>
          </button>
          <button class="debug-btn debug-btn-special" @click="grantAllHealingItems">
            <Sparkle class="btn-icon" /> 全部回复品各×50
          </button>
        </div>
      </div>
      
      <div class="debug-section">
        <h5>其他消耗品</h5>
        <div class="debug-buttons">
          <button class="debug-btn" @click="grantConsumable('potion_small','小还丹')">+ 小还丹 ×1</button>
          <button class="debug-btn" @click="grantConsumable('egg_soup','鸡蛋汤')">+ 鸡蛋汤 ×1</button>
        </div>
      </div>
      
      <div class="debug-section">
        <h5>计算测试</h5>
        <div class="debug-info">
          <div>下级经验: {{ calculateNextLevelExp(player.stats.level) }}</div>
          <div>经验进度: {{ Math.round(playerStore.expProgress) }}%</div>
          <div>生命进度: {{ Math.round(playerStore.hpProgress) }}%</div>
          <div>是否忙碌: {{ playerStore.isBusy ? '是' : '否' }}</div>
          <div>是否死亡: {{ playerStore.isDead ? '是' : '否' }}</div>
        </div>
      </div>
      
      
    </div>
  </DraggableModal>
  
  <button v-if="!showDebug" class="debug-show-btn" @click="toggleDebug">
    调试
  </button>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { FlaskConical, Fish, Coffee, Sparkle, Gift } from 'lucide-vue-next';
import { usePlayerStore } from '@/stores/playerStore';
import { useGameLogStore } from '@/stores/gameLogStore';
import { calculateNextLevelExp } from '@/utils/calculations';
import DraggableModal from './DraggableModal.vue';
import { useEquipmentStore } from '@/stores/equipmentStore';
import { equipmentFactory } from '@/services/loot/EquipmentFactory';
import { useMaterialsStore } from '@/stores/materialsStore';

const playerStore = usePlayerStore();
const gameLogStore = useGameLogStore();
const equipmentStore = useEquipmentStore();
const materialsStore = useMaterialsStore();
const player = computed(() => playerStore.player);

const stamina = computed(() => (playerStore as any).stamina?.value || { current: 0, max: 0 });
const satiety = computed(() => (playerStore as any).satiety?.value || { current: 0, max: 0 });

const showDebug = ref(false);
 
const debugPanelX = ref(window.innerWidth - 370);
const debugPanelY = ref(10);

const toggleDebug = () => { showDebug.value = !showDebug.value; };
const updateDebugPosition = (position: { x: number; y: number }) => {
  debugPanelX.value = position.x;
  debugPanelY.value = position.y;
};

const addExp = () => { gameLogStore.addSystemLog('[调试] 添加100点经验'); playerStore.gainExperience(100); };
const addGold = () => { gameLogStore.addSystemLog('[调试] 添加50金币'); playerStore.updateResources({ gold: player.value.resources.gold + 50 }); };
const takeDamage = () => { gameLogStore.addSystemLog('[调试] 造成10点伤害'); playerStore.updateStats({ hp: Math.max(1, player.value.stats.hp - 10) }); };
const fullHeal = () => { gameLogStore.addSystemLog('[调试] 完全恢复生命值'); playerStore.updateStats({ hp: player.value.stats.maxHp }); };
const levelUp = () => { gameLogStore.addSystemLog('[调试] 强制升级'); const requiredExp = calculateNextLevelExp(player.value.stats.level); playerStore.gainExperience(requiredExp); };
const resetPlayer = () => { gameLogStore.addSystemLog('[调试] 重置玩家数据'); playerStore.initializePlayer('测试侠客'); };
const simulateDrop = async () => {
  gameLogStore.addSystemLog('[调试] 模拟装备掉落');
  const item = await equipmentFactory.createFromBlueprint('qinggang_jian', player.value.stats.level);
  if (item) { equipmentStore.inventory.push(item); gameLogStore.addRewardLog(`获得 ${item.name}${item.affixes && item.affixes.length ? '（' + item.affixes.join('、') + '）' : ''}`); }
};

const staminaAdd = (delta: number) => { const p: any = player.value as any; p.stamina.current = Math.max(0, Math.min(p.stamina.max, (p.stamina.current || 0) + delta)); };
const satietyAdd = (delta: number) => { const p: any = player.value as any; p.satiety.current = Math.max(0, Math.min(p.satiety.max, (p.satiety.current || 0) + delta)); };
const staminaFull = () => { const p: any = player.value as any; p.stamina.current = p.stamina.max; };
const satietyFull = () => { const p: any = player.value as any; p.satiety.current = p.satiety.max; };

const grantMaterial = (id: string, name: string) => {
  materialsStore.add(id, 1, name);
  gameLogStore.addRewardLog(`[调试] 获得 ${name} ×1`);
};

// 简单将消耗品作为"材料仓库"托管（占位：未来可做专用背包/数量管理）
const grantConsumable = (id: string, name: string) => {
  // 这里临时复用材料仓库存放数量，真实项目可引入"物品背包"并扩展 Item 实例
  materialsStore.add(id, 1, name);
  gameLogStore.addRewardLog(`[调试] 获得 ${name} ×1`);
};

// 批量发放消耗品
const grantConsumableBatch = (id: string, name: string, quantity: number) => {
  materialsStore.add(id, quantity, name);
  gameLogStore.addRewardLog(`[调试] 获得 ${name} ×${quantity}`);
};

// 一键发放所有回复品（用于战斗测试）
const grantAllHealingItems = () => {
  const healingItems = [
    { id: 'pill_healing_basic', name: '金疮药', qty: 50 },
    { id: 'pill_healing_medium', name: '回血丹', qty: 50 },
    { id: 'pill_healing_advanced', name: '大还丹', qty: 50 },
    { id: 'pill_healing_master', name: '九转回魂丹', qty: 50 },
    { id: 'herb_soup_item', name: '草药汤', qty: 50 },
    { id: 'grilled_fish_item', name: '烤鱼', qty: 50 },
  ];
  
  healingItems.forEach(item => {
    materialsStore.add(item.id, item.qty, item.name);
  });
  
  gameLogStore.addRewardLog(`[调试] ✨ 一键获得所有回复品各×50`);
};

const handleKeyDown = (event: KeyboardEvent) => {
  if (import.meta.env.DEV) {
    if (event.key === 'F12' || (event.ctrlKey && event.key === 'd')) {
      event.preventDefault();
      toggleDebug();
    }
  }
};

onMounted(() => { if (import.meta.env.DEV) document.addEventListener('keydown', handleKeyDown); });

onUnmounted(() => { if (import.meta.env.DEV) document.removeEventListener('keydown', handleKeyDown); });
</script>

<style scoped>
.debug-show-btn {
  position: fixed;
  bottom: 10px;
  right: 10px;
  background: var(--color-bg-secondary);
  border: var(--border-width-thin) solid var(--color-border-medium);
  padding: var(--spacing-xs) var(--spacing-sm);
  cursor: pointer;
  z-index: 1000;
  font-size: var(--font-size-xs);
  transition: all 0.2s ease;
}

.debug-show-btn:hover {
  background: var(--color-bg-hover);
}

.debug-control-btn {
  background: var(--color-bg-primary);
  border: var(--border-width-thin) solid var(--color-border-medium);
  padding: var(--spacing-xs);
  cursor: pointer;
  font-size: var(--font-size-xs);
  transition: all 0.2s ease;
}

.debug-control-btn:hover {
  background: var(--color-bg-hover);
}

.debug-content {
  font-size: var(--font-size-xs);
  height: 100%;
  overflow-y: auto;
}

.debug-section {
  margin-bottom: var(--spacing-md);
}

.debug-section h5 {
  margin: 0 0 var(--spacing-sm) 0;
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  border-bottom: var(--border-width-thin) solid var(--color-border-light);
  padding-bottom: var(--spacing-xs);
}

.debug-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--spacing-xs);
  font-family: var(--font-family-mono);
  font-size: var(--font-size-xs);
}

.debug-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-xs);
}

.debug-btn {
  background: var(--color-bg-secondary);
  border: var(--border-width-thin) solid var(--color-border-medium);
  padding: var(--spacing-xs);
  cursor: pointer;
  font-size: var(--font-size-xs);
  flex: 1;
  min-width: 80px;
  transition: all 0.2s ease;
}

.debug-btn:hover {
  background: var(--color-bg-hover);
}

.debug-btn-heal {
  background: linear-gradient(135deg, #fff5f5 0%, #ffe5e5 100%);
  border-color: #ffcccb;
  color: #d32f2f;
  font-weight: 500;
  min-height: 50px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  line-height: 1.3;
}

.debug-btn-heal:hover {
  background: linear-gradient(135deg, #ffeded 0%, #ffd5d5 100%);
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(211, 47, 47, 0.2);
}

.debug-btn-heal small {
  font-size: 10px;
  opacity: 0.8;
  margin-top: 2px;
}

.debug-btn-special {
  background: linear-gradient(135deg, #fff9e6 0%, #ffe9b3 100%);
  border-color: #ffd966;
  color: #e65100;
  font-weight: 600;
  min-height: 50px;
}

.debug-btn-special:hover {
  background: linear-gradient(135deg, #fff5d9 0%, #ffdf99 100%);
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(230, 81, 0, 0.2);
}

.debug-info {
  font-family: var(--font-family-mono);
  font-size: var(--font-size-xs);
  line-height: 1.4;
}

.debug-info div {
  margin: var(--spacing-xs) 0;
  padding: var(--spacing-xs);
  background: var(--color-bg-secondary);
}

 

/* 移动端适配 */
@media (max-width: 768px) {
  .debug-grid {
    grid-template-columns: 1fr;
  }
  
  .debug-buttons {
    flex-direction: column;
  }
  
  .debug-btn {
    min-width: auto;
  }
}

.btn-icon {
  width: 14px;
  height: 14px;
  vertical-align: middle;
  margin-right: 4px;
}
</style>
