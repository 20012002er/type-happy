import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import type { Gender } from '@/types'
import {
  LATE_NIGHT_RECOVERY_MAX,
  LATE_NIGHT_RECOVERY_MIN,
  PASSOUT_STAMINA_RECOVERY,
  PASSOUT_MONEY_PENALTY_RATE,
  PASSOUT_MONEY_PENALTY_CAP,
  STAMINA_WARN_RATIO,
  STAMINA_CRITICAL_RATIO
} from '@/data/timeConstants'
import { addLog, showFloat } from '@/composables/useGameLog'
import { useSkillStore } from './useSkillStore'
import { useHomeStore } from './useHomeStore'
import { useInventoryStore } from './useInventoryStore'
import { useAchievementStore } from './useAchievementStore'
import { useHiddenNpcStore } from './useHiddenNpcStore'
import { useMiningStore } from './useMiningStore'
import { useGuildStore } from './useGuildStore'

/** 最大体力阶梯 (5档, 270 起 508 顶) */
const STAMINA_CAPS = [120, 160, 200, 250, 300]

/** HP 常量 */
const BASE_MAX_HP = 100
const HP_PER_COMBAT_LEVEL = 5
const FIGHTER_HP_BONUS = 25
const WARRIOR_HP_BONUS = 40

export const usePlayerStore = defineStore('player', () => {
  const playerName = ref('未命名')
  const gender = ref<Gender>('male')
  /** 旧存档加载后需要设置身份（不持久化） */
  const needsIdentitySetup = ref(false)
  const money = ref(500)
  const stamina = ref(120)
  const maxStamina = ref(120)
  const staminaCapLevel = ref(0) // 0=120, 1=160, 2=200, 3=250, 4=300
  /** 额外体力上限加成（仙翁金丹等），不受仙桃阶梯覆盖 */
  const bonusMaxStamina = ref(0)

  // HP 系统
  const hp = ref(BASE_MAX_HP)
  const baseMaxHp = ref(BASE_MAX_HP)

  const isExhausted = computed(() => stamina.value <= 5)
  const staminaPercent = computed(() => Math.round((stamina.value / maxStamina.value) * 100))
  /** NPC 用来称呼玩家的称谓 */
  const honorific = computed(() => (gender.value === 'male' ? '小哥' : '姑娘'))

  /**
   * 今日已提示过的体力预警级别（0 无 / 1 偏低 / 2 告急 / 3 耗尽）。
   * 逐级递进，避免同一档位反复刷屏；体力回升后自动回落。
   */
  const staminaWarnStage = ref(0)

  /** 体力跌破阈值时提醒玩家，并说明昏倒的实际代价 */
  const checkStaminaWarning = () => {
    const ratio = maxStamina.value > 0 ? stamina.value / maxStamina.value : 0
    const penaltyPct = Math.round(PASSOUT_MONEY_PENALTY_RATE * 100)

    if (stamina.value <= 0 && staminaWarnStage.value < 3) {
      staminaWarnStage.value = 3
      showFloat('体力已耗尽！再行动就会当场累倒', 'danger')
      addLog(`体力已耗尽。就这样倒下会损失${penaltyPct}%铜钱（上限${PASSOUT_MONEY_PENALTY_CAP}文），次日体力也只恢复一半。快回去休息吧。`)
      return
    }
    if (ratio <= STAMINA_CRITICAL_RATIO && staminaWarnStage.value < 2) {
      staminaWarnStage.value = 2
      showFloat(`体力告急！只剩${stamina.value}点`, 'danger')
      addLog(`体力所剩无几。若体力归零倒下，将损失${penaltyPct}%铜钱（上限${PASSOUT_MONEY_PENALTY_CAP}文）——吃点东西或回去休息吧。`)
      return
    }
    if (ratio <= STAMINA_WARN_RATIO && staminaWarnStage.value < 1) {
      staminaWarnStage.value = 1
      showFloat(`体力不多了（${stamina.value}/${maxStamina.value}）`, 'water')
    }
  }

  /** 计算当前最大 HP（基础 + 战斗等级 + 专精加成 + 仙缘加成 + 公会加成） */
  const getMaxHp = (): number => {
    const skillStore = useSkillStore()
    let bonus = skillStore.combatLevel * HP_PER_COMBAT_LEVEL
    const perk5 = skillStore.getSkill('combat').perk5
    const perk10 = skillStore.getSkill('combat').perk10
    if (perk5 === 'fighter') bonus += FIGHTER_HP_BONUS
    if (perk10 === 'warrior') bonus += WARRIOR_HP_BONUS
    const ringHpBonus = useInventoryStore().getRingEffectValue('max_hp_bonus')
    // 仙缘结缘：灵护（spirit_shield）HP 加成
    const spiritShield = useHiddenNpcStore().getBondBonusByType('spirit_shield')
    const spiritHpBonus = spiritShield?.type === 'spirit_shield' ? spiritShield.hpBonus : 0
    // 公会加成：生命护符永久 + 等级被动
    const guildHpBonus = useMiningStore().guildBonusMaxHp
    const guildLevelHpBonus = useGuildStore().getGuildHpBonus()
    return baseMaxHp.value + bonus + ringHpBonus + spiritHpBonus + guildHpBonus + guildLevelHpBonus
  }

  const getHpPercent = (): number => {
    return Math.round((hp.value / getMaxHp()) * 100)
  }

  const getIsLowHp = (): boolean => {
    return hp.value <= getMaxHp() * 0.25
  }

  /**
   * 玩家是否已确认「体力将耗尽也继续」。
   * 第一次会把体力打到 0 的操作会被拦下并弹确认框，玩家点了继续再操作一次即可放行；
   * 每天重置，避免同一天反复弹。
   */
  const exhaustConfirmed = ref(false)

  /** 是否正在等待玩家确认（界面据此弹窗） */
  const exhaustPrompt = ref(false)

  /**
   * 消耗体力（含仙缘灵护减免），返回是否成功。
   * @param skipExhaustPrompt 跳过「即将耗尽」确认。赶路这种不该把人拦在半道的消耗传 true。
   */
  const consumeStamina = (amount: number, skipExhaustPrompt = false): boolean => {
    // 仙缘结缘：灵护（spirit_shield）体力消耗减免
    const spiritShield2 = useHiddenNpcStore().getBondBonusByType('spirit_shield')
    const spiritSave = spiritShield2?.type === 'spirit_shield' ? spiritShield2.staminaSave / 100 : 0
    const effectiveAmount = Math.max(1, Math.floor(amount * (1 - spiritSave)))
    if (stamina.value < effectiveAmount) return false

    // 这一下会把体力打到 0：先拦住问一声。所有耗体力操作都经过这里，
    // 调用方把 false 当「体力不足」处理即可，不必逐个改动。
    if (!skipExhaustPrompt && !exhaustConfirmed.value && stamina.value - effectiveAmount <= 0) {
      exhaustPrompt.value = true
      return false
    }

    stamina.value -= effectiveAmount
    checkStaminaWarning()
    return true
  }

  /** 玩家确认继续：今天内不再询问，重新操作一次即可 */
  const confirmExhaust = () => {
    exhaustConfirmed.value = true
    exhaustPrompt.value = false
  }

  /** 玩家选择先歇歇 */
  const cancelExhaust = () => {
    exhaustPrompt.value = false
  }

  /** 恢复体力 */
  const restoreStamina = (amount: number) => {
    stamina.value = Math.min(stamina.value + amount, maxStamina.value)
    // 体力回到安全线以上时重置预警，便于下一轮再次提醒
    const ratio = maxStamina.value > 0 ? stamina.value / maxStamina.value : 0
    if (ratio > STAMINA_WARN_RATIO) staminaWarnStage.value = 0
    else if (ratio > STAMINA_CRITICAL_RATIO && staminaWarnStage.value > 1) staminaWarnStage.value = 1
  }

  /** 受到伤害（扣 HP），返回实际伤害值 */
  const takeDamage = (amount: number): number => {
    const actual = Math.min(amount, hp.value)
    hp.value -= actual
    return actual
  }

  /** 恢复生命值 */
  const restoreHealth = (amount: number) => {
    hp.value = Math.min(hp.value + amount, getMaxHp())
  }

  /**
   * 每日重置
   * - 正常：满体力 + 满HP
   * - 晚睡：渐进恢复 (24时90%→25时60%) + 满HP
   * - 昏倒：50% 体力 + 满HP + 扣10%铜钱
   */
  const dailyReset = (mode: 'normal' | 'late' | 'passout', bedHour?: number): { moneyLost: number; recoveryPct: number } => {
    let moneyLost = 0
    let recoveryPct = 1
    staminaWarnStage.value = 0
    exhaustConfirmed.value = false
    exhaustPrompt.value = false
    switch (mode) {
      case 'normal':
        stamina.value = maxStamina.value
        break
      case 'late': {
        // 渐进式恢复：24时→90%, 25时→60%, 线性插值
        const homeStore = useHomeStore()
        const staminaBonus = homeStore.getStaminaRecoveryBonus()
        const t = Math.min(Math.max((bedHour ?? 24) - 24, 0), 1)
        recoveryPct = LATE_NIGHT_RECOVERY_MAX - t * (LATE_NIGHT_RECOVERY_MAX - LATE_NIGHT_RECOVERY_MIN) + staminaBonus
        stamina.value = Math.floor(maxStamina.value * Math.min(recoveryPct, 1))
        break
      }
      case 'passout': {
        const homeStore2 = useHomeStore()
        const staminaBonus2 = homeStore2.getStaminaRecoveryBonus()
        recoveryPct = PASSOUT_STAMINA_RECOVERY + staminaBonus2
        stamina.value = Math.floor(maxStamina.value * Math.min(recoveryPct, 1))
        moneyLost = Math.min(Math.floor(money.value * PASSOUT_MONEY_PENALTY_RATE), PASSOUT_MONEY_PENALTY_CAP)
        money.value -= moneyLost
        break
      }
    }
    // HP 每天都回满
    hp.value = getMaxHp()
    return { moneyLost, recoveryPct }
  }

  /** 提升体力上限 */
  const upgradeMaxStamina = (): boolean => {
    if (staminaCapLevel.value >= STAMINA_CAPS.length - 1) return false
    staminaCapLevel.value++
    maxStamina.value = STAMINA_CAPS[staminaCapLevel.value]! + bonusMaxStamina.value
    return true
  }

  /** 增加额外体力上限加成（仙翁金丹等） */
  const addBonusMaxStamina = (amount: number) => {
    bonusMaxStamina.value += amount
    maxStamina.value = STAMINA_CAPS[staminaCapLevel.value]! + bonusMaxStamina.value
  }

  /** 花费铜钱，返回是否成功 */
  const spendMoney = (amount: number): boolean => {
    if (money.value < amount) return false
    money.value -= amount
    return true
  }

  /** 获得铜钱 */
  const earnMoney = (amount: number) => {
    money.value += amount
    useAchievementStore().recordMoneyEarned(amount)
  }

  /** 设置玩家身份（新游戏或旧存档迁移时调用） */
  const setIdentity = (name: string, g: Gender) => {
    playerName.value = name
    gender.value = g
    needsIdentitySetup.value = false
  }

  const serialize = () => {
    return {
      playerName: playerName.value,
      gender: gender.value,
      money: money.value,
      stamina: stamina.value,
      maxStamina: maxStamina.value,
      staminaCapLevel: staminaCapLevel.value,
      bonusMaxStamina: bonusMaxStamina.value,
      hp: hp.value,
      baseMaxHp: baseMaxHp.value
    }
  }

  const deserialize = (data: ReturnType<typeof serialize>) => {
    const hasIdentity = (data as any).playerName != null
    playerName.value = (data as any).playerName ?? '未命名'
    gender.value = (data as any).gender ?? 'male'
    needsIdentitySetup.value = !hasIdentity
    money.value = data.money
    stamina.value = data.stamina
    maxStamina.value = data.maxStamina
    staminaCapLevel.value = data.staminaCapLevel
    bonusMaxStamina.value = (data as any).bonusMaxStamina ?? 0
    // 旧存档兼容：如果没有 bonusMaxStamina 字段，从 maxStamina 和 staminaCapLevel 推算
    if ((data as any).bonusMaxStamina == null) {
      const expectedBase = STAMINA_CAPS[staminaCapLevel.value] ?? 120
      const diff = maxStamina.value - expectedBase
      if (diff > 0) bonusMaxStamina.value = diff
    }
    // 确保 maxStamina 与 staminaCapLevel + bonusMaxStamina 一致（修复旧存档）
    const expectedMax = (STAMINA_CAPS[staminaCapLevel.value] ?? 120) + bonusMaxStamina.value
    if (maxStamina.value !== expectedMax) {
      maxStamina.value = expectedMax
    }
    hp.value = (data as any).hp ?? BASE_MAX_HP
    baseMaxHp.value = (data as any).baseMaxHp ?? BASE_MAX_HP
  }

  return {
    playerName,
    gender,
    needsIdentitySetup,
    honorific,
    money,
    stamina,
    maxStamina,
    staminaCapLevel,
    bonusMaxStamina,
    hp,
    baseMaxHp,
    isExhausted,
    staminaPercent,
    staminaWarnStage,
    getMaxHp,
    getHpPercent,
    getIsLowHp,
    consumeStamina,
    exhaustConfirmed,
    exhaustPrompt,
    confirmExhaust,
    cancelExhaust,
    restoreStamina,
    takeDamage,
    restoreHealth,
    dailyReset,
    upgradeMaxStamina,
    addBonusMaxStamina,
    spendMoney,
    earnMoney,
    setIdentity,
    serialize,
    deserialize
  }
})
