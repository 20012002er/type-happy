/**
 * 门派声望配置
 * 定义五大派的门派声望等级和福利
 */

export const sectReputationConfig = {
  // 少林寺配置
  shaolin: {
    sectType: 'shaolin',
    sectName: '少林寺',
    levels: [
      {
        level: 1,
        name: '外门弟子',
        minPoints: 0,
        maxPoints: 99,
        title: '少林俗家弟子',
        discountPercent: 0,
        accessLevel: '少林山门',
        exclusiveRewards: ['基础拳法体验']
      },
      {
        level: 2,
        name: '记名弟子',
        minPoints: 100,
        maxPoints: 299,
        title: '少林记名弟子',
        discountPercent: 0.05,
        accessLevel: '少林前院',
        exclusiveRewards: ['少林基础武学', '低级疗伤药']
      },
      {
        level: 3,
        name: '正式弟子',
        minPoints: 300,
        maxPoints: 999,
        title: '少林正式弟子',
        discountPercent: 0.1,
        accessLevel: '少林藏经阁',
        exclusiveRewards: ['少林中级武学', '易筋经残篇']
      },
      {
        level: 4,
        name: '核心弟子',
        minPoints: 1000,
        maxPoints: 2999,
        title: '少林核心弟子',
        discountPercent: 0.15,
        accessLevel: '少林后山',
        exclusiveRewards: ['少林高级武学', '金刚经']
      },
      {
        level: 5,
        name: '长老',
        minPoints: 3000,
        maxPoints: 9999,
        title: '少林长老',
        discountPercent: 0.2,
        accessLevel: '少林禁地',
        exclusiveRewards: ['易筋经', '伏魔棍法']
      },
      {
        level: 6,
        name: '掌门',
        minPoints: 10000,
        maxPoints: 999999,
        title: '少林掌门',
        discountPercent: 0.25,
        accessLevel: '全部区域',
        exclusiveRewards: ['少林镇派武学', '武林盟主候选']
      }
    ],
    benefits: [
      '少林武学修炼效率+10%',
      '防御类武学领悟加成',
      '少林商店商品95折'
    ],
    trainingBonus: {
      artCategory: 'defense',
      statBonus: {
        vitality: 2,
        defense: 3
      }
    }
  },

  // 武当派配置
  wudang: {
    sectType: 'wudang',
    sectName: '武当派',
    levels: [
      {
        level: 1,
        name: '外门弟子',
        minPoints: 0,
        maxPoints: 99,
        title: '武当俗家弟子',
        discountPercent: 0,
        accessLevel: '武当山门',
        exclusiveRewards: ['基础剑法体验']
      },
      {
        level: 2,
        name: '记名弟子',
        minPoints: 100,
        maxPoints: 299,
        title: '武当记名弟子',
        discountPercent: 0.05,
        accessLevel: '武当前殿',
        exclusiveRewards: ['武当基础武学', '低级内力药']
      },
      {
        level: 3,
        name: '正式弟子',
        minPoints: 300,
        maxPoints: 999,
        title: '武当正式弟子',
        discountPercent: 0.1,
        accessLevel: '武当藏经阁',
        exclusiveRewards: ['武当中级武学', '太极拳谱残篇']
      },
      {
        level: 4,
        name: '核心弟子',
        minPoints: 1000,
        maxPoints: 2999,
        title: '武当核心弟子',
        discountPercent: 0.15,
        accessLevel: '武当后山',
        exclusiveRewards: ['武当高级武学', '太极拳']
      },
      {
        level: 5,
        name: '长老',
        minPoints: 3000,
        maxPoints: 9999,
        title: '武当长老',
        discountPercent: 0.2,
        accessLevel: '武当禁地',
        exclusiveRewards: ['真武剑', '太极剑']
      },
      {
        level: 6,
        name: '掌门',
        minPoints: 10000,
        maxPoints: 999999,
        title: '武当掌门',
        discountPercent: 0.25,
        accessLevel: '全部区域',
        exclusiveRewards: ['武当镇派武学', '武林盟主候选']
      }
    ],
    benefits: [
      '武当武学修炼效率+10%',
      '内力恢复速度+15%',
      '武当商店商品95折'
    ],
    trainingBonus: {
      artCategory: 'energy',
      statBonus: {
        spirit: 3,
        energyRegen: 2
      }
    }
  },

  // 峨眉派配置
  emei: {
    sectType: 'emei',
    sectName: '峨眉派',
    levels: [
      {
        level: 1,
        name: '外门弟子',
        minPoints: 0,
        maxPoints: 99,
        title: '峨眉俗家弟子',
        discountPercent: 0,
        accessLevel: '峨眉山门',
        exclusiveRewards: ['基础剑法体验']
      },
      {
        level: 2,
        name: '记名弟子',
        minPoints: 100,
        maxPoints: 299,
        title: '峨眉记名弟子',
        discountPercent: 0.05,
        accessLevel: '峨眉前殿',
        exclusiveRewards: ['峨眉基础武学', '低级丹药']
      },
      {
        level: 3,
        name: '正式弟子',
        minPoints: 300,
        maxPoints: 999,
        title: '峨眉正式弟子',
        discountPercent: 0.1,
        accessLevel: '峨眉藏经阁',
        exclusiveRewards: ['峨眉中级武学', '灭剑术残篇']
      },
      {
        level: 4,
        name: '核心弟子',
        minPoints: 1000,
        maxPoints: 2999,
        title: '峨眉核心弟子',
        discountPercent: 0.15,
        accessLevel: '峨眉后山',
        exclusiveRewards: ['峨眉高级武学', '回风拂柳剑']
      },
      {
        level: 5,
        name: '长老',
        minPoints: 3000,
        maxPoints: 9999,
        title: '峨眉长老',
        discountPercent: 0.2,
        accessLevel: '峨眉禁地',
        exclusiveRewards: ['峨眉刺', '飘雪穿云掌']
      },
      {
        level: 6,
        name: '掌门',
        minPoints: 10000,
        maxPoints: 999999,
        title: '峨眉掌门',
        discountPercent: 0.25,
        accessLevel: '全部区域',
        exclusiveRewards: ['峨眉镇派武学', '武林盟主候选']
      }
    ],
    benefits: [
      '峨眉武学修炼效率+10%',
      '爆发伤害+5%',
      '峨眉商店商品95折'
    ],
    trainingBonus: {
      artCategory: 'burst',
      statBonus: {
        agility: 3,
        critChance: 1
      }
    }
  },

  // 华山派配置
  huashan: {
    sectType: 'huashan',
    sectName: '华山派',
    levels: [
      {
        level: 1,
        name: '外门弟子',
        minPoints: 0,
        maxPoints: 99,
        title: '华山俗家弟子',
        discountPercent: 0,
        accessLevel: '华山山门',
        exclusiveRewards: ['基础剑法体验']
      },
      {
        level: 2,
        name: '记名弟子',
        minPoints: 100,
        maxPoints: 299,
        title: '华山记名弟子',
        discountPercent: 0.05,
        accessLevel: '华山正殿',
        exclusiveRewards: ['华山基础武学', '低级剑气丸']
      },
      {
        level: 3,
        name: '正式弟子',
        minPoints: 300,
        maxPoints: 999,
        title: '华山正式弟子',
        discountPercent: 0.1,
        accessLevel: '华山藏经阁',
        exclusiveRewards: ['华山中级武学', '紫霞神功残篇']
      },
      {
        level: 4,
        name: '核心弟子',
        minPoints: 1000,
        maxPoints: 2999,
        title: '华山核心弟子',
        discountPercent: 0.15,
        accessLevel: '华山后山',
        exclusiveRewards: ['华山高级武学', '独孤九剑']
      },
      {
        level: 5,
        name: '长老',
        minPoints: 3000,
        maxPoints: 9999,
        title: '华山长老',
        discountPercent: 0.2,
        accessLevel: '华山禁地',
        exclusiveRewards: ['紫霞神功', '华山剑宗秘典']
      },
      {
        level: 6,
        name: '掌门',
        minPoints: 10000,
        maxPoints: 999999,
        title: '华山掌门',
        discountPercent: 0.25,
        accessLevel: '全部区域',
        exclusiveRewards: ['华山镇派武学', '武林盟主候选']
      }
    ],
    benefits: [
      '华山武学修炼效率+10%',
      '暴击伤害+10%',
      '华山商店商品95折'
    ],
    trainingBonus: {
      artCategory: 'crit',
      statBonus: {
        attack: 3,
        critMultiplier: 2
      }
    }
  },

  // 丐帮配置
  gaibang: {
    sectType: 'gaibang',
    sectName: '丐帮',
    levels: [
      {
        level: 1,
        name: '外门弟子',
        minPoints: 0,
        maxPoints: 99,
        title: '丐帮弟子',
        discountPercent: 0,
        accessLevel: '丐帮总舵',
        exclusiveRewards: ['基础拳脚体验']
      },
      {
        level: 2,
        name: '记名弟子',
        minPoints: 100,
        maxPoints: 299,
        title: '丐帮记名弟子',
        discountPercent: 0.05,
        accessLevel: '丐帮议事厅',
        exclusiveRewards: ['丐帮基础武学', '低级疗伤酒']
      },
      {
        level: 3,
        name: '正式弟子',
        minPoints: 300,
        maxPoints: 999,
        title: '丐帮正式弟子',
        discountPercent: 0.1,
        accessLevel: '丐帮藏功阁',
        exclusiveRewards: ['丐帮中级武学', '降龙十八掌残篇']
      },
      {
        level: 4,
        name: '核心弟子',
        minPoints: 1000,
        maxPoints: 2999,
        title: '丐帮核心弟子',
        discountPercent: 0.15,
        accessLevel: '丐帮后山',
        exclusiveRewards: ['丐帮高级武学', '打狗棒法']
      },
      {
        level: 5,
        name: '长老',
        minPoints: 3000,
        maxPoints: 9999,
        title: '丐帮长老',
        discountPercent: 0.2,
        accessLevel: '丐帮禁地',
        exclusiveRewards: ['降龙十八掌', '帮主令牌']
      },
      {
        level: 6,
        name: '掌门',
        minPoints: 10000,
        maxPoints: 999999,
        title: '丐帮帮主',
        discountPercent: 0.25,
        accessLevel: '全部区域',
        exclusiveRewards: ['丐帮镇派武学', '武林盟主候选']
      }
    ],
    benefits: [
      '丐帮武学修炼效率+10%',
      '团队增益效果+15%',
      '丐帮商店商品95折'
    ],
    trainingBonus: {
      artCategory: 'support',
      statBonus: {
        strength: 2,
        tenacity: 3
      }
    }
  }
};

