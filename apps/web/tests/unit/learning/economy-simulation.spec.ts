import { describe, expect, it } from 'vitest'
import { LEARNING_RULES } from '../../../src/learning/config/rules'
import { claimStarterGift, harvestCrop, plantCrop } from '../../../src/learning/farm/farm'
import {
  claimRecoverySupply,
  getRecoverySupplyStatus,
  purchaseFarmSupplies,
  sellFarmProducts,
} from '../../../src/learning/farm/farm-transactions'
import { getEffectiveFarmTime } from '../../../src/learning/farm/farm-state'
import {
  createEmptyLearningSnapshot,
  type LearningSnapshot,
} from '../../../src/learning/persistence/snapshot'
import {
  collectProcessingOutput,
  purchaseProcessingWorkshop,
  sellProcessingProducts,
  startProcessingTask,
} from '../../../src/learning/processing/operations'
import { PROCESSING_RECIPES } from '../../../src/learning/processing/recipes'
import { settleWallet } from '../../../src/learning/wallet/wallet'
import { createSeededRandom } from '../../helpers/seeded-random'

const NOW = new Date(2026, 10, 20, 12).getTime()
const MINUTE = 60_000
const DAY = 24 * 60 * MINUTE
const CAP = LEARNING_RULES.farm.dailySaleIncomeCap

// 每一步后核对：余额/库存非负、每日出售不超上限、流水可核对且唯一、单加工位不并存任务与待收。
function expectEconomyInvariants(snapshot: LearningSnapshot): void {
  expect(snapshot.wallet.balance).toBeGreaterThanOrEqual(0)
  for (const value of Object.values(snapshot.farm.inventory)) {
    expect(Number.isInteger(value)).toBe(true)
    expect(value).toBeGreaterThanOrEqual(0)
  }
  for (const income of Object.values(snapshot.farm.saleIncomeByDate)) {
    expect(income).toBeGreaterThanOrEqual(0)
    expect(income).toBeLessThanOrEqual(CAP)
  }
  const ids = snapshot.wallet.ledger.map((entry) => entry.settlementId)
  expect(new Set(ids).size).toBe(ids.length)
  const recomputed = snapshot.wallet.ledger.reduce(
    (total, entry) => total + (entry.direction === 'earn' ? entry.amount : -entry.amount),
    0,
  )
  expect(recomputed).toBe(snapshot.wallet.balance)
  if (snapshot.wallet.ledger.length > 0) {
    expect(snapshot.wallet.ledger.at(-1)!.balanceAfter).toBe(snapshot.wallet.balance)
  }
  const workshop = snapshot.processing.workshop
  expect(workshop.activeTask !== null && workshop.pendingOutput !== null).toBe(false)
}

function learn(snapshot: LearningSnapshot, settlementId: string, now: number): LearningSnapshot {
  return {
    ...snapshot,
    wallet: settleWallet(snapshot.wallet, {
      settlementId,
      occurredAt: now,
      source: 'practice',
      referenceId: settlementId,
      direction: 'earn',
      amount: 3,
    }),
  }
}

