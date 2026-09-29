#!/usr/bin/env node
/**
 * 课程内容生成器:把紧凑的编写格式转换为 apps/server/src/data 下的关卡 JSON。
 *
 * 用法(在仓库任意位置):
 *   node apps/server/scripts/gen-content.mjs
 *
 * 编写格式:
 * - 指法/英文:textLesson(courseId, index, id, title, description, text, showKeyboard)
 * - 中文:pinyinLesson(courseId, index, id, title, description, text, pinyins)
 *   pinyins 为空格分隔的无声调拼音,按 text 中汉字出现顺序一一对应;
 *   非汉字(标点等)自动以字符本身占位,判分时按字符相等比对。
 *
 * 重新运行会清空三个课程目录下的旧 lesson-*.json 后全量重写。
 */
import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const dataDir = path.join(import.meta.dirname, '..', 'src', 'data')
const HAN_RE = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/

/** 中文语境标点归一化:汉字/数字后的半角标点转全角(IME 上屏的是全角) */
const FULL_PUNCT = {
  ',': '\uFF0C', // ,
  ';': '\uFF1B', // ;
  '!': '\uFF01', // !
  '?': '\uFF1F', // ?
}
const FULL_COLON = '\uFF1A' // :
function cnPunct(s) {
  return s
    .replace(/([\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff])([,;!?])/g, (_, c, p) => c + FULL_PUNCT[p])
    .replace(/([\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\d]):\s?/g, `$1${FULL_COLON}`)
}

const COURSES = ['fingering', 'english', 'chinese']

for (const courseId of COURSES) {
  const dir = path.join(dataDir, courseId)
  if (!dir) continue
  mkdirSync(dir, { recursive: true })
  for (const f of readdirSync(dir)) {
    if (f.endsWith('.json')) rmSync(path.join(dir, f))
  }
}

function writeLesson(courseId, index, lesson) {
  const dir = path.join(dataDir, courseId)
  mkdirSync(dir, { recursive: true })
  const num = String(index).padStart(2, '0')
  const file = path.join(dir, `lesson-${num}.json`)
  lesson.title = cnPunct(lesson.title)
  lesson.description = cnPunct(lesson.description)
  writeFileSync(file, `${JSON.stringify(lesson, null, 2)}\n`)
}

function textLesson(courseId, index, id, title, description, text, showKeyboard) {
  writeLesson(courseId, index, {
    id,
    courseId,
    index,
    title,
    description,
    content: { kind: 'text', text, showKeyboard },
  })
}

function pinyinLesson(courseId, index, id, title, description, text, pinyins) {
  const tokens = pinyins.trim().split(/\s+/)
  const chars = []
  let ti = 0
  for (const ch of cnPunct(text)) {
    if (HAN_RE.test(ch)) {
      const pinyin = tokens[ti]
      if (!pinyin) throw new Error(`${id}: 汉字「${ch}」缺少对应拼音`)
      if (!/^[a-zA-Z]+$/.test(pinyin)) {
        throw new Error(`${id}: 拼音「${pinyin}」应为纯字母(无声调)`)
      }
      chars.push({ char: ch, pinyin: pinyin.toLowerCase() })
      ti++
    } else if (ch === '\n') {
      throw new Error(`${id}: 中文关卡暂不支持换行,请用标点分句`)
    } else {
      chars.push({ char: ch, pinyin: ch })
    }
  }
  if (ti !== tokens.length) {
    throw new Error(`${id}: 拼音数量不匹配(汉字 ${ti} 个,拼音 ${tokens.length} 个)`)
  }
  writeLesson(courseId, index, {
    id,
    courseId,
    index,
    title,
    description,
    content: { kind: 'pinyin', chars },
  })
}

/* ---------------- 标准指法练习(20 关) ---------------- */

