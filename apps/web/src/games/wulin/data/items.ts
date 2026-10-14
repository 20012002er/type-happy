import type { ArmorSlot, ItemDef, WeaponType } from '../types'

const w = (
  id: string,
  name: string,
  type: WeaponType,
  atk: number,
  weight: number,
  price: number | null,
  desc: string,
): ItemDef => ({
  id,
  name,
  kind: 'weapon',
  weapon: { type, atk, weight },
  price: price ?? undefined,
  desc,
})

const a = (id: string, name: string, slot: ArmorSlot, def: number, prot: number, price: number | null, desc: string): ItemDef => ({
  id,
  name,
  kind: 'armor',
  armor: { slot, def, prot },
  price: price ?? undefined,
  desc,
})

const c = (id: string, name: string, use: NonNullable<ItemDef['use']>, price: number | null, desc: string): ItemDef => ({
  id,
  name,
  kind: 'consumable',
  use,
  price: price ?? undefined,
  desc,
})

const m = (id: string, name: string, price: number, desc: string): ItemDef => ({
  id,
  name,
  kind: 'material',
  price,
  desc,
})

const q = (id: string, name: string, desc: string): ItemDef => ({ id, name, kind: 'quest', desc })

export const ITEMS: ItemDef[] = [
  // ===== 武器 =====
  w('w-iron-sword', '铁剑', 'sword', 15, 4, 400, '寻常铁匠打造的长剑,入门够用。'),
  w('w-bluesteel', '青钢剑', 'sword', 32, 5, 1500, '青钢锻成,剑身泛青光。'),
  w('w-coldlight', '寒光剑', 'sword', 60, 4, 6000, '剑出如寒潭映月,锋锐异常。'),
  w('w-flowlight', '流光剑', 'sword', 95, 5, 20000, '剑光流转如水,削铁如泥。'),
  w('w-taixu', '太虚剑', 'sword', 150, 3, null, '相传为太虚剑典铸剑师遗作,轻若无物。'),
  w('w-iron-blade', '铁刀', 'blade', 16, 5, 400, '厚背铁刀,劈砍势沉。'),
  w('w-willow', '柳叶刀', 'blade', 34, 6, 1500, '刀身狭长如柳叶,轻快凌厉。'),
  w('w-yanling', '雁翎刀', 'blade', 62, 7, 6000, '军中制式雁翎刀,势大力沉。'),
  w('w-pojun', '破军刀', 'blade', 100, 12, 20000, '重逾三十斤,非臂力过人者不能舞。'),
  w('w-wax-staff', '白蜡杆', 'staff', 13, 4, 350, '韧劲十足的白蜡木长棍。'),
  w('w-steel-staff', '镔铁棍', 'staff', 30, 8, 1400, '镔铁打造,横扫千军。'),
  w('w-bamboo', '青竹棒', 'staff', 55, 3, 5500, '百年青竹,轻灵坚韧,打狗亦打虎。'),
  w('w-xuantie', '玄铁棍', 'staff', 90, 15, 18000, '玄铁铸就,棍风过处草木皆折。'),
  w('w-long-whip', '长鞭', 'whip', 12, 3, 380, '牛皮长鞭,可及丈余。'),
  w('w-nine-section', '九节鞭', 'whip', 48, 4, 5800, '九节钢鞭,收如尺、放如龙。'),
  w('w-bronze-ring', '铜环', 'ring', 14, 2, 400, '成对铜环,环声慑人。'),
  w('w-twin-ring', '子母环', 'ring', 46, 3, 5600, '环中套环,招式诡变难防。'),
  w('w-dart', '飞蝗石', 'hidden', 11, 1, 300, '打磨光滑的飞石,撒手伤人。'),
  w('w-plum', '梅花镖', 'hidden', 42, 1, 5200, '五棱梅花形飞镖,见血封喉。'),

  // ===== 防具 =====
  a('a-head-cloth', '头巾', 'head', 2, 1, 100, '粗布头巾,聊胜于无。'),
  a('a-head-leather', '皮盔', 'head', 6, 3, 600, '硬皮缝制的轻盔。'),
  a('a-head-iron', '铁盔', 'head', 13, 6, 2500, '军中铁盔,可挡刀箭。'),
  a('a-head-jade', '白玉冠', 'head', 22, 10, 9000, '温润白玉冠,内衬软铁。'),
  a('a-body-cloth', '粗布衣', 'body', 3, 2, 150, '庄稼汉的粗布衣裳。'),
  a('a-body-short', '短打劲装', 'body', 9, 4, 800, '利落短打,行走江湖的常备装束。'),
  a('a-body-leather', '皮甲', 'body', 18, 9, 3200, '硝制兽皮缝成的轻甲。'),
  a('a-body-chain', '锁子甲', 'body', 32, 16, 12000, '铁环相扣,刀枪难入。'),
  a('a-body-brocade', '锦缎战袍', 'body', 50, 24, 30000, '外锦内铁,名贵而不失防护。'),
  a('a-hands-cloth', '布护腕', 'hands', 2, 1, 80, '缠手的粗布护腕。'),
  a('a-hands-leather', '皮护腕', 'hands', 7, 3, 700, '硬皮护腕,格挡利器。'),
  a('a-hands-iron', '铁护腕', 'hands', 14, 7, 2800, '铁叶护腕,出手带风。'),
  a('a-legs-cloth', '布裤', 'legs', 2, 1, 80, '寻常布裤。'),
  a('a-legs-leather', '皮护腿', 'legs', 7, 3, 700, '护住双腿的硬皮。'),
  a('a-legs-iron', '铁护腿', 'legs', 14, 7, 2800, '铁片护腿,下盘沉稳。'),
  a('a-feet-straw', '草鞋', 'feet', 1, 1, 30, '一双草鞋,走十里山路。'),
  a('a-feet-cloth', '布鞋', 'feet', 5, 2, 500, '千层底布鞋。'),
  a('a-feet-fast', '快靴', 'feet', 11, 5, 2200, '轻软快靴,健步如飞。'),
  a('a-feet-cloud', '踏云靴', 'feet', 19, 9, 8500, '靴底衬云母片,踏雪无痕。'),

  // ===== 消耗品 =====
  c('food-bun', '馒头', { hp: 40 }, 5, '大白馒头,顶饱又止血。'),
  c('food-dry', '干粮', { hp: 100 }, 15, '风干的麦饼,行路必备。'),
  c('med-gold', '金创药', { hp: 300, injury: 40 }, 200, '外敷内服的伤药,祛瘀生新。'),
  c('med-mid', '小还丹', { hp: 900, injury: 100 }, 800, '药香扑鼻的疗伤丹药。'),
  c('med-big', '大还丹', { hp: 2200, injury: 250 }, 2500, '阎王叫你三更走,大还丹留人到五更。'),
  c('mp-small', '内力丹', { mp: 250 }, 150, '服下后内力涌动。'),
  c('mp-pill', '小还元丹', { mp: 900 }, 600, '回复大量内力。'),
  c('spirit-small', '回神丹', { spirit: 50 }, 300, '提神醒脑,练功必备。'),
  c('spirit-big', '醉梦生', { spirit: 150 }, 1200, '醉里挑灯练剑,一觉精神百倍。'),
  c('potential-pill', '潜能丹', { potential: 600 }, null, '服用后潜力涌动,可遇不可求。'),
  c('guard-pill', '静心丸', {}, 1500, '闭关时服用,心神澄澈,不会走火入魔。'),
  c('bodhi-seed', '菩提子', { mpMax: 30 }, null, '高僧圆寂后所留,服之内力上限永久 +30。'),
  c('face-water', '洗颜水', {}, 2500, '宫廷秘方,容貌 +2。'),
  c('wuxue-page', '武学残页', {}, null, '残缺的武学秘要,可对一门武学参悟主动招式。'),

  // ===== 材料 =====
  m('mat-iron', '碎铁', 50, '兵械碎片,铁匠收这个。'),
  m('mat-fur', '狼皮', 80, '完整的狼皮,货栈收这个。'),
  m('mat-token', '匪牌', 120, '黑风寨的腰牌,官府悬价收购。'),
  m('mat-pouch', '贼赃', 150, '飞贼落下的赃物包裹。'),
  m('mat-letter', '黑风密信', 200, '黑风寨往来的密信,似有隐情。'),
  m('mat-fine-iron', '精铁', 300, '百炼精铁,锻造上品兵器的材料。'),

  // ===== 任务物品 =====
  q('q-hairpin', '银簪', '周家女儿的银簪,老周托付你寻回。'),
  q('q-ledger', '黑账本', '钱万斤勾结匪类的账目,铁证如山。'),
  q('q-herb', '九叶兰', '解百毒的罕见草药,生于阴湿石缝。'),
  q('q-cargo', '沉船货物', '沉船里打捞的货箱,物主必有重谢。'),
  q('q-scripture', '无字经卷', '藏经楼失窃的经卷,竟是无字天书。'),
  q('q-permit', '通关文书', '太行古道的通行文书,没有它寸步难行。'),
  q('q-inscription', '古剑铭', '剑冢石壁上的古老剑铭,隐含剑意。'),
  q('q-taixu-1', '残卷·太虚(上)', '太虚剑典残卷上篇,隐有剑鸣。'),
  q('q-taixu-2', '残卷·太虚(中)', '太虚剑典残卷中篇,剑意渐显。'),
  q('q-taixu-3', '残卷·太虚(下)', '太虚剑典残卷下篇,三卷合一可参悟太虚剑典。'),
  q('q-key-copper', '铜钥匙', '开启荒谷石室的铜钥匙。'),
]

export const itemById = new Map(ITEMS.map((i) => [i.id, i]))

export function itemName(id: string): string {
  return itemById.get(id)?.name ?? id
}