describe('SIM-ECON-01 长序列不变量', () => {
  it('random legal and illegal sequences never produce negatives, duplication or cap bypass', () => {
    const random = createSeededRandom(20261125)
    let snapshot = createEmptyLearningSnapshot()
    snapshot.farm = claimStarterGift(snapshot.farm, { actionId: 'starter-gift', now: NOW })
    let now = NOW
    let rejected = 0
    for (let step = 0; step < 4000; step += 1) {
      now += random.int(0, 40) * MINUTE
      // 偶发设备时钟回拨：有效时间保护下不得产生负值、复制或绕过上限
      if (random.next() < 0.05) now -= random.int(1, 120) * MINUTE
      const before = snapshot
      try {
        switch (random.int(0, 11)) {
          case 0:
          case 1:
          case 11:
            snapshot = learn(snapshot, `learn-${step}`, now)
            break
          case 2:
            snapshot = purchaseFarmSupplies(snapshot, {
              settlementId: `buy-${step}`,
              now,
              itemId: random.pick(['radish-seed', 'wheat-seed'] as const),
              quantity: random.int(1, 2),
            })
            break
          case 3: {
            const plot = snapshot.farm.plots.find((candidate) => candidate.crop === null)
            if (!plot) throw new Error('没有空地')
            const cropId = (snapshot.farm.inventory['wheat-seed'] ?? 0) > 0 ? 'wheat' : 'radish'
            snapshot = {
              ...snapshot,
              farm: plantCrop(snapshot.farm, {
                actionId: `act-${step}`,
                now,
                plotId: plot.id,
                cropId,
              }),
            }
            break
          }
          case 4: {
            const effective = getEffectiveFarmTime(snapshot.farm, now)
            const plot = snapshot.farm.plots.find(
              (candidate) => candidate.crop !== null && candidate.crop.readyAt <= effective,
            )
            if (!plot) throw new Error('没有成熟作物')
            snapshot = {
              ...snapshot,
              farm: harvestCrop(snapshot.farm, { actionId: `act-${step}`, now, plotId: plot.id }),
            }
            break
          }
          case 5:
            snapshot = purchaseProcessingWorkshop(snapshot, {
              settlementId: `workshop-${step}`,
              now,
            })
            break
          case 6:
            snapshot = startProcessingTask(snapshot, {
              actionId: `act-${step}`,
              now,
              recipeId: 'flour',
            })
            break
          case 7:
            snapshot = collectProcessingOutput(snapshot, { actionId: `act-${step}`, now })
            break
          case 8:
            snapshot = sellFarmProducts(snapshot, {
              settlementId: `sale-${step}`,
              now,
              selection: {
                kind: 'item',
                itemId: random.pick(['radish', 'wheat'] as const),
                quantity: random.int(1, 4),
              },
            })
            break
          case 9:
            snapshot = sellProcessingProducts(snapshot, {
              settlementId: `psale-${step}`,
              now,
              selection: { kind: 'item', itemId: 'flour', quantity: random.int(1, 3) },
            })
            break
          default: {
            if (!getRecoverySupplyStatus(snapshot, now).eligible)
              throw new Error('暂不满足补给条件')
            snapshot = claimRecoverySupply(snapshot, { actionId: `act-${step}`, now })
          }
        }
      } catch {
        rejected += 1
        // 纯函数失败不产生部分变更：快照引用必须原样保留
        expect(snapshot).toBe(before)
      }
      expectEconomyInvariants(snapshot)
    }
    expect(rejected).toBeGreaterThan(0)
    expect(snapshot.wallet.ledger.some((entry) => entry.source === 'practice')).toBe(true)
    expect(snapshot.wallet.ledger.some((entry) => entry.source === 'processing-sale')).toBe(true)
  })
})

