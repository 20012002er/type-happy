// 武侠主题语言包 - 统一管理所有游戏文案
export default {
  common: {
    app: {
      title: "WuXia Idle",
      loading: "加载中...",
      error: "出错了",
      confirm: "确认",
      cancel: "取消",
      save: "保存",
      reset: "重置",
      close: "关闭"
    },
    time: {
      second: "秒",
      minute: "分钟", 
      hour: "小时",
      day: "天",
      now: "刚刚",
      ago: "前"
    }
  },
  game: {
    player: {
      level: "等级",
      experience: "经验",
      health: "生命值",
      attack: "攻击力",
      defense: "防御力",
      critChance: "暴击率",
      critMultiplier: "暴击伤害",
      dodgeChance: "闪避率",
      energy: "内力",
      strength: "力量",
      agility: "灵巧",
      vitality: "体质",
      spirit: "悟性",
      luck: "幸运",
      accuracy: "命中",
      speed: "速度",
      gold: "金币",
      reputation: "声望"
    },
    actions: {
      title: "行动",
      meditate: "打坐",
      practice: "练功",
      explore: "闯荡江湖",
      rest: "休息"
    },
    stats: {
      attack: {
        name: "攻击力",
        desc: "决定基础伤害，与敌人防御相互作用。"
      },
      defense: {
        name: "防御力",
        desc: "减少受到的基础伤害，提高生存能力。"
      },
      critChance: {
        name: "暴击率",
        desc: "出手时触发暴击的概率，提升伤害倍数。"
      },
      critMultiplier: {
        name: "暴击伤害",
        desc: "暴击时的伤害倍数。例如1.5表示造成150%伤害。"
      },
      dodgeChance: {
        name: "闪避率",
        desc: "被攻击时躲避伤害的概率。"
      },
      energy: {
        name: "内力",
        desc: "用于施展内功与绝技的资源。升级可提升上限。"
      },
      strength: {
        name: "力量",
        desc: "提高基础攻击与负重（预留拓展）。"
      },
      agility: {
        name: "灵巧",
        desc: "影响闪避与命中（预留拓展）。"
      },
      vitality: {
        name: "体质",
        desc: "增强生命与抗性（预留拓展）。"
      },
      spirit: {
        name: "悟性",
        desc: "提升内力与修炼效率（预留拓展）。"
      },
      luck: {
        name: "幸运",
        desc: "影响掉落与奇遇概率（预留拓展）。"
      },
      accuracy: {
        name: "命中",
        desc: "克制对方闪避，提升命中（预留拓展）。"
      },
      speed: {
        name: "速度",
        desc: "影响出手顺序与频率（预留拓展）。"
      }
    },
    combat: {
      start: "战斗开始！",
      victory: "胜利！",
      defeat: "失败！",
      damage: "造成 {damage} 点伤害",
      round: "第 {round} 回合",
      enemy_defeated: "敌人被击败！",
      player_defeated: "你被击败了..."
    },
    rewards: {
      experience_gained: "获得 {exp} 点经验",
      gold_gained: "获得 {gold} 金币",
      reputation_gained: "获得 {reputation} 点声望",
      level_up: "等级提升！",
      item_found: "发现了 {item}"
    },
    meditate: {
      start: "开始打坐",
      stop: "停止打坐",
      manual: "打坐一下",
      efficiency: "当前效率：每秒 {eps} 经验",
      nextLevelExp: "下一级需要：{need}",
      upgrade: "升级打坐效率（消耗 {cost} 金币）",
      location: "打坐场所",
      unlockedSuccess: "成功解锁 {name}",
      notEnoughGold: "金币不足",
      event: {
        bonusExp: "打坐心领神会，额外获得 {amount} 经验",
        bonusGold: "打坐灵光一现，额外获得 {amount} 金币",
        demonicMinor: "走火入魔，生命 -{hpPercent}% ，经验 -{expPercent}%",
        interruption: "有人打扰，你强行收息，心境受损",
        clarity: "心灵澄澈，呼吸绵长",
        distracted: "杂念丛生，难以入定",
        steadyBreath: "心火微旺，气息渐稳",
        easter: "机缘巧合，获得稀有奖励！"
      },
      breakthrough: {
        success: "突破成功，升至 {level} 级",
        fail: "突破失败，轻微走火入魔，经验清空，获得 {gold} 金币补偿"
      }
    },
    offline: {
      welcome_back: "欢迎回来！",
      time_away: "你离开了 {time}",
      rewards_earned: "在你离开期间获得了以下奖励："
    }
  },
  ui: {
    slot: {
      head: "头部",
      weapon: "武器",
      offhand: "副手",
      armor: "衣甲",
      belt: "腰带",
      gloves: "手套",
      boots: "靴子",
      accessory1: "饰品1",
      accessory2: "饰品2",
      // 兼容旧版本
      ring: "指环"
    },
    navigation: {
      game: "游戏",
      settings: "设置",
      about: "关于"
    },
    settings: {
      title: "游戏设置",
      auto_save: "自动保存",
      reset_game: "重置游戏"
    },
    buttons: {
      start: "开始",
      continue: "继续",
      pause: "暂停",
      stop: "停止"
    },
    equipment: {
      lockWithCost: "锁定({cost}金)",
      unlock: "解锁",
      notEnoughGold: "金币不足",
      lockFailed: "锁定失败",
      redeemFailed: "赎回失败",
      redeemTab: "赎回",
      lockedFlag: "已锁",
      redeemActionWithCost: "赎回({cost}金)",
      redeemEmpty: "（暂无可赎回物品）",
      lostNotePrefix: "【字条】",
      defeatLost: "你不支倒地，昏迷间「{item}」不翼而飞。胸口压着一张字条：{note}",
      defeatNoLoss: "你不支倒地，但身上没有可失去的物件。"
    },
    status: {
      online: "游戏日志",
      loading: "加载中"
    },
    dialogs: {
      confirm_reset: "确认重置游戏？这将清除所有进度。",
      save_success: "保存成功！",
      load_success: "加载成功！"
    }
  },
  
  // === 武侠主题内容 ===
  world: {
    name: "WuXiaIdle",
    description: "一个充满江湖恩怨的武侠世界"
  },
  player: {
    title: "无名侠客",
    description: "一个初入江湖的年轻侠客",
    class: "侠客"
  },
  locations: {
    newbie_village: {
      name: "新手村",
      description: "一个宁静的小村庄，适合初入江湖的侠客修炼基本功法。"
    },
    forest_path: {
      name: "林间小径",
      description: "茂密的森林中隐藏着各种危险，但也蕴藏着机遇。"
    },
    mountain_trail: {
      name: "山间小道",
      description: "崎岖的山路通向未知的深山，传说中有高人隐居于此。"
    },
    bandit_camp: {
      name: "山贼营地",
      description: "山贼们的巢穴，充满了危险和财宝。"
    }
  },
  enemies: {
    bandit: {
      name: "山贼",
      description: "在山林中劫财害命的恶人"
    },
    wild_wolf: {
      name: "野狼", 
      description: "凶猛的野生狼群"
    },
    martial_artist: {
      name: "江湖好手",
      description: "在江湖中闯荡的武林人士"
    }
  },
  items: {
    wooden_sword: {
      name: "木剑",
      description: "一把普通的木制练习剑"
    },
    iron_sword: {
      name: "铁剑", 
      description: "锋利的铁制长剑"
    },
    cloth_armor: {
      name: "布衣",
      description: "普通的布制衣服" 
    },
    leather_armor: {
      name: "皮甲",
      description: "用兽皮制作的防具"
    }
  },
  skills: {
    basic_fist: {
      name: "基础拳法",
      description: "最基本的武功招式"
    },
    sword_technique: {
      name: "剑法",
      description: "使用剑类武器的技巧"
    },
    internal_force: {
      name: "内功",
      description: "调息运气的内家功夫"
    }
  },
  events: {
    meditation_insight: "在打坐中，你有了新的领悟。",
    practice_improvement: "经过刻苦练习，你的武艺有所精进。",
    encounter_bandit: "你遇到了一个山贼！",
    find_treasure: "你发现了一个宝箱！",
    encounter_stranger: "你遇到了一个神秘的陌生人...",
    level_breakthrough: "经过长时间的修炼，你的境界有所突破！"
  },

  // === 闭关修炼系统 ===
  seclusion: {
    type: {
      yangqi: {
        name: "养气闭关",
        description: "调息养气，以经验修为为主，适合快速提升等级。"
      },
      lianti: {
        name: "炼体闭关",
        description: "锤炼肉身，以属性提升为主，增强力量与体质。"
      },
      wudao: {
        name: "悟道闭关",
        description: "参悟天道，以悟性提升为主，兼顾经验与金币。"
      }
    },
    event: {
      // 正面事件
      insight_flash: "灵光一闪，心有所悟，修为精进。",
      qi_surge: "真气涌动，周身经脉畅通无阻。",
      meditation_deep: "入定极深，天地灵气汇聚丹田。",
      body_strengthen: "筋骨强健，气血充盈。",
      enlightenment: "大彻大悟，境界提升。",
      treasure_discovery: "冥冥中感应到一处宝藏的位置。",
      // 负面事件
      qi_deviation: "走火入魔，真气逆行，需调息恢复。",
      distraction: "心神不宁，杂念丛生，修炼效率下降。",
      muscle_tear: "用力过猛，筋脉受损。",
      confusion: "思绪混乱，难以参悟。",
      // 突破事件
      breakthrough_opportunity: "感应到突破契机，真气运转加速。",
      realm_insight: "境界感悟，离突破仅一步之遥。",
      // 中性事件
      peaceful_moment: "心如止水，修炼平稳进行。",
      memory_flash: "往事浮现，略有感悟。",
      nature_harmony: "与天地自然融为一体，身心舒畅。"
    },
    ui: {
      title: "闭关修炼",
      selectType: "选择闭关类型",
      selectDuration: "选择时长",
      consumeResources: "消耗资源",
      efficiency: "效率",
      expectedRewards: "预期收益",
      startSeclusion: "开始闭关",
      stopSeclusion: "结束闭关",
      inProgress: "闭关中",
      progress: "进度",
      timeRemaining: "剩余时间",
      accumulatedExp: "累积经验",
      accumulatedGold: "累积金币",
      eventLog: "闭关记录",
      offlineRewards: "离线收益",
      claimRewards: "领取奖励",
      noResources: "不使用资源",
      basicMode: "基础模式",
      cannotStart: {
        inCombat: "战斗中无法闭关",
        alreadyActive: "已在闭关中",
        insufficientResources: "资源不足"
      }
    },
    log: {
      started: "开始{type}，预计{duration}分钟",
      completed: "闭关完成！获得经验{exp}，金币{gold}",
      interrupted: "闭关中断（{percent}%），获得部分奖励",
      breakthroughSuccess: "闭关突破成功！升至{level}级",
      breakthroughFailed: "突破失败，获得{gold}金币补偿"
    }
  }
};