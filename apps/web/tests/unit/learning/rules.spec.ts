import { describe, expect, it } from 'vitest'
import { LEARNING_RULES } from '../../../src/learning/config/rules'

describe('PRD fixed learning and task rules', () => {
  it('pins question rewards and daily goal settings', () => {
    expect(LEARNING_RULES.practiceRewards).toEqual({
      withinGoal: { firstCorrect: 3, correctedAfterHint: 1, correctedAfterExplanation: 0 },
      extraPractice: { firstCorrect: 2, correctedAfterHint: 1, correctedAfterExplanation: 0 },
    })
    expect(LEARNING_RULES.dailyTask).toEqual({
      defaultGoal: 30,
      minimumGoal: 10,
      maximumGoal: 50,
      goalStep: 5,
      completionReward: 20,
      goalChangeEffective: 'next-local-day',
    })
    expect(30 * 3 + 20).toBe(110)
  })

  it('pins streak milestones and recurring seven-day rewards', () => {
    expect(LEARNING_RULES.streak).toEqual({
      milestones: [
        { days: 3, reward: 10 },
        { days: 7, reward: 30 },
        { days: 14, reward: 60 },
        { days: 30, reward: 120 },
      ],
      recurringAfterDays: 30,
      recurringIntervalDays: 7,
      recurringReward: 70,
    })
    expect([37, 44, 51].map((day) => (day - 30) % 7)).toEqual([0, 0, 0])
  })

  it('pins the math and english paper blueprints and refill priority', () => {
    expect(LEARNING_RULES.paper).toEqual({
      mathBlueprint: {
        calculation: 12,
        singleChoice: 6,
        knowledgeApplication: 6,
        wordProblems: 6,
        minimumSingleChoice: 1,
        minimumWordProblems: 1,
      },
      englishBlueprint: {
        singleChoice: 12,
        spelling: 6,
        sentenceCompletion: 9,
        situationalExpression: 3,
        minimumPerAbility: 1,
      },
      mathRefillOrder: ['calculation', 'singleChoice', 'knowledgeApplication', 'wordProblems'],
      specialPracticeSize: 10,
      maximumReviewRatio: 0.2,
    })
  })
})

describe('PRD fixed farm economy rules', () => {
  it('pins the starter gift, land prices and inputs', () => {
    expect(LEARNING_RULES.farm.starterGift).toEqual({
      unlockedPlots: 4,
      radishSeeds: 4,
      chickenCoopLevel: 1,
      chickens: 1,
      feed: 2,
    })
    expect(LEARNING_RULES.farm.plots).toEqual({ maximum: 8, purchasePrices: [100, 160, 240, 320] })
    expect(LEARNING_RULES.farm.fertilizer).toEqual({
      price: 8,
      remainingTimeMultiplier: 0.5,
      maximumPerCrop: 1,
    })
  })

  it('pins crop prices, growth times, yields and sale prices', () => {
    expect(LEARNING_RULES.farm.crops).toEqual({
      radish: { seedPrice: 6, growthMs: 300_000, harvestQuantity: 1, salePrice: 9 },
      wheat: { seedPrice: 12, growthMs: 1_800_000, harvestQuantity: 1, salePrice: 18 },
      corn: { seedPrice: 22, growthMs: 7_200_000, harvestQuantity: 1, salePrice: 32 },
      pumpkin: { seedPrice: 40, growthMs: 28_800_000, harvestQuantity: 1, salePrice: 54 },
    })
  })

  it('pins animals, buildings, sale limits and recovery supplies', () => {
    expect(LEARNING_RULES.farm.animals).toEqual({
      chicken: {
        purchasePrice: 80,
        feedPrice: 5,
        productionMs: 3_600_000,
        product: 'egg',
        productQuantity: 1,
        salePrice: 14,
      },
      cow: {
        purchasePrice: 350,
        feedPrice: 12,
        productionMs: 7_200_000,
        product: 'milk',
        productQuantity: 1,
        salePrice: 32,
      },
    })
    expect(LEARNING_RULES.farm.buildings).toEqual({
      chickenCoop: { initialLevel: 1, initialCapacity: 2, upgradePrice: 300, upgradedCapacity: 4 },
      cowshed: {
        unlockAtPlot: 6,
        purchasePrice: 500,
        initialCapacity: 1,
        upgradePrice: 600,
        upgradedCapacity: 2,
      },
    })
    expect(LEARNING_RULES.farm.dailySaleIncomeCap).toBe(60)
    expect(LEARNING_RULES.farm.recoverySupply).toEqual({
      radishSeeds: 2,
      maximumClaimsPerLocalDay: 1,
    })
  })
})
