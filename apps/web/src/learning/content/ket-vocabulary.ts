import { parseCourse } from '../contracts'
import type { Course, CourseUnit, KnowledgePoint } from '../types'

const KET_COURSE_ID = 'ket-core-vocabulary-english'

/**
 * KET（剑桥 A2 Key）核心词汇级别：按主题组织单元，每单元 15 词。
 * 独立于年级学期体系，grade/semester 仅为满足课程契约的名义分类值，
 * 通过 track: 'vocab-level' 标记，不参与学期可用性表。
 * 第 1 批覆盖 17 个主题单元，后续批次继续扩充。
 */
const themes: readonly { id: string; title: string }[] = [
  { id: 'ket-vocab-01-personal-info', title: '个人信息' },
  { id: 'ket-vocab-02-family', title: '家庭与朋友' },
  { id: 'ket-vocab-03-home', title: '家居与房间' },
  { id: 'ket-vocab-04-daily-life', title: '日常生活' },
  { id: 'ket-vocab-05-school', title: '学校与学习' },
  { id: 'ket-vocab-06-food', title: '食物' },
  { id: 'ket-vocab-07-fruit-vegetables', title: '水果与蔬菜' },
  { id: 'ket-vocab-08-drinks', title: '饮品' },
  { id: 'ket-vocab-09-clothes', title: '服装' },
  { id: 'ket-vocab-10-body-health', title: '身体与健康' },
  { id: 'ket-vocab-11-animals', title: '动物' },
  { id: 'ket-vocab-12-weather', title: '天气与季节' },
  { id: 'ket-vocab-13-places', title: '城镇场所' },
  { id: 'ket-vocab-14-transport', title: '交通与旅行' },
  { id: 'ket-vocab-15-shopping', title: '购物与金钱' },
  { id: 'ket-vocab-16-time', title: '时间与日期' },
  { id: 'ket-vocab-17-hobbies', title: '爱好与运动' },
]

const units: readonly CourseUnit[] = themes.map((theme, index) => ({
  id: theme.id,
  title: theme.title,
  order: index + 1,
}))

const knowledgePoints: readonly KnowledgePoint[] = themes.flatMap((theme) => [
  {
    id: `${theme.id}-vocabulary`,
    courseId: KET_COURSE_ID,
    unitId: theme.id,
    name: `${theme.title}核心词汇`,
    source: 'new-pep',
    ability: 'english-vocabulary',
  },
  {
    id: `${theme.id}-sentences`,
    courseId: KET_COURSE_ID,
    unitId: theme.id,
    name: `${theme.title}句型语法`,
    source: 'new-pep',
    ability: 'english-sentence-grammar',
  },
  {
    id: `${theme.id}-context`,
    courseId: KET_COURSE_ID,
    unitId: theme.id,
    name: `${theme.title}情境运用`,
    source: 'new-pep',
    ability: 'english-situational',
  },
])

const ketCoreVocabulary = {
  id: KET_COURSE_ID,
  version: 1,
  title: 'KET 核心词汇',
  subject: 'english',
  grade: 6,
  semester: 'autumn',
  textbook: '剑桥 A2 Key 词表',
  track: 'vocab-level',
  units,
  knowledgePoints,
} satisfies Course

export const KET_CORE_VOCABULARY_COURSE: Course = parseCourse(ketCoreVocabulary)