const fingering = [
  [
    '左手基准键 A S D F',
    '左手四指轻放基准键位:小指 A、无名指 S、中指 D、食指 F,击键后回到原位。',
    'aaa sss ddd fff\nasdf asdf fdsa fdsa\nadsf sadf dfas fasd\naf sf df ad fs da sa fa',
  ],
  [
    '右手基准键 J K L ;',
    '右手四指轻放基准键位:食指 J、中指 K、无名指 L、小指 ;。',
    'jjj kkk lll ;;;\njkl; jkl; ;lkj ;lkj\njlks kjls lskj klsj\n;j kj lj fj dj sj aj',
  ],
  [
    '双手基准键综合',
    '左右手基准键位混合练习,保持节奏均匀。',
    'asdf jkl; asdf jkl;\nfj dk sl a; fj dk sl a;\naskl dfj; sala djfk\nadd ssl fad jak las ask',
  ],
  [
    '食指区 G 与 H',
    '左右食指从基准键向上斜移半格击打 G 和 H,打完立即回位。',
    'fg jh gf hj fgjh jhgf\nfjfj gkgk hlhl fjgk\ng h g h fg hj gf jh\nasdfg jkl;h gfdsa h;lkj',
  ],
  [
    '食指扩展 R T Y U',
    '食指负责范围扩大:左手 R T,右手 Y U。',
    'fr ft ju jy frtf juky\nrt yh fu jy rtyh fuyj\ntr yt uf hj fg jy kt dr\ntrue jury fury try rut fry guy hurt',
  ],
  [
    '中指区 E 与 I',
    '左手中指向上击 E,右手中指向上击 I,注意手指弧度。',
    'de ki ek ik deki iked\ndede kiki eiei ikik\nride tire kite fire hire\ndied deed dire rite edit',
  ],
  [
    '无名指区 W 与 O',
    '左手无名指击 W,右手无名指击 O,这是最容易弱化的两根手指。',
    'sw lo ws ol swlo olws\nwo sow low owl how wow\nwood look soon fool show\nhowl slow who wool wall',
  ],
  [
    '小指区 Q 与 P',
    '小指力量最弱,击键要轻而准:左手 Q,右手 P。',
    'aq ;p qa ap aqap ;p;p\nqu pu ap pa aq ;p qu\nqueue quip pup pop pip\npeep prop quip queue papa',
  ],
  [
    '下排左手 Z X C V B',
    '下排键位向左下方斜移:Z X C V 与左食指负责的 B。',
    'az za sx xs dc cd fv vf\nvb bv zx cv xz vc azsx dcvf\nzip vex wax tax cab cob axe\nlazy dizzy cozy fuzzy exact',
  ],
  [
    '下排右手 N M 与标点',
    '下排右手区:N M 由右食指/中指负责,逗号和句号由中指、无名指负责。',
    'jn km ,. jnkm ,. /;\nman men noon nine mine fine\nname same game came mom\nnine men, ten moms. one moon, two lines.',
  ],
  [
    '小写字母综合复习',
    '26 个小写字母与最高频单词综合练习,巩固全部键位。',
    'as is at be by do go he if in it me my no of on or so to up us we\nthe and for are you not her was one our out day get has him his how\nman new now old see two way who boy did its let say she too use can',
  ],
  [
    '大写字母与 Shift(一)',
    '按住对侧 Shift 键输入大写字母:打左半区字母用右手小指按 Shift。',
    'Asdf Jkl; Asdf Dkfj Sldk Aa;\nAa Ss Dd Ff Gg Hh Jj Kk Ll ;;\nQq Ww Ee Rr Tt Yy Uu Ii Oo Pp\nZz Xx Cc Vv Bb Nn Mm AaSs DdFf',
  ],
  [
    '大写字母与 Shift(二)',
    '大写单词与人名练习,注意 Shift 用对侧小指。',
    'The And For You That With Have This From\nThey Know Want Been Good Much Just Like\nTom Ann Jim Sue Bob Eva Roy Kay Ivy Max\nMr. Smith, Mrs. Green, Miss White, Dr. Lee',
  ],
  [
    '数字排左手 1-5',
    '左手负责数字 1-5:小指 1、无名指 2、中指 3、食指 4 和 5。',
    '1 2 3 4 5 1 2 3 4 5\n11 22 33 44 55 12 34 51 23 45\n15 24 13 42 51 1234 4321 1524\na1 s2 d3 f4 g5 1a 2s 3d 4f 5g',
  ],
  [
    '数字排右手 6-0',
    '右手负责数字 6-0:食指 6 和 7、中指 8、无名指 9、小指 0。',
    '6 7 8 9 0 6 7 8 9 0\n66 77 88 99 00 67 89 60 78\n96 80 79 68 6789 9876 6098\nh6 j7 k8 l9 6h 7j 8k 9l 0;',
  ],
  [
    '数字综合练习',
    '整排数字混合练习,包含常见编号与年份。',
    '1234567890 0987654321\n10 20 30 40 50 60 70 80 90 100\n2020 2021 2022 2023 2024 2025 2026\n010 110 114 119 120 12345 54321 90210',
  ],
  [
    '常用符号(一)',
    '不需 Shift 的常用符号:逗号、句号、分号、引号、斜杠、方括号。',
    ", . ; ' / [ ] - =\na, b. c; d' e/ f[ g] h- i=\nthe cat, the dog; a bird.\nit's a dog's life, one/two\nthree-four five=six [test] 'quote'",
  ],
  [
    '常用符号(二)',
    '需要 Shift 的上档符号:感叹号、问号、@、#、$、% 等。',
    '! @ # $ % ^ & * ( ) _ + ~\n1! 2@ 3# 4$ 5% 6^ 7& 8* 9( 0)\nHello! Really? Yes, of course.\na-b_c=d ~e {key} | "value" <tag>\n20% of 100 = 20; (1+2)*3 = 9',
  ],
  [
    '综合短文: pangram',
    '经典全字母句,一句话覆盖 26 个字母。',
    'The quick brown fox jumps over the lazy dog.\nPack my box with five dozen liquor jugs.\nHow vexingly quick daft zebras jump!\nSphinx of black quartz, judge my vow.',
  ],
  [
    '综合短文:进阶挑战',
    '大小写、数字、符号混合的综合练习,检验你的指法成果。',
    'In 2026, typing is a basic skill; everyone can learn it.\nPractice 20 minutes a day, and your speed will grow.\nWell done! Keep going: 1, 2, 3... you can do it.\nEmail me at tom@example.com or call 010-12345678.',
  ],
]

