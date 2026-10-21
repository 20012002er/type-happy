export interface GameMeta {
  id: string
  title: string
  desc: string
  to: string
  /** 封面渐变背景(Tailwind gradient 类) */
  gradient: string
  /** 封面 emoji 徽标 */
  badge: string
  /** 成绩展示定制(放置类无连击概念) */
  stats?: { scoreLabel?: string; playsUnit?: string; hideCombo?: boolean }
}

/** 全部游戏元数据:首页宣传区与游戏列表页共用 */
export const GAMES: GameMeta[] = [
  {
    id: 'balloon',
    title: '打字消气球',
    desc: '彩色气球从底部升起,每个气球带一个键位。按下对应键位扎破气球,别让它们飘到顶部!',
    to: '/games/balloon',
    gradient: 'from-sky-400 to-brand-400',
    badge: '🎈',
  },
  {
    id: 'duck',
    title: '打字打鸭子',
    desc: '鸭子从草丛中飞出,身上带一个键位。按下对应键位,让猎人开枪击落它们,别让鸭子飞走!',
    to: '/games/duck',
    gradient: 'from-lime-400 to-emerald-500',
    badge: '🦆',
  },
  {
    id: 'fighter',
    title: '打字街霸',
    desc: '隆 VS 肯!限时打出随机英文单词即可出招:短词波动拳、中词龙卷旋风脚、长词升龙拳;打错或超时会被反击。先打空对方血量获胜!',
    to: '/games/fighter',
    gradient: 'from-orange-400 to-rose-500',
    badge: '🥋',
  },
  {
    id: 'idle',
    title: '放置刷装备',
    desc: '全随机的放置类刷装备小游戏:挂机打怪、掉落随机词条装备、强化升级,看看你能刷出什么样的极品!(开源游戏 vue-idle-game)',
    to: '/games/idle',
    gradient: 'from-violet-400 to-fuchsia-500',
    badge: '⚔️',
  },
  {
    id: 'doodle',
    title: '涂鸦跳跃',
    desc: '逆向重制版 Doodle Jump:倾斜/键盘移动、点击射击,踩平台躲怪物吃道具一路向上。纯本地运行,成绩与进度只存在浏览器里。',
    to: '/games/doodle',
    gradient: 'from-lime-300 to-green-500',
    badge: '🐸',
  },
  {
    id: 'wulin',
    title: '放置武林',
    desc: '水墨武侠放置 RPG(玩法致敬《放置江湖》):闯十章节地图、拜七大门派、修五十余式武学,挂机历练、闭关练功、三世传承,离线也在成长!(自研 Vue + PixiJS)',
    to: '/games/wulin',
    gradient: 'from-amber-400 to-rose-500',
    badge: '🏯',
    stats: { scoreLabel: '最高评价', playsUnit: '次', hideCombo: true },
  },
  {
    id: 'taoyuan',
    title: '桃源乡',
    desc: '像素中国风田园模拟经营:春耕夏种秋收冬藏,38种作物、19种动物、120层矿洞、34位村民、钓鱼育种烹饪加工,四季轮回中经营你的世外桃源!(自研 Vue + Pinia + Tone.js)',
    to: '/games/taoyuan',
    gradient: 'from-emerald-400 to-teal-600',
    badge: '🌸',
    stats: { scoreLabel: '最高评价', playsUnit: '次', hideCombo: true },
  },
]
