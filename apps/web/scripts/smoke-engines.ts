/**
 * 引擎冒烟测试:在 Node 中模拟浏览器事件序列,验证核心判定逻辑。
 * 运行:pnpm --filter @type-happy/web exec tsx scripts/smoke-engines.ts
 */
import { useTypingEngine } from '../src/composables/useTypingEngine'
import { useChineseEngine } from '../src/composables/useChineseEngine'

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

console.log(`\n${checks - failures}/${checks} passed`)
process.exit(failures > 0 ? 1 : 0)