fingering.forEach(([title, description, text], i) => {
  const index = i + 1
  textLesson(
    'fingering',
    index,
    `f-${String(index).padStart(2, '0')}`,
    title,
    description,
    text,
    true,
  )
})

/* ---------------- 英文练习(15 关) ---------------- */

const english = [
  [
    '小写字母表',
    '按顺序输入 26 个小写字母,再按键盘分区熟悉键位。',
    'abcdefghijklmnopqrstuvwxyz\nabcdefghijklmnopqrstuvwxyz\nqwertyuiop asdfghjkl zxcvbnm',
    true,
  ],
  [
    '大写字母表',
    '配合 Shift 输入大写字母与大小写组合。',
    'ABCDEFGHIJKLMNOPQRSTUVWXYZ\nAaBbCcDdEeFfGgHhIiJjKkLlMm\nNnOoPpQqRrSsTtUuVvWwXxYyZz',
    true,
  ],
  [
    '高频字母组合',
    '英文中使用频率最高的字母: e t a o i n s h r d l u。',
    'e t a o i n s h r d l u\nee tt aa oo ii nn ss hh rr dd ll uu\nte ea ao in os sh rd lu er at en\nthe and for are not you all can her',
    true,
  ],
  [
    '常见短单词',
    '三到四个字母的常见短单词,注意空格用拇指击打。',
    'cat dog run sit top hat pen cup map bus red sun sky one two six ten\nbig hot cold fast slow up down in on at by me we he she it is as if or',
    true,
  ],
  [
    '高频单词 100',
    '覆盖英文文本一半以上使用频率的核心单词。',
    'the be to of and a in that have it for not on with he as you do at\nthis but his by from they we say her she or an will my one all would\nthere their what so up out if about who get which go me when make can\nlike time no just him know take people into year your good some could\nthem see other than then now look only come its over think also back\nafter use two how our work first well way even new want because any\nthese give day most us great little world own old right big high different',
    false,
  ],
  [
    '日常主题词汇',
    '颜色、家人、时间与饮食等日常生活词汇。',
    'red orange yellow green blue purple black white brown pink gray\nmother father sister brother family friend teacher student child\nmorning afternoon evening night today tomorrow yesterday weekend\nbreakfast lunch dinner water milk coffee tea bread rice egg meat\napple banana orange grape fruit vegetable potato tomato onion',
    false,
  ],
  [
    '简单句练习',
    '简短完整的英文句子,注意大小写与句末标点。',
    'The cat sat on the mat.\nI like to read books at night.\nShe goes to school by bus every day.\nHe is my best friend.\nWe play games after dinner.\nThe sun rises in the east.\nPlease close the door behind you.\nMy mother makes the best soup in town.',
    false,
  ],
  [
    '英语谚语',
    '经典谚语,边打字边积累。',
    'Actions speak louder than words.\nAll that glitters is not gold.\nA journey of a thousand miles begins with a single step.\nBetter late than never.\nPractice makes perfect.\nWhere there is a will, there is a way.\nKnowledge is power.\nEvery cloud has a silver lining.',
    false,
  ],
  [
    '寓言:狐狸与葡萄',
    '伊索寓言改写短文。',
    'A hungry fox found some fine grapes hanging high on a vine.\nHe jumped again and again, but he could not reach them.\nAt last he turned away and said, "They are probably sour anyway."\nIt is easy to despise what you cannot have.',
    false,
  ],
  [
    '名著:爱丽丝漫游奇境',
    '刘易斯·卡罗尔(1865),公版作品节选。',
    "Alice was beginning to get very tired of sitting by her sister\non the bank, and of having nothing to do: once or twice she had\npeeped into the book her sister was reading, but it had no pictures\nor conversations in it, 'and what is the use of a book,' thought\nAlice 'without pictures or conversation?'",
    false,
  ],
  [
    '名著:福尔摩斯探案集',
    '柯南·道尔《波希米亚丑闻》开头(1892),公版作品节选。',
    'To Sherlock Holmes she is always the woman. I have seldom heard\nhim mention her under any other name. In his eyes she eclipses and\npredominates the whole of her sex. It was not that he felt any emotion\nakin to love for Irene Adler.',
    false,
  ],
  [
    '名著:了不起的盖茨比',
    '菲茨杰拉德(1925),公版作品开头节选。',
    'In my younger and more vulnerable years my father gave me some\nadvice that I\'ve been turning over in my mind ever since.\n"Whenever you feel like criticizing anyone," he told me,\n"just remember that all the people in this world haven\'t had the\nadvantages that you\'ve had."',
    false,
  ],
  [
    '名著:傲慢与偏见',
    '简·奥斯汀(1813),公版作品开头名句。',
    'It is a truth universally acknowledged, that a single man in\npossession of a good fortune, must be in want of a wife.\nHowever little known the feelings or views of such a man may be\non his first entering a neighbourhood, this truth is so well fixed\nin the minds of the surrounding families.',
    false,
  ],
  [
    '综合练习:打字心得',
    '中等长度自编短文,巩固日常输入。',
    'Typing is a skill that anyone can learn. With a little practice\nevery day, your fingers will find the keys without looking.\nSit up straight, rest your feet on the floor, and keep your wrists\nrelaxed. Look at the screen, not at the keyboard. Speed will come\nwith time; accuracy must come first.',
    false,
  ],
  [
    '挑战:双城记开篇',
    '狄更斯(1859),公版作品著名开篇,长文挑战。',
    'It was the best of times, it was the worst of times, it was the age\nof wisdom, it was the age of foolishness, it was the epoch of belief,\nit was the epoch of incredulity, it was the season of Light, it was\nthe season of Darkness, it was the spring of hope, it was the winter\nof despair, we had everything before us, we had nothing before us.',
    false,
  ],
]

