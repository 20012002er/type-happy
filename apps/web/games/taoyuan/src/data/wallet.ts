import type { WalletItemDef } from '@/types'

/** 钱袋物品定义 */
export const WALLET_ITEMS: WalletItemDef[] = [
  {
    id: 'merchant_seal',
    name: '商人印章',
    description: '商店购物价格降低10%。',
    effect: { type: 'shopDiscount', value: 0.1 },
    unlockCondition: '累计赚取10000文'
  },
  {
    id: 'herb_guide',
    name: '神农本草',
    description: '采集物品质提升1档。',
    effect: { type: 'forageQuality', value: 1 },
    unlockCondition: '采集等级达到8'
  },
  {
    id: 'miners_charm',
    name: '矿工护符',
    description: '挖矿体力消耗降低15%。',
    effect: { type: 'miningStamina', value: 0.15 },
    unlockCondition: '矿洞到达50层'
  },
  {
    id: 'anglers_token',
    name: '钓翁令牌',
    description: '钓鱼小游戏中鱼移动速度降低10%。',
    effect: { type: 'fishingCalm', value: 0.1 },
    unlockCondition: '钓到30种不同的鱼'
  },
  {
    id: 'chefs_hat',
    name: '厨师帽',
    description: '烹饪食物恢复量+25%。',
    effect: { type: 'cookingRestore', value: 0.25 },
    unlockCondition: '烹饪10道不同的食谱'
  },
  {
    id: 'earth_totem',
    name: '土地图腾',
    description: '作物生长速度+10%。',
    effect: { type: 'cropGrowth', value: 0.1 },
    unlockCondition: '收获100次作物'
  },
  {
    id: 'trade_prosperity_seal',
    name: '通商金印',
    description: '通商积分获取+20%。',
    effect: { type: 'tradeBonus', value: 0.2 },
    unlockCondition: '通商积分兑换获得'
  }
]

export const getWalletItemById = (id: string): WalletItemDef | undefined => {
  return WALLET_ITEMS.find(w => w.id === id)
}
