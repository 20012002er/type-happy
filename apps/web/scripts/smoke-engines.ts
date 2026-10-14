/**
 * 引擎冒烟测试:在 Node 中模拟浏览器事件序列,验证核心判定逻辑。
 * 运行:pnpm --filter @type-happy/web exec tsx scripts/smoke-engines.ts
 */
import { useTypingEngine } from '../src/composables/useTypingEngine'
import { useChineseEngine } from '../src/composables/useChineseEngine'
import { WulinSim } from '../src/games/wulin/sim'
import { defaultSave, exportSave, importSave } from '../src/games/wulin/save'
import { charLevel, panel, rollOrigin, skillLevelCap } from '../src/games/wulin/sim/character'
import { expForLevel } from '../src/games/wulin/constants'

let failures = 0
let checks = 0

function assert(name: string, condition: boolean, detail?: unknown): void {
  checks++
  if (!condition) {
    failures++
    console.error(`FAIL ${name}`, detail !== undefined ? JSON.stringify(detail) : '')
  } else {
    console.log(`ok   ${name}`)
  }
}

function keyEvent(key: string, extra: Partial<KeyboardEvent> = {}): KeyboardEvent {
  return {
    key,
    isComposing: false,
    keyCode: key.length === 1 ? key.toUpperCase().charCodeAt(0) : 0,
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    preventDefault() {},
    ...extra,
  } as unknown as KeyboardEvent
}

function compEvent(type: 'start' | 'update' | 'end', data: string): CompositionEvent {
  return { type: `composition${type}`, data } as unknown as CompositionEvent
}

function inputEvent(data: string | null, isComposing: boolean): InputEvent {
  return { data, isComposing } as unknown as InputEvent
}

/* ---------------- useTypingEngine ---------------- */

{
  const engine = useTypingEngine('ab', { lessonId: 'smoke' })
  const { _test } = engine
  _test.handleKeydown(keyEvent('a'))
  assert('typing: 首键启动', engine.status.value === 'running')
  assert('typing: 正确判定', engine.chars.value[0]?.status === 'correct')
  _test.handleKeydown(keyEvent('x'))
  assert('typing: 错误判定', engine.chars.value[1]?.status === 'wrong')
  assert('typing: 错误后前进', engine.pos.value === 2)
  _test.handleKeydown(keyEvent('Backspace'))
  assert('typing: 退格回退', engine.pos.value === 1 && engine.chars.value[1]?.status === 'pending')
  _test.handleKeydown(keyEvent('b'))
  assert('typing: 完成', engine.status.value === 'finished')
  const r = engine.result.value
  assert('typing: 产出成绩', r !== null && r.lessonId === 'smoke')
  assert('typing: 准确率 2/3', r?.accuracy === 66.7, r?.accuracy)

  // IME 组合期间挂起
  const e2 = useTypingEngine('cd', { lessonId: 'smoke2' })
  e2._test.handleCompositionStart()
  e2._test.handleKeydown(keyEvent('c'))
  assert('typing: composition 期间挂起', e2.pos.value === 0)
  e2._test.handleCompositionEnd()
  e2._test.handleKeydown(keyEvent('c'))
  assert('typing: composition 结束恢复', e2.pos.value === 1)
  e2._test.handleKeydown(keyEvent('d', { isComposing: true }))
  assert('typing: isComposing keydown 忽略', e2.pos.value === 1)

  // 换行需要 Enter 确认
  const e3 = useTypingEngine('a\nb', { lessonId: 'smoke3' })
  e3._test.handleKeydown(keyEvent('a'))
  e3._test.handleKeydown(keyEvent('Enter'))
  assert('typing: Enter 匹配换行', e3.chars.value[1]?.status === 'correct')
  e3._test.handleKeydown(keyEvent('x'))
  assert('typing: 换行后继续', e3.chars.value[2]?.status === 'wrong')

  // restart
  e3.restart()
  assert('typing: restart 复位', e3.status.value === 'idle' && e3.pos.value === 0)
}

/* ---------------- useChineseEngine ---------------- */

const source = [
  { char: '你', pinyin: 'ni' },
  { char: '好', pinyin: 'hao' },
  { char: '，', pinyin: '，' },
  { char: '事', pinyin: 'shi' },
]

// Chrome 顺序:compositionend 在前,input(isComposing=false) 在后
{
  const engine = useChineseEngine(source, 'cn1')
  const t = engine._test
  t.handleCompositionStart(compEvent('start', ''))
  t.handleCompositionUpdate(compEvent('update', 'ni'))
  assert('cn: 组合中实时着色', engine.chars.value[0]?.letters[0] === 'match')
  t.handleCompositionUpdate(compEvent('update', 'nihao'))
  assert('cn: 跨字着色', engine.chars.value[1]?.letters[0] === 'match')
  t.handleCompositionEnd(compEvent('end', '你好'))
  t.handleInput(inputEvent('你好', false)) // Chrome 尾随 input,应被去重跳过
  assert(
    'cn: 双字上屏判定',
    engine.chars.value[0]?.status === 'correct' && engine.chars.value[1]?.status === 'correct',
  )
  assert('cn: 位置推进 2', engine.pos.value === 2)
  assert(
    'cn: 无重复判定(keystrokes=2)',
    engine.stats.accuracy.value === 100 && engine.progress.value.done === 2,
  )
}

