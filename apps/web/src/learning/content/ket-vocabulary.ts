import { parseCourse } from '../contracts'
import type { Course, CourseUnit, KnowledgePoint } from '../types'

const KET_COURSE_ID = 'ket-core-vocabulary-english'

/**
 * KET（剑桥 A2 Key）核心词汇级别：按主题组织单元，每单元 15 词。
 * 独立于年级学期体系，grade/semester 仅为满足课程契约的名义分类值，
 * 通过 track: 'vocab-level' 标记，不参与学期可用性表。
 * 第 1 批覆盖 17 个主题单元，第 2 批扩充至 34 个，第 3 批扩充至 51 个，后续批次继续扩充。
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
  { id: 'ket-vocab-18-jobs', title: '职业' },
  { id: 'ket-vocab-19-feelings', title: '情感与感受' },
  { id: 'ket-vocab-20-appearance', title: '外貌描述' },
  { id: 'ket-vocab-21-actions', title: '日常动作' },
  { id: 'ket-vocab-22-adjectives', title: '常用形容词' },
  { id: 'ket-vocab-23-furniture', title: '家具与物品' },
  { id: 'ket-vocab-24-nature', title: '自然与世界' },
  { id: 'ket-vocab-25-numbers', title: '数字' },
  { id: 'ket-vocab-26-subjects', title: '学校科目' },
  { id: 'ket-vocab-27-sports', title: '体育运动' },
  { id: 'ket-vocab-28-music-art', title: '音乐与艺术' },
  { id: 'ket-vocab-29-technology', title: '科技与通讯' },
  { id: 'ket-vocab-30-colours', title: '颜色' },
  { id: 'ket-vocab-31-dining', title: '餐饮与用餐' },
  { id: 'ket-vocab-32-measures', title: '度量与形状' },
  { id: 'ket-vocab-33-celebrations', title: '节日与庆祝' },
  { id: 'ket-vocab-34-media', title: '媒体与阅读' },
  { id: 'ket-vocab-35-travel-holidays', title: '旅行与度假' },
  { id: 'ket-vocab-36-town-buildings', title: '城镇建筑' },
  { id: 'ket-vocab-37-shopping-services', title: '购物与服务' },
  { id: 'ket-vocab-38-health-medicine', title: '健康与医疗' },
  { id: 'ket-vocab-39-weekdays', title: '星期与周末' },
  { id: 'ket-vocab-40-months', title: '月份与日期' },
  { id: 'ket-vocab-41-position', title: '方位与位置' },
  { id: 'ket-vocab-42-movement', title: '移动与方向' },
  { id: 'ket-vocab-43-communication', title: '交流与表达' },
  { id: 'ket-vocab-44-cooking', title: '烹饪与厨房' },
  { id: 'ket-vocab-45-materials', title: '材料与质地' },
  { id: 'ket-vocab-46-environment', title: '环境与地球' },
  { id: 'ket-vocab-47-personality', title: '性格与品质' },
  { id: 'ket-vocab-48-weather-adjectives', title: '天气描述' },
  { id: 'ket-vocab-49-animals-extra', title: '更多动物' },
  { id: 'ket-vocab-50-food-extra', title: '更多食物' },
  { id: 'ket-vocab-51-thinking', title: '思维与感知' },
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
