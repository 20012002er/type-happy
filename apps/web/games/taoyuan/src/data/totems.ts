import type { Weather } from '@/types'

/**
 * 天气图腾。
 *
 * 原本只有雨图腾一种，且价格低到失去调度意义。
 * 现在每种天气各一枚，定价统一提到五千档——它应当是「关键时刻花大钱买确定性」的手段，
 * 而不是随手就能刷天气的廉价道具。
 */
export interface TotemDef {
  id: string
  name: string
  /** 使用后指定的次日天气 */
  weather: Weather
  description: string
  /** 商店基准售价 */
  price: number
  /** 出售给商店的价格 */
  sellPrice: number
}

/** 图腾基准价 */
export const TOTEM_BASE_PRICE = 5000

export const WEATHER_TOTEMS: TotemDef[] = [
  {
    id: 'rain_totem',
    name: '雨图腾',
    weather: 'rainy',
    description: '祈来一场好雨。次日下雨，田里不必浇水。',
    price: TOTEM_BASE_PRICE,
    sellPrice: 1500
  },
  {
    id: 'sun_totem',
    name: '晴图腾',
    weather: 'sunny',
    description: '拨云见日。次日放晴，适合出门远行或办事。',
    price: TOTEM_BASE_PRICE,
    sellPrice: 1500
  },
  {
    id: 'storm_totem',
    name: '雷图腾',
    weather: 'stormy',
    description: '召来雷雨。次日雷雨交加，避雷针可收取电池。',
    price: Math.round(TOTEM_BASE_PRICE * 1.4),
    sellPrice: 2100
  },
  {
    id: 'snow_totem',
    name: '雪图腾',
    weather: 'snowy',
    description: '唤起风雪。次日落雪，冬季限定的景致与产出。',
    price: Math.round(TOTEM_BASE_PRICE * 1.2),
    sellPrice: 1800
  },
  {
    id: 'wind_totem',
    name: '风图腾',
    weather: 'windy',
    description: '起一阵大风。次日刮风，林间容易吹落好东西。',
    price: Math.round(TOTEM_BASE_PRICE * 0.8),
    sellPrice: 1200
  },
  {
    id: 'green_rain_totem',
    name: '碧雨图腾',
    weather: 'green_rain',
    description: '引动罕见的绿雨。次日降下碧色之雨，山野异变频生。',
    price: TOTEM_BASE_PRICE * 4,
    sellPrice: 6000
  }
]

/** 按物品ID查找图腾 */
export const getTotemById = (id: string): TotemDef | undefined => {
  return WEATHER_TOTEMS.find(t => t.id === id)
}

/** 所有图腾物品ID */
export const TOTEM_IDS: string[] = WEATHER_TOTEMS.map(t => t.id)