// Safari 顺序:input(isComposing=false) 在前,compositionend 在后
{
  const engine = useChineseEngine(source, 'cn2')
  const t = engine._test
  t.handleCompositionStart(compEvent('start', ''))
  t.handleCompositionUpdate(compEvent('update', 'ni'))
  t.handleInput(inputEvent('你', false))
  assert(
    'cn(Safari): input 先行判定',
    engine.chars.value[0]?.status === 'correct' && engine.pos.value === 1,
  )
  t.handleCompositionEnd(compEvent('end', '你'))
  assert('cn(Safari): compositionend 去重', engine.pos.value === 1)
}

// 同音字:拼音匹配即正确(数据固定读音,不按字形)
{
  const engine = useChineseEngine(source, 'cn3')
  const t = engine._test
  t.handleCompositionStart(compEvent('start', ''))
  t.handleCompositionUpdate(compEvent('update', 'nihao'))
  t.handleCompositionEnd(compEvent('end', '拟耗'))
  assert(
    'cn: 同音字按拼音判对',
    engine.chars.value[0]?.status === 'correct' && engine.chars.value[1]?.status === 'correct',
  )
}

// 错误拼音:判错且不阻塞
{
  const engine = useChineseEngine(source, 'cn4')
  const t = engine._test
  t.handleCompositionStart(compEvent('start', ''))
  t.handleCompositionUpdate(compEvent('update', 'ma'))
  t.handleCompositionEnd(compEvent('end', '马'))
  assert('cn: 错误拼音判错', engine.chars.value[0]?.status === 'wrong')
  assert('cn: 判错后前进', engine.pos.value === 1)
}

// 标点直接上屏(input,无 composition)
{
  const engine = useChineseEngine(source, 'cn5')
  const t = engine._test
  t.handleCompositionStart(compEvent('start', ''))
  t.handleCompositionUpdate(compEvent('update', 'nihao'))
  t.handleCompositionEnd(compEvent('end', '你好'))
  t.handleInput(inputEvent('你好', false)) // Chrome 尾随 input(被去重消费)
  t.handleInput(inputEvent('，', false))
  assert('cn: 全角标点判对', engine.chars.value[2]?.status === 'correct' && engine.pos.value === 3)
}

// IME 关闭:手动拼音缓冲 + 空格兜底
{
  const engine = useChineseEngine(source, 'cn6')
  const t = engine._test
  t.handleInput(inputEvent('n', false))
  assert('cn: 手动前缀等待', engine.pos.value === 0 && engine.manualBuffer.value === 'n')
  t.handleInput(inputEvent('i', false))
  assert('cn: 手动完整匹配', engine.chars.value[0]?.status === 'correct' && engine.pos.value === 1)
  t.handleInput(inputEvent('h', false))
  t.handleInput(inputEvent('x', false))
  assert(
    'cn: 手动冲突判错前进',
    engine.chars.value[1]?.status === 'wrong' && engine.pos.value === 2,
  )
}

// 空格作为音节分隔兜底
{
  const engine = useChineseEngine(source, 'cn7')
  const t = engine._test
  t.handleInput(inputEvent('n', false))
  t.handleInput(inputEvent('i', false))
  assert('cn: 空格前已匹配', engine.pos.value === 1)
  t.handleInput(inputEvent('h', false))
  t.handleInput(inputEvent(' ', false))
  assert('cn: 不完整音节被空格清空', engine.pos.value === 1 && engine.manualBuffer.value === '')
}

// 退格修正与结算
{
  const engine = useChineseEngine([{ char: '你', pinyin: 'ni' }], 'cn8')
  const t = engine._test
  t.handleCompositionStart(compEvent('start', ''))
  t.handleCompositionUpdate(compEvent('update', 'ma'))
  t.handleCompositionEnd(compEvent('end', '马'))
  assert('cn: 判错后 finished', engine.status.value === 'finished')
  assert('cn: 结算成绩', engine.result.value !== null && engine.result.value.accuracy === 0)
  t.handleKeydown(keyEvent('Backspace'))
  assert('cn: finished 后退格无效', engine.pos.value === 1)
}

/* ---------------- wulin sim(放置武林) ---------------- */