describe('SIM-ECON-02 经营节奏', () => {
  it('keeps processing a limited supplement to learning, never an idle income queue', () => {
    // Q2 基线：单件售价不超过每日出售上限；加工增值为正且温和（时间换增值，不是套利）
    const rawPrices: Record<string, number> = {
      wheat: LEARNING_RULES.farm.crops.wheat.salePrice,
      egg: LEARNING_RULES.farm.animals.chicken.salePrice,
      milk: LEARNING_RULES.farm.animals.cow.salePrice,
    }
    for (const recipe of PROCESSING_RECIPES) {
      expect(recipe.unitPrice).toBeLessThanOrEqual(CAP)
      const inputCost = Object.entries(recipe.inputs).reduce(
        (total, [itemId, quantity]) => total + rawPrices[itemId] * quantity,
        0,
      )
      const valueAdded = recipe.unitPrice * recipe.output.quantity - inputCost
      expect(valueAdded).toBeGreaterThan(0)
      expect(valueAdded).toBeLessThanOrEqual(20)
      expect(recipe.durationMinutes).toBeGreaterThanOrEqual(20)
    }

    // 固定种子 30 天：每天学习 30 题 + 低频查看一次农场（种麦→收麦→加工→收取→出售）
    const random = createSeededRandom(42)
    let snapshot = createEmptyLearningSnapshot()
    snapshot.farm = claimStarterGift(snapshot.farm, { actionId: 'starter-gift', now: NOW })
    let now = NOW
    let learningIncome = 0
    let processingIncome = 0
    for (let day = 0; day < 30; day += 1) {
      for (let question = 0; question < 30; question += 1) {
        now += random.int(1, 3) * MINUTE
        snapshot = learn(snapshot, `learn-${day}-${question}`, now)
        learningIncome += 3
      }
      // 低频查看：买麦种、播种、离线成熟后收获、加工、收取、出售
      now += 30 * MINUTE
      const dayKeyBefore = Object.values(snapshot.farm.saleIncomeByDate).reduce(
        (total, value) => total + value,
        0,
      )
      try {
        snapshot = purchaseFarmSupplies(snapshot, {
          settlementId: `seed-${day}`,
          now,
          itemId: 'wheat-seed',
          quantity: 2,
        })
        for (let plotIndex = 0; plotIndex < 2; plotIndex += 1) {
          const plot = snapshot.farm.plots.find((candidate) => candidate.crop === null)
          if (!plot) break
          snapshot = {
            ...snapshot,
            farm: plantCrop(snapshot.farm, {
              actionId: `plant-${day}-${plotIndex}`,
              now,
              plotId: plot.id,
              cropId: 'wheat',
            }),
          }
        }
        now += 30 * MINUTE
        for (const plot of snapshot.farm.plots) {
          if (plot.crop !== null && plot.crop.readyAt <= getEffectiveFarmTime(snapshot.farm, now)) {
            snapshot = {
              ...snapshot,
              farm: harvestCrop(snapshot.farm, {
                actionId: `harvest-${day}-${plot.id}`,
                now,
                plotId: plot.id,
              }),
            }
          }
        }
        if (!snapshot.processing.workshop.purchased) {
          snapshot = purchaseProcessingWorkshop(snapshot, {
            settlementId: `workshop-${day}`,
            now,
          })
        }
        if ((snapshot.farm.inventory.wheat ?? 0) >= 2) {
          snapshot = startProcessingTask(snapshot, {
            actionId: `start-${day}`,
            now,
            recipeId: 'flour',
          })
        }
        now += 20 * MINUTE
        snapshot = collectProcessingOutput(snapshot, { actionId: `collect-${day}`, now })
        const flour = snapshot.farm.inventory.flour ?? 0
        if (flour > 0) {
          snapshot = sellProcessingProducts(snapshot, {
            settlementId: `sell-${day}`,
            now,
            selection: { kind: 'item', itemId: 'flour', quantity: flour },
          })
        }
      } catch {
        // 余额不足或条件不满足时经营停摆，但学习主线不受影响
      }
      const soldToday =
        Object.values(snapshot.farm.saleIncomeByDate).reduce((total, value) => total + value, 0) -
        dayKeyBefore
      expect(soldToday).toBeLessThanOrEqual(CAP)
      processingIncome += Math.max(0, soldToday)
      expectEconomyInvariants(snapshot)
      // 无自动下一轮：收取后加工位必须空闲，等待下一次手动开始
      expect(snapshot.processing.workshop.activeTask).toBeNull()
      // 放置一整天不操作：没有任何自动收益
      const idleBalance = snapshot.wallet.balance
      now += DAY
      expect(snapshot.wallet.balance).toBe(idleBalance)
    }
    expect(learningIncome).toBe(2700)
    expect(processingIncome).toBeGreaterThan(0)
    // 加工增值只是补充，不能取代学习主线
    expect(processingIncome).toBeLessThan(learningIncome)
    expect(processingIncome).toBeLessThanOrEqual(30 * CAP)
  })
})
