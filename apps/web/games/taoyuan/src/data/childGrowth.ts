import type { ChildStage } from '@/types'

/**
 * 子女成长线。
 *
 * 原先孩子只有 stage 字段在后台默默翻页，玩家除了名字什么都感受不到。
 * 这里补上三样东西：阶段跨越时的里程碑事件、各阶段不同的互动内容、以及长大后能搭把手的产出。
 */

/** 各阶段的中文名 */
export const CHILD_STAGE_NAMES: Record<ChildStage, string> = {
  baby: '襁褓',
  toddler: '学步',
  child: '孩童',
  teen: '少年'
}

/** 各阶段起始天数（daysOld 达到即进入该阶段） */
export const CHILD_STAGE_DAYS: Record<ChildStage, number> = {
  baby: 0,
  toddler: 14,
  child: 28,
  teen: 56
}

/** 阶段顺序 */
export const CHILD_STAGE_ORDER: ChildStage[] = ['baby', 'toddler', 'child', 'teen']

/** 进入新阶段时的里程碑文案，{name} 为孩子名，{spouse} 为配偶名 */
export const CHILD_MILESTONES: Record<ChildStage, string[]> = {
  baby: ['{name}出生了。皱巴巴的一小团，攥着你的手指不肯松开。'],
  toddler: [
    '{name}今天扶着门框站了起来，摇摇晃晃走了三步，然后一屁股坐在地上，咧嘴笑了。',
    '{name}开口叫了第一声。{spouse}在灶台边听见，锅铲都掉了。'
  ],
  child: [
    '{name}能满院子跑了。今早你在鸡舍里找到他，怀里抱着一只受惊的母鸡，一脸得意。',
    '{name}学会自己穿衣裳了，虽然扣子还是系错了两颗。',
    '{name}跟着你下了一回田，有模有样地蹲在垄边拔草，拔掉的大半是苗。'
  ],
  teen: [
    '{name}比去年高了一个头。今天主动说：「爹娘，田里的活我也能干了。」',
    '{name}最近总往村塾跑，回来会背几句诗给你听，念错了还不许人纠正。',
    '{name}把农具擦得锃亮，摆得整整齐齐。{spouse}说，这孩子随你。'
  ]
}

/** 各阶段的日常互动文案 */
export const CHILD_INTERACTIONS: Record<ChildStage, string[]> = {
  baby: [
    '{name}睡得正香，小拳头握在脸边。你轻轻替他掖了掖被角。',
    '你抱起{name}晃了晃，他咿咿呀呀地应了两声，又睡过去了。',
    '{name}醒着，睁着乌溜溜的眼睛看你，看着看着就笑了。'
  ],
  toddler: [
    '{name}扑过来抱住你的腿，仰着头要你抱。',
    '你教{name}数数，数到三就开始乱了，他自己倒是很满意。',
    '{name}把一块石头郑重地放进你手里，像是送了件了不得的宝贝。',
    '你陪{name}在院子里追了一圈鸡，他笑得直喘气。'
  ],
  child: [
    '{name}拉着你去看他在墙角搭的「房子」——三块砖头和一片瓦。',
    '你给{name}讲了个故事，他听完说：「那明天再讲一个。」',
    '{name}今天跟石头打了一架，回来还嘴硬说不疼。你给他擦了擦膝盖。',
    '{name}问你：「爹娘，山那边是什么样子？」你一时答不上来。',
    '你陪{name}在溪边打了会儿水漂。他最好的成绩是四下。'
  ],
  teen: [
    '{name}主动帮你把水缸挑满了，抹着汗说：「不算什么。」',
    '你和{name}坐在门槛上说了会儿话。他现在有自己的主意了。',
    '{name}说想学一门手艺，问你村里谁的活儿最好。',
    '{name}把今天在田里看到的虫害记在纸上给你，字写得比你工整。',
    '你发现{name}偷偷在练你教过的农活，动作已经很像样了。'
  ]
}

/** 孩童/少年偶尔会带回来的小东西 */
export const CHILD_GIFT_POOL: Record<ChildStage, string[]> = {
  baby: [],
  toddler: ['pine_cone', 'wild_berry'],
  child: ['wood', 'herb', 'pine_cone', 'wild_berry', 'clay'],
  teen: ['wood', 'herb', 'bamboo', 'wild_mushroom', 'copper_ore', 'clay']
}

/** 各阶段带回东西的概率 */
export const CHILD_GIFT_CHANCE: Record<ChildStage, number> = {
  baby: 0,
  toddler: 0.08,
  child: 0.15,
  teen: 0.25
}

/** 少年每天能帮忙浇的地块数 */
export const TEEN_HELP_PLOTS = 3

/** 根据天数推算所处阶段 */
export const getChildStageByAge = (daysOld: number): ChildStage => {
  if (daysOld >= CHILD_STAGE_DAYS.teen) return 'teen'
  if (daysOld >= CHILD_STAGE_DAYS.child) return 'child'
  if (daysOld >= CHILD_STAGE_DAYS.toddler) return 'toddler'
  return 'baby'
}

/** 取一条里程碑文案 */
export const pickMilestone = (stage: ChildStage): string => {
  const pool = CHILD_MILESTONES[stage]
  return pool[Math.floor(Math.random() * pool.length)] ?? ''
}

/** 取一条互动文案 */
export const pickInteraction = (stage: ChildStage): string => {
  const pool = CHILD_INTERACTIONS[stage]
  return pool[Math.floor(Math.random() * pool.length)] ?? ''
}

/** 填充文案里的占位符 */
export const fillChildText = (text: string, childName: string, spouseName: string): string => {
  return text.replace(/\{name\}/g, childName).replace(/\{spouse\}/g, spouseName || '你的伴侣')
}
