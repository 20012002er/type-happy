import type { Attrs, NpcDef } from '../types'

const deriveAttrs = (level: number, boost = 0): Attrs => {
  const base = 18 + level * 0.12 + boost
  return { arm: Math.round(base), agi: Math.round(base), bone: Math.round(base), ins: Math.round(base * 0.8) }
}

const loadout = (level: number, ...ids: string[]): { id: string; level: number }[] =>
  ids.map((id) => ({ id, level: Math.max(1, Math.round(level * 0.85)) }))

interface NpcOpts {
  title?: string
  gender?: 'male' | 'female'
  boost?: number
  hp?: number
  mp?: number
  power?: number
  hostile?: boolean
  dialog?: string[]
  teach?: string[]
  shop?: { id: string; price: number }[]
  drops?: { id: string; chance: number }[]
  expReward?: number
  silverReward?: number
  gift?: NpcDef['gift']
  skills?: { id: string; level: number }[]
}

function n(id: string, name: string, level: number, o: NpcOpts = {}): NpcDef {
  return {
    id,
    name,
    title: o.title,
    gender: o.gender ?? 'male',
    level,
    attrs: deriveAttrs(level, o.boost ?? 0),
    hp: o.hp,
    mp: o.mp,
    skills: o.skills ?? loadout(level, 'bs-fist', 'bs-parry', 'bs-light', 'bs-internal'),
    power: o.power ?? Math.round(level * 0.6),
    hostile: o.hostile ?? false,
    dialog: o.dialog,
    teach: o.teach,
    shop: o.shop,
    drops: o.drops,
    expReward: o.expReward,
    silverReward: o.silverReward,
    gift: o.gift,
  }
}

