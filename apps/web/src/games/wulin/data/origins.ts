import type { OriginDef } from '../types'

export const ORIGINS: OriginDef[] = [
  {
    id: 'orphan',
    name: '孤儿',
    desc: '父母双亡,吃百家饭长大。福缘额外 +5,但四维上限只有 25。江湖路苦,运气是最好的护身符。',
    cap: 25,
    fortuneBonus: 5,
    startItems: [{ id: 'food-bun', count: 3 }],
  },
  {
    id: 'martial',
    name: '武学世家',
    desc: '祖上三代走镖护院。臂力、身法上限 30,自带 20 级基本拳脚/招架/内功/轻功。',
    cap: 25,
    capOverride: { arm: 30, agi: 30 },
    startSkills: [
      { id: 'bs-fist', level: 20 },
      { id: 'bs-parry', level: 20 },
      { id: 'bs-internal', level: 20 },
      { id: 'bs-light', level: 20 },
    ],
    startItems: [{ id: 'w-iron-sword', count: 1 }],
  },
  {
    id: 'scholar',
    name: '书香门第',
    desc: '世代读书人家。悟性、根骨上限 30,自带 50 级读书识字,容貌偏高(福缘相应减少)。',
    cap: 25,
    capOverride: { ins: 30, bone: 30 },
    startSkills: [{ id: 'bs-read', level: 50 }],
    startItems: [{ id: 'food-bun', count: 2 }],
  },
  {
    id: 'merchant',
    name: '商贾之家',
    desc: '家道中落的商户子弟。四维上限 25,但揣着 1000 碎银闯江湖。',
    cap: 25,
    silver: 1000,
    startItems: [{ id: 'med-gold', count: 3 }],
  },
]

export const originById = new Map(ORIGINS.map((o) => [o.id, o]))