english.forEach(([title, description, text, showKeyboard], i) => {
  const index = i + 1
  textLesson(
    'english',
    index,
    `e-${String(index).padStart(2, '0')}`,
    title,
    description,
    text,
    showKeyboard,
  )
})

/* ---------------- 中文练习(15 关) ---------------- */

const chinese = [
  [
    '单音节入门',
    '每个汉字一个音节,用拼音输入法逐字输入,熟悉基本音节。',
    '啊喔鹅衣乌鱼马大米土木火',
    'a o e yi wu yu ma da mi tu mu huo',
  ],
  [
    '声母与韵母',
    '常见声母韵母组合: b p m f、d t n l、g k h、j q x。',
    '八怕妈发大他拿拉哥科喝鸡七西',
    'ba pa ma fa da ta na la ge ke he ji qi xi',
  ],
  [
    '最常用的汉字',
    '使用频率最高的一批汉字,日常输入的基石。',
    '你好我他是的了在有不这人中大',
    'ni hao wo ta shi de le zai you bu zhe ren zhong da',
  ],
  [
    '双音节常用词',
    '常用双音节词语,可逐字输入,也可以整词输入。',
    '你好谢谢妈妈爸爸老师学生中国朋友',
    'ni hao xie xie ma ma ba ba lao shi xue sheng zhong guo peng you',
  ],
  [
    '数字与方位',
    '数字一到十与常见方位词。',
    '一二三四五六七八九十上下左右前后',
    'yi er san si wu liu qi ba jiu shi shang xia zuo you qian hou',
  ],
  [
    '日常用语词汇',
    '时间与日常交流中最常用的词语。',
    '今天明天昨天时间什么我们你们他们现在知道',
    'jin tian ming tian zuo tian shi jian shen me wo men ni men ta men xian zai zhi dao',
  ],
  [
    '四字成语',
    '常用四字成语,练习连续多音节输入。',
    '一心一意四面八方万紫千红春暖花开山清水秀十全十美',
    'yi xin yi yi si mian ba fang wan zi qian hong chun nuan hua kai shan qing shui xiu shi quan shi mei',
  ],
  [
    '简单短句',
    '带标点的简单短句,标点由输入法直接上屏。',
    '我爱打字练习。你今天好吗?我很开心。',
    'wo ai da zi lian xi ni jin tian hao ma wo hen kai xin',
  ],
  [
    '生活短句',
    '描述日常生活的短句,包含逗号与句号。',
    '早上我去学校,下午回家写作业。晚上和妈妈一起吃饭。',
    'zao shang wo qu xue xiao xia wu hui jia xie zuo ye wan shang he ma ma yi qi chi fan',
  ],
  [
    '古诗:咏鹅',
    '骆宾王《咏鹅》,拼音输入的经典入门篇目。',
    '鹅,鹅,鹅,曲项向天歌。白毛浮绿水,红掌拨清波。',
    'e e e qu xiang xiang tian ge bai mao fu lu shui hong zhang bo qing bo',
  ],
  [
    '古诗:静夜思',
    '李白《静夜思》,注意后鼻音音节。',
    '床前明月光,疑是地上霜。举头望明月,低头思故乡。',
    'chuang qian ming yue guang yi shi di shang shuang ju tou wang ming yue di tou si gu xiang',
  ],
  [
    '古诗:悯农',
    '李绅《悯农》,体会平翘舌音的切换。',
    '锄禾日当午,汗滴禾下土。谁知盘中餐,粒粒皆辛苦。',
    'chu he ri dang wu han di he xia tu shui zhi pan zhong can li li jie xin ku',
  ],
  [
    '短文:四季',
    '描写四季的自编短文,篇幅适中。',
    '春天来了,花园里开满了花。夏天很热,我们喜欢去游泳。秋天凉快,树叶慢慢变黄。冬天下雪,孩子们在雪地里玩。',
    'chun tian lai le hua yuan li kai man le hua xia tian hen re wo men xi huan qu you yong qiu tian liang kuai shu ye man man bian huang dong tian xia xue hai zi men zai xue di li wan',
  ],
  [
    '短文:坚持练习',
    '关于练习方法的短文,综合检验拼音输入。',
    '打字是一项有用的技能。开始的时候可能很慢,但是不要着急。只要每天坚持练习,手指就会越来越灵活。相信你自己,一定能练成快速的输入。',
    'da zi shi yi xiang you yong de ji neng kai shi de shi hou ke neng hen man dan shi bu yao zhao ji zhi yao mei tian jian chi lian xi shou zhi jiu hui yue lai yue ling huo xiang xin ni zi ji yi ding neng lian cheng kuai su de shu ru',
  ],
  [
    '综合挑战:长文',
    '综合长文挑战,涵盖常见音节、词语与全部标点。',
    '打字练习需要耐心和坚持。先从简单的音节开始,再练词语和短句,最后挑战完整的文章。姿势要端正,手腕要放松,眼睛看着屏幕上的文字。每天练习十五分钟,一个月之后,你会发现自己进步了很多。加油,相信你一定能成为打字高手!',
    'da zi lian xi xu yao nai xin he jian chi xian cong jian dan de yin jie kai shi zai lian ci yu he duan ju zui hou tiao zhan wan zheng de wen zhang zi shi yao duan zheng shou wan yao fang song yan jing kan zhe ping mu shang de wen zi mei tian lian xi shi wu fen zhong yi ge yue zhi hou ni hui fa xian zi ji jin bu le hen duo jia you xiang xin ni yi ding neng cheng wei da zi gao shou',
  ],
]

chinese.forEach(([title, description, text, pinyins], i) => {
  const index = i + 1
  pinyinLesson(
    'chinese',
    index,
    `c-${String(index).padStart(2, '0')}`,
    title,
    description,
    text,
    pinyins,
  )
})

/* ---------------- 汇总 ---------------- */

for (const courseId of COURSES) {
  const dir = path.join(dataDir, courseId)
  const count = readdirSync(dir).filter((f) => f.endsWith('.json')).length
  console.log(`${courseId}: ${count} 关`)
}
console.log('内容生成完成 →', dataDir)