export const NPCS: NpcDef[] = [
  // ========== 第一章 · 柳叶渡 ==========
  n('zhou-ferry', '摆渡老周', 5, {
    title: '艄公',
    dialog: [
      '这条河叫青萍河,渡了四十年,水里的鱼都认得我。',
      '后生,想练本事?渡口这些活计都能磨人:挑水练腿脚,劈柴练刀,举石锁练拳。',
      '镇东头的张无良霸了渡口,闺女给的银簪都被他手下的狗腿子抢了……',
    ],
    teach: ['bs-fist', 'bs-parry', 'bs-internal', 'bs-light', 'bs-sword', 'bs-blade', 'bs-read'],
    gift: { likes: ['food-dry'], reward: { exp: 150, silver: 50 } },
  }),
  n('wang-lackey', '恶霸王五', 3, {
    title: '张府狗腿',
    hostile: true,
    dialog: ['张老爷的地界,过路也得交钱!'],
    drops: [
      { id: 'food-bun', chance: 0.5 },
      { id: 'a-hands-cloth', chance: 0.15 },
    ],
  }),
  n('chen-fisher', '渔夫陈老三', 4, {
    dialog: ['今年河里邪性,鱼都往芦荡深处跑。', '老周这人嘴碎,心善。'],
    shop: [
      { id: 'food-bun', price: 5 },
      { id: 'food-dry', price: 15 },
    ],
    gift: { likes: ['food-bun'], reward: { exp: 50 } },
  }),
  n('zhang-bully', '渡霸张无良', 8, {
    title: '柳叶渡一霸',
    hostile: true,
    boost: 6,
    dialog: ['老子在柳叶渡说一不二!'],
    skills: loadout(9, 'bs-blade', 'bs-parry', 'bs-light', 'bs-internal'),
    drops: [
      { id: 'w-iron-blade', chance: 0.35 },
      { id: 'a-body-short', chance: 0.3 },
      { id: 'med-gold', chance: 0.5 },
    ],
    silverReward: 300,
  }),

  // ========== 第二章 · 青石镇 ==========
  n('wang-shop', '杂货铺王掌柜', 6, {
    dialog: ['客官随便看,小店童叟无欺。', '钱万斤那厮又涨保护费了,这日子没法过了!'],
    shop: [
      { id: 'food-bun', price: 5 },
      { id: 'food-dry', price: 15 },
      { id: 'med-gold', price: 200 },
      { id: 'med-mid', price: 800 },
      { id: 'mp-small', price: 150 },
      { id: 'spirit-small', price: 300 },
      { id: 'a-head-cloth', price: 100 },
      { id: 'a-body-cloth', price: 150 },
      { id: 'a-body-short', price: 800 },
      { id: 'a-hands-cloth', price: 80 },
      { id: 'a-legs-cloth', price: 80 },
      { id: 'a-feet-straw', price: 30 },
      { id: 'a-feet-cloth', price: 500 },
    ],
  }),
  n('li-smith', '铁匠李', 8, {
    dialog: ['打铁还需自身硬,买刀还得看眼力。'],
    shop: [
      { id: 'w-iron-sword', price: 400 },
      { id: 'w-iron-blade', price: 400 },
      { id: 'w-wax-staff', price: 350 },
      { id: 'w-long-whip', price: 380 },
      { id: 'w-bronze-ring', price: 400 },
      { id: 'w-dart', price: 300 },
      { id: 'w-bluesteel', price: 1500 },
      { id: 'w-willow', price: 1500 },
      { id: 'a-head-leather', price: 600 },
      { id: 'a-hands-leather', price: 700 },
      { id: 'a-legs-leather', price: 700 },
    ],
  }),
  n('yan-wanderer', '浪子燕十三', 22, {
    title: '游方剑客',
    boost: 8,
    dialog: [
      '剑是凶器,剑法是杀人术,可江湖上偏要说它美。',
      '你若无门无派,我倒可以教你几手浪迹江湖的本事。',
    ],
    teach: ['pub-neigong', 'pub-qg', 'pub-sword'],
    hostile: false,
  }),
  n('bai-shuang', '白霜', 25, {
    title: '青崖剑派外门使者',
    gender: 'female',
    boost: 6,
    dialog: [
      '青崖剑派立派百年,剑如青崖,人有傲骨。',
      '你若有向剑之心,我可代师收徒。入了门,基本功与门派武学都有人指点。',
    ],
    teach: ['bs-fist', 'bs-parry', 'bs-internal', 'bs-light', 'bs-sword', 'bs-read'],
  }),
  n('qin-zhao', '秦照', 28, {
    title: '青崖剑派大弟子',
    boost: 6,
    dialog: ['入门便是同门,切磋点到为止。'],
    skills: loadout(28, 'hs-sword1', 'bs-sword', 'hs-zj', 'hs-qg', 'hs-neigong'),
  }),
  n('clerk-gov', '衙门书吏', 5, {
    dialog: ['镇上飞贼横行,官府悬赏缉拿,勇者请了。'],
  }),
  n('qian-dog', '钱府打手', 10, {
    hostile: true,
    dialog: ['钱老爷收例钱,不交就砸店!'],
    drops: [{ id: 'mat-iron', chance: 0.6 }],
  }),
  n('qian-wanjin', '钱万斤', 15, {
    title: '铁算盘',
    hostile: true,
    boost: 6,
    dialog: ['青石镇的保护费,一个子儿都不能少!'],
    skills: loadout(16, 'bs-fist', 'bs-parry', 'bs-light', 'bs-internal'),
    drops: [
      { id: 'w-bronze-ring', chance: 0.4 },
      { id: 'a-body-leather', chance: 0.3 },
      { id: 'med-gold', chance: 0.6 },
    ],
    silverReward: 800,
  }),

  // ========== 第三章 · 雁回坡 ==========
  n('hu-hunter', '女猎户胡三娘', 18, {
    gender: 'female',
    dialog: ['黑风寨的贼人昨儿又下山了,过路的行商遭殃喽。', '伤药要吗?山里人实诚,不卖假货。'],
    shop: [
      { id: 'med-gold', price: 180 },
      { id: 'med-mid', price: 750 },
      { id: 'food-dry', price: 14 },
      { id: 'a-body-leather', price: 3000 },
      { id: 'a-feet-fast', price: 2100 },
    ],
    gift: { likes: ['mat-fur'], reward: { exp: 300 } },
  }),
  n('bandit-lookout', '黑风哨探', 18, {
    hostile: true,
    dialog: ['此路是我开!'],
    drops: [{ id: 'mat-token', chance: 0.7 }],
  }),
  n('bandit-runner', '黑风传令', 20, {
    hostile: true,
    dialog: ['让开让开,寨主的急信!'],
    drops: [
      { id: 'mat-letter', chance: 0.9 },
      { id: 'mat-token', chance: 0.5 },
    ],
  }),
  n('gao-ye', '高野', 25, {
    title: '黑风寨主·独眼龙',
    hostile: true,
    boost: 8,
    dialog: ['独眼龙的高字旗,也敢有人来拔?'],
    skills: loadout(26, 'bs-blade', 'bs-parry', 'bs-light', 'bs-internal'),
    drops: [
      { id: 'w-willow', chance: 0.4 },
      { id: 'a-body-leather', chance: 0.35 },
      { id: 'spirit-small', chance: 0.5 },
    ],
    silverReward: 1200,
  }),

  // ========== 第四章 · 临江城 ==========
  n('tie-cop', '铁成钢', 30, {
    title: '临江府总捕头',
    boost: 8,
    dialog: ['临江地面不太平,匪盗、江贼、还有来路不明的黑衣人……少侠武艺高强,可愿助官府一臂之力?'],
    skills: loadout(32, 'bs-blade', 'bs-parry', 'bs-light', 'bs-internal'),
    gift: { likes: ['mat-token', 'mat-pouch'], reward: { exp: 800, silver: 400 } },
  }),
  n('fan-xiaoyi', '范小七', 26, {
    title: '丐帮范铁衣座下弟子',
    dialog: [
      '有酒有肉有朋友,便是丐帮好弟子!',
      '我们帮主范铁衣常说:要饭不要命,穷得有骨气。入帮吗?入帮就是自家兄弟!',
    ],
    teach: ['bs-fist', 'bs-parry', 'bs-internal', 'bs-light', 'bs-staff', 'bs-read'],
  }),
  n('lu-qishi', '鲁七', 30, {
    title: '丐帮七袋弟子',
    boost: 4,
    dialog: ['新来的?来,过两招!'],
    skills: loadout(30, 'gb-staff1', 'bs-staff', 'gb-zj', 'gb-qg', 'gb-neigong'),
  }),
  n('ware-house', '货栈掌柜', 10, {
    dialog: ['走镖的、跑江湖的,都爱来我这儿置办行头。'],
    shop: [
      { id: 'w-steel-staff', price: 1400 },
      { id: 'w-nine-section', price: 5800 },
      { id: 'w-twin-ring', price: 5600 },
      { id: 'w-plum', price: 5200 },
      { id: 'a-head-iron', price: 2500 },
      { id: 'a-body-chain', price: 12000 },
      { id: 'a-hands-iron', price: 2800 },
      { id: 'a-legs-iron', price: 2800 },
      { id: 'a-feet-fast', price: 2200 },
      { id: 'spirit-big', price: 1200 },
    ],
  }),
  n('informant', '江湖百事通', 12, {
    title: '悦来客栈消息贩子',
    dialog: [
      '客官打听点什么?江湖上的事,没有我不知道的。',
      '最近黑风寨残部往北去了,说是给什么「太虚残卷」跑腿。',
    ],
    gift: { likes: ['mp-small'], reward: { exp: 400, silver: 300 } },
  }),
  n('long-shark', '龙九斤', 35, {
    title: '江洋大盗·穿浪白蛟',
    hostile: true,
    boost: 10,
    dialog: ['临江城的水路,姓龙!'],
    skills: loadout(36, 'bs-staff', 'bs-parry', 'bs-light', 'bs-internal'),
    drops: [
      { id: 'w-steel-staff', chance: 0.4 },
      { id: 'a-body-chain', chance: 0.2 },
      { id: 'med-mid', chance: 0.6 },
    ],
    silverReward: 2000,
  }),
  n('long-crab', '白蛟爪牙', 28, {
    hostile: true,
    dialog: ['龙爷办事,闲人闪开!'],
    drops: [{ id: 'mat-iron', chance: 0.6 }],
  }),

  // ========== 第五章 · 落霞谷 ==========
  n('su-qinghe', '苏青荷', 32, {
    title: '落霞谷主座下弟子',
    gender: 'female',
    boost: 6,
    dialog: [
      '落霞谷只收女弟子,谷中遍植药草,亦武亦医。',
      '谷主闭关,由我代掌外务。师妹可有志一同?',
    ],
    teach: ['bs-fist', 'bs-parry', 'bs-internal', 'bs-light', 'bs-sword', 'bs-read'],
  }),
  n('ye-zhiwei', '叶知薇', 34, {
    title: '落霞谷大师姐',
    gender: 'female',
    boost: 4,
    dialog: ['剑下留三分,是落霞谷的规矩。'],
    skills: loadout(34, 'em-sword1', 'bs-sword', 'em-zj', 'em-qg', 'em-neigong'),
  }),
  n('herb-farmer', '药农', 15, {
    dialog: ['谷里的蛇疯了,见人就咬,都是那个用毒的恶徒搞的鬼!'],
    shop: [
      { id: 'med-gold', price: 190 },
      { id: 'med-mid', price: 780 },
      { id: 'med-big', price: 2500 },
      { id: 'guard-pill', price: 1500 },
    ],
  }),
  n('python-poison', '赤练蟒', 45, {
    title: '谷中孽畜',
    hostile: true,
    boost: 14,
    hp: 2600,
    skills: loadout(44, 'bs-fist', 'bs-parry', 'bs-light', 'bs-internal'),
    drops: [
      { id: 'mat-fur', chance: 0.8 },
      { id: 'med-mid', chance: 0.5 },
    ],
    expReward: 1.4,
  }),
  n('wu-changfeng', '无常风', 50, {
    title: '毒手·百毒门弃徒',
    hostile: true,
    boost: 10,
    dialog: ['落霞谷的药田,正好炼我的百毒散!'],
    skills: loadout(52, 'tm-hidden1', 'bs-hidden', 'tm-zj', 'tm-qg', 'tm-neigong'),
    drops: [
      { id: 'w-plum', chance: 0.35 },
      { id: 'med-big', chance: 0.4 },
      { id: 'potential-pill', chance: 0.25 },
    ],
    silverReward: 3000,
  }),

  // ========== 第六章 · 云梦泽 ==========
  n('tang-xiaoyu', '唐小雨', 38, {
    title: '唐门外门执事',
    gender: 'female',
    boost: 6,
    dialog: [
      '唐门用毒亦用镖,入我门者,身法为先。',
      '身法不到二十五的,连暗器都掷不直,还是请回吧。',
    ],
    teach: ['bs-fist', 'bs-parry', 'bs-internal', 'bs-light', 'bs-hidden', 'bs-blade', 'bs-read'],
  }),
  n('tang-baicao', '唐百草', 40, {
    title: '唐门大师兄',
    boost: 4,
    dialog: ['小心我的镖——开玩笑的,切磋而已。'],
    skills: loadout(40, 'tm-hidden1', 'bs-hidden', 'tm-zj', 'tm-qg', 'tm-neigong'),
  }),
  n('marsh-bandit', '泽匪', 50, {
    hostile: true,
    dialog: ['留下买路财!'],
    drops: [
      { id: 'mat-iron', chance: 0.6 },
      { id: 'mat-fur', chance: 0.3 },
    ],
  }),
  n('luo-ba', '罗霸', 60, {
    title: '水寨主·水龙',
    hostile: true,
    boost: 12,
    dialog: ['云梦泽八百里,都是老子的!'],
    skills: loadout(62, 'bs-blade', 'bs-parry', 'bs-light', 'bs-internal'),
    drops: [
      { id: 'w-coldlight', chance: 0.35 },
      { id: 'a-body-chain', chance: 0.3 },
      { id: 'med-big', chance: 0.5 },
    ],
    silverReward: 5000,
  }),

  // ========== 第七章 · 松岩寺 ==========
  n('hui-jue', '慧觉', 45, {
    title: '松岩寺知客僧',
    boost: 6,
    dialog: [
      '阿弥陀佛。松岩寺乃嵩山古刹,只度有缘人。',
      '施主若有向佛之心,可剃度带发修行——寺中只收男弟子。',
    ],
    teach: ['bs-fist', 'bs-parry', 'bs-internal', 'bs-light', 'bs-blade', 'bs-staff', 'bs-read'],
  }),
  n('hui-ren', '慧忍', 46, {
    title: '松岩寺大师兄',
    boost: 4,
    dialog: ['武功再高,也怕菜刀;禅心若在,棍下留情。'],
    skills: loadout(46, 'sl-fist', 'bs-fist', 'sl-zj', 'sl-qg', 'sl-neigong'),
  }),
  n('sweeper-monk', '扫地老僧', 90, {
    title: '藏经楼杂役',
    boost: 30,
    dialog: [
      '扫地扫地,扫心地。心地不净,扫也无益。',
      '老衲在此扫了六十年,经卷丢了几本,倒是扫明白了几个字。',
    ],
    skills: loadout(95, 'bs-staff', 'bs-parry', 'bs-light', 'bs-internal'),
    gift: { likes: ['q-scripture'], reward: { exp: 20000, potential: 3000, flag: 'monk-blessing' } },
  }),
  n('vicious-monk', '恶僧', 60, {
    hostile: true,
    dialog: ['经卷是老子的,谁也别想拿回去!'],
    skills: loadout(62, 'bs-staff', 'bs-parry', 'bs-light', 'bs-internal'),
    drops: [{ id: 'mat-iron', chance: 0.6 }],
  }),
  n('hui-e', '慧恶', 70, {
    title: '堕僧·偷经人',
    hostile: true,
    boost: 12,
    dialog: ['慧字辈排到我就断了佛缘——那便索性入魔!'],
    skills: loadout(72, 'sl-blade', 'bs-blade', 'sl-zj', 'sl-qg', 'sl-neigong'),
    drops: [
      { id: 'q-taixu-1', chance: 1 },
      { id: 'w-yanling', chance: 0.35 },
      { id: 'bodhi-seed', chance: 0.15 },
    ],
    silverReward: 8000,
  }),

  // ========== 第八章 · 太行古道 ==========
  n('qing-feng', '清风真人', 55, {
    title: '紫霄宫游方道人',
    boost: 8,
    dialog: [
      '无量天尊。贫道自紫霄宫来,奉掌门之命下山寻访根骨清奇的有缘人。',
      '紫霄宫清修之地,只收男弟子,悟性不到三十的,经文都念不明白。',
    ],
    teach: ['bs-fist', 'bs-parry', 'bs-internal', 'bs-light', 'bs-sword', 'bs-read'],
  }),
  n('song-xinghe', '宋星河', 56, {
    title: '紫霄宫大师兄',
    boost: 4,
    dialog: [
      '拳打三分,步走七分。来,贫道陪你走两步。',
    ],
    skills: loadout(56, 'wd-fist1', 'bs-fist', 'wd-zj', 'wd-qg', 'wd-neigong'),
  }),
  n('road-soldier', '拦路残兵', 70, {
    hostile: true,
    dialog: ['此路不通!'],
    drops: [{ id: 'mat-iron', chance: 0.7 }],
  }),
  n('soldier-captain', '残兵头目', 80, {
    hostile: true,
    boost: 6,
    dialog: ['文书?拿命来换!'],
    skills: loadout(82, 'bs-blade', 'bs-parry', 'bs-light', 'bs-internal'),
    drops: [
      { id: 'q-permit', chance: 1 },
      { id: 'mat-fine-iron', chance: 0.3 },
    ],
  }),
  n('he-sanshao', '贺三刀', 85, {
    title: '黑风残魁·断岳刀',
    hostile: true,
    boost: 14,
    dialog: ['黑风寨倒了,可太虚残卷在我手里,谁也别想安生!'],
    skills: loadout(88, 'bs-blade', 'bs-parry', 'bs-light', 'bs-internal'),
    drops: [
      { id: 'w-pojun', chance: 0.25 },
      { id: 'a-body-brocade', chance: 0.2 },
      { id: 'med-big', chance: 0.6 },
      { id: 'potential-pill', chance: 0.3 },
    ],
    silverReward: 15000,
  }),

  // ========== 第九章 · 青崖峰 ==========
  n('lu-qingya', '陆青崖', 80, {
    title: '青崖剑派掌门',
    boost: 14,
    dialog: [
      '青崖剑派立派百年,只问剑,不问出身。',
      '徒儿,剑要磨,心也要磨。功课不可荒废。',
      '剑冢里的顾寒山又疯了三分……那柄残剑,不知还要守到何时。',
    ],
    teach: ['bs-fist', 'bs-parry', 'bs-internal', 'bs-light', 'bs-sword', 'bs-read'],
    skills: loadout(120, 'hs-sword2', 'bs-sword', 'hs-zj', 'hs-qg', 'hs-neigong'),
  }),
  n('sword-puppet', '守山剑傀', 90, {
    title: '剑冢机关',
    hostile: true,
    boost: 10,
    dialog: ['(木石关节咯吱作响,剑傀缓缓抬剑。)'],
    skills: loadout(92, 'hs-sword1', 'bs-sword', 'hs-zj', 'hs-qg', 'hs-neigong'),
    drops: [{ id: 'mat-fine-iron', chance: 0.5 }],
  }),
  n('gu-hanshan', '顾寒山', 100, {
    title: '守剑狂人·断剑',
    hostile: true,
    boost: 16,
    dialog: ['剑冢一步,生死自负!太虚残卷?休想!!'],
    skills: loadout(105, 'hs-sword2', 'bs-sword', 'hs-zj', 'hs-qg', 'hs-neigong'),
    drops: [
      { id: 'q-taixu-2', chance: 1 },
      { id: 'w-flowlight', chance: 0.3 },
      { id: 'bodhi-seed', chance: 0.2 },
    ],
    silverReward: 25000,
  }),

  // ========== 第十章 · 青州大城 ==========
  n('prefect-qing', '青州知府', 40, {
    dialog: ['黑风余孽盘踞北巷,府衙兵力捉襟见肘,还请义士相助!'],
    gift: { likes: ['mat-letter'], reward: { exp: 5000, silver: 2000 } },
  }),
  n('black-merchant', '黑市商人', 50, {
    title: '斗篷客',
    dialog: ['好东西不问来路。客官,看看?'],
    shop: [
      { id: 'wuxue-page', price: 8000 },
      { id: 'med-big', price: 2400 },
      { id: 'spirit-big', price: 1100 },
      { id: 'potential-pill', price: 20000 },
      { id: 'guard-pill', price: 1400 },
      { id: 'face-water', price: 2500 },
      { id: 'mat-fine-iron', price: 280 },
      { id: 'w-coldlight', price: 5500 },
      { id: 'w-yanling', price: 5500 },
      { id: 'w-bamboo', price: 5000 },
    ],
  }),
  n('teller-yuelai', '悦来楼说书人', 30, {
    dialog: [
      '列位看官,且听我说——那雷万钧纵横青州三十年,一双铁掌从未逢敌手!',
      '嘘……近来城里来了批黑衣人,腰牌上刻着一座楼。老朽多嘴一句:玄夜楼三个字,出了这个门可别念。',
    ],
  }),
  n('death-warrior', '黑风死士', 105, {
    hostile: true,
    boost: 10,
    dialog: ['雷爷的大事,容不得闲人!'],
    skills: loadout(108, 'bs-blade', 'bs-parry', 'bs-light', 'bs-internal'),
    drops: [{ id: 'mat-letter', chance: 0.8 }],
  }),
  n('iron-envoy', '铁掌使者', 115, {
    title: '雷万钧座下第一使者',
    hostile: true,
    boost: 12,
    dialog: ['见过我铁掌的,没有一个还能站着说话。'],
    skills: loadout(118, 'bs-fist', 'bs-parry', 'bs-light', 'bs-internal'),
    drops: [
      { id: 'med-big', chance: 0.5 },
      { id: 'potential-pill', chance: 0.35 },
    ],
  }),
  n('lei-wanjun', '雷万钧', 130, {
    title: '铁掌霸主',
    hostile: true,
    boost: 18,
    hp: 9000,
    dialog: [
      '太虚残卷三卷合一?哈哈哈,那是给玄夜楼准备的贡品!',
      '小子,你坏了大事……他们会来找你的,会来的……',
    ],
    skills: loadout(135, 'hs-palm', 'bs-fist', 'hs-zj', 'hs-qg', 'hs-neigong'),
    drops: [
      { id: 'q-taixu-3', chance: 1 },
      { id: 'a-body-brocade', chance: 0.4 },
      { id: 'bodhi-seed', chance: 0.3 },
    ],
    silverReward: 50000,
  }),

  // ========== 传承副本 · 荒谷 ==========
  n('rb-zealot', '黑风余孽死士', 300, {
    hostile: true,
    boost: 20,
    dialog: ['玄夜楼要的孩子,谁敢拦!'],
    skills: loadout(300, 'bs-blade', 'bs-parry', 'bs-light', 'bs-internal'),
    drops: [{ id: 'med-big', chance: 0.5 }],
  }),
  n('rb-child', '被掳的孩童', 1, {
    dialog: ['(孩子瑟缩在石室角落,眼里却没有怕。)'],
  }),
  n('rb-judge', '判官潘夔', 340, {
    title: '玄夜楼外围·铁面判官',
    hostile: true,
    boost: 24,
    dialog: ['玄夜楼办事,凡人莫问。'],
    skills: loadout(340, 'bs-fist', 'bs-parry', 'bs-light', 'bs-internal'),
    drops: [
      { id: 'med-big', chance: 0.8 },
      { id: 'potential-pill', chance: 0.5 },
    ],
    silverReward: 30000,
  }),

  // ========== 玄夜楼(传承后,青州北巷) ==========
  n('ye-weiyang', '夜未央', 150, {
    title: '玄夜楼主',
    gender: 'female',
    boost: 30,
    dialog: [
      '永夜将尽未死之人,自称玄夜。你坏了我的局,倒有几分意思。',
      '玄夜楼不收庸才。你若已历传承、看淡生死,楼门为你而开。',
    ],
    teach: ['bs-fist', 'bs-parry', 'bs-internal', 'bs-light', 'bs-sword', 'bs-blade', 'bs-hidden', 'bs-read'],
    skills: loadout(180, 'xy-sword', 'bs-sword', 'xy-zj', 'xy-qg', 'xy-neigong'),
  }),
  n('ye-shadow', '玄夜楼影卫', 140, {
    title: '玄夜楼大师姐',
    gender: 'female',
    boost: 10,
    dialog: ['楼里的规矩:影子不说话,只出刀。'],
    skills: loadout(140, 'xy-fist', 'bs-fist', 'xy-zj', 'xy-qg', 'xy-neigong'),
  }),
]

export const npcById = new Map(NPCS.map((x) => [x.id, x]))

export function npcName(id: string): string {
  return npcById.get(id)?.name ?? id
}