// 门派任务类型配置
export const sectTaskConfig = {
  shaolin: {
    sectName: '少林寺',
    tasks: [
      { id: 'shaolin_1', name: '砍柴', points: 5, description: '为少林寺砍柴火' },
      { id: 'shaolin_2', name: '挑水', points: 5, description: '为少林寺挑水' },
      { id: 'shaolin_3', name: '清扫庭院', points: 8, description: '清扫少林寺庭院' },
      { id: 'shaolin_4', name: '巡山', points: 10, description: '巡视少林寺周围' },
      { id: 'shaolin_5', name: '击败山贼', points: 20, description: '击败侵犯少林的山贼' },
      { id: 'shaolin_6', name: '护送香客', points: 25, description: '护送香客安全上下山' }
    ]
  },
  wudang: {
    sectName: '武当派',
    tasks: [
      { id: 'wudang_1', name: '采药', points: 5, description: '为武当派采集草药' },
      { id: 'wudang_2', name: '整理藏书', points: 8, description: '整理武当藏书阁' },
      { id: 'wudang_3', name: '守夜', points: 10, description: '在武当派守夜' },
      { id: 'wudang_4', name: '论道', points: 15, description: '与其他弟子论道' },
      { id: 'wudang_5', name: '击败反派', points: 20, description: '击败冒犯武当的反派' },
      { id: 'wudang_6', name: '修复古籍', points: 25, description: '修复武当古籍' }
    ]
  },
  emei: {
    sectName: '峨眉派',
    tasks: [
      { id: 'emei_1', name: '浇花', points: 5, description: '为峨眉派浇花' },
      { id: 'emei_2', name: '采茶', points: 8, description: '为峨眉派采茶' },
      { id: 'emei_3', name: '打扫殿堂', points: 10, description: '打扫峨眉殿堂' },
      { id: 'emei_4', name: '采药炼丹', points: 15, description: '为峨眉派炼制丹药' },
      { id: 'emei_5', name: '击败山贼', points: 20, description: '击败骚扰峨眉的山贼' },
      { id: 'emei_6', name: '护送师姐', points: 25, description: '护送师姐下山' }
    ]
  },
  huashan: {
    sectName: '华山派',
    tasks: [
      { id: 'huashan_1', name: '巡视山道', points: 5, description: '巡视华山山道' },
      { id: 'huashan_2', name: '练剑', points: 8, description: '在华山练剑' },
      { id: 'huashan_3', name: '守门', points: 10, description: '在华山派守门' },
      { id: 'huashan_4', name: '指导新弟子', points: 15, description: '指导华山新弟子练剑' },
      { id: 'huashan_5', name: '击败魔教', points: 20, description: '击败冒犯华山的魔教中人' },
      { id: 'huashan_6', name: '寻回秘籍', points: 25, description: '为华山派寻回遗失秘籍' }
    ]
  },
  gaibang: {
    sectName: '丐帮',
    tasks: [
      { id: 'gaibang_1', name: '行乞', points: 5, description: '在城中行乞' },
      { id: 'gaibang_2', name: '打探消息', points: 8, description: '为丐帮打探消息' },
      { id: 'gaibang_3', name: '维护秩序', points: 10, description: '维护城中秩序' },
      { id: 'gaibang_4', name: '惩治恶霸', points: 15, description: '惩治城中恶霸' },
      { id: 'gaibang_5', name: '击败反派', points: 20, description: '击败为非作歹的反派' },
      { id: 'gaibang_6', name: '护送救济粮', points: 25, description: '护送丐帮救济粮' }
    ]
  }
};