{
  const save = defaultSave()
  const sim = new WulinSim(save)
  const r = rollOrigin('martial')
  sim.createCharacter('冒烟侠', 'male', 'martial', r.attrs, r.appearance, r.fortune)
  const char = save.char!
  assert(
    'wulin: 四维合计 80',
    char.innate.arm + char.innate.agi + char.innate.bone + char.innate.ins === 80,
    char.innate,
  )
  assert('wulin: 武学世家自带 20 级基本功', char.skills['bs-fist']?.level === 20)
  assert('wulin: 默认装备四基本功', char.equipped.output === 'bs-fist' && char.equipped.internal === 'bs-internal')

  const p = panel(char)
  assert('wulin: 面板数值为正', p.atk > 0 && p.hpMax > 0 && p.mpMax > 0 && p.speed > 0.2 && p.hit > 0, p)

  // 战斗:新手 vs lv3 狗腿
  const fightErr = sim.startFight('wang-lackey', 'duel')
  assert('wulin: 可发起战斗', fightErr === null, fightErr)
  for (let i = 0; i < 6000 && sim.combat && !sim.combat.state.over; i++) sim.tickCombat(0.05)
  assert('wulin: 击败 lv3 恶霸', sim.combat?.state.winner === 'player', sim.combat?.state.winner)
  sim.finishCombat()
  assert('wulin: 战斗获得经验', char.exp > 0, char.exp)
  assert('wulin: 战斗后无残留', sim.combat === null)

  // 武学等级上限规则:非基本 ≤ min(人物等级, 基本+1)
  char.skills['bs-sword'] = { level: 50, exp: 0, activeUnlocked: false }
  char.skills['pub-sword'] = { level: 1, exp: 0, activeUnlocked: false }
  const cap = skillLevelCap(char, 'pub-sword')
  assert('wulin: 武学受等级/基本功双重上限', cap === Math.min(charLevel(char), 51), { cap, lv: charLevel(char) })

  // 挂机 1 小时
  sim.startIdle('c1')
  const expBefore = char.exp
  sim.fastForward(3600e3)
  assert('wulin: 挂机一小时有经验', char.exp > expBefore, [expBefore, char.exp])

  // 离线结算:精神恢复 + 江湖快报
  const save2 = structuredClone(save)
  save2.char!.spirit = 0
  save2.lastSeen -= 36 * 60e3
  const sim2 = new WulinSim(save2)
  assert('wulin: 离线快报生成', sim2.offlineReport !== null && sim2.offlineReport.minutes >= 35)
  assert('wulin: 离线精神恢复至上限', save2.char!.spirit === 120, save2.char!.spirit)

  // 传承全流程
  char.exp = expForLevel(320)
  for (const k of ['bs-fist', 'bs-parry', 'bs-light', 'bs-internal']) {
    char.skills[k] = { level: 400, exp: 0, activeUnlocked: false }
  }
  assert('wulin: 320 级可开启传承', sim.rebirthAvailable())
  assert('wulin: 开启传承任务', sim.startRebirthQuest() === null)
  sim.travelTo('rb')
  assert('wulin: 抵达荒谷', save.progress.chapter === 'rb')
  const rbErr = sim.startFight('rb-judge', 'duel')
  assert('wulin: 可挑战判官', rbErr === null, rbErr)
  for (let i = 0; i < 20000 && sim.combat && !sim.combat.state.over; i++) sim.tickCombat(0.05)
  assert('wulin: 越级击败判官', sim.combat?.state.winner === 'player', sim.combat?.state.winner)
  sim.finishCombat()
  assert('wulin: 解救孩童(stage2)', save.rebirth.stage === 2 && !!save.rebirth.disciple)
  char.bag['med-gold'] = 5
  for (let i = 0; i < 80 && !sim.discipleReady(); i++) {
    char.spirit = 500
    for (const k of ['arm', 'agi', 'bone', 'ins'] as const) sim.trainDisciple(k)
    sim.fastForward(3600e3)
  }
  assert('wulin: 弟子四维圆满', sim.discipleReady())
  assert('wulin: 确认传承', sim.doRebirth('小冒烟') === null)
  assert('wulin: 传承后 1 世 + 30 属性点', char.rebirths === 1 && char.attrPoints === 30)
  assert('wulin: 新身姓名与等级重置', char.name === '小冒烟' && charLevel(char) < 10)
  assert('wulin: 武学清空仅留基本功 50 级', Object.keys(char.skills).length === 4 && char.skills['bs-fist']?.level === 50)
  assert('wulin: 物品保留', char.bag['med-gold'] === 5)

  // 存档导出导入往返
  const text = exportSave(save)
  const back = importSave(text)
  assert('wulin: 存档往返一致', back?.char?.name === '小冒烟' && back?.char?.rebirths === 1)
  assert('wulin: 损坏存档回退默认', importSave('not-a-save') === null)

  // 平衡探针:中局角色在 c10 的挂机时薪(速成档)
  char.exp = expForLevel(130)
  char.skills['bs-sword'] = { level: 150, exp: 0, activeUnlocked: false }
  char.skills['hs-sword2'] = { level: 130, exp: 0, activeUnlocked: false }
  char.equipped = { output: 'hs-sword2', internal: 'bs-internal', lightness: 'bs-light', parry: 'bs-parry' }
  const rate = sim.idleRateFor('c10')!
  console.log(`     [balance] c10 速成档挂机 ≈ ${Math.round(rate.exp)} exp/h,${Math.round(rate.silver)} 银/h`)
  assert('wulin: 中局挂机时薪在合理区间', rate.exp > 5000 && rate.exp < 800000, rate)
}

console.log(`\n${checks - failures}/${checks} passed`)
process.exit(failures > 0 ? 1 : 0)
