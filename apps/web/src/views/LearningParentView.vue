<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import LearningConfirmDialog from '../components/learning/LearningConfirmDialog.vue'
import LearningPage from '../components/learning/LearningPage.vue'
import {
  COURSE_AVAILABILITY,
  COURSE_REGISTRY,
  getCourseById,
} from '../learning/content/course-registry'
import { filterEnglishTemplates } from '../learning/practice/english-templates'
import { filterMathTemplates } from '../learning/practice/math-templates'
import {
  getFilteredLearningSummary,
  getWalletLedgerPage,
  type KnowledgePointSummary,
  type LearningSummaryPeriod,
} from '../learning/tasks/learning-summary'
import {
  QUESTION_TYPES,
  type LearningAbility,
  type QuestionType,
  type Semester,
  type Subject,
} from '../learning/types'
import type { WalletSource } from '../learning/wallet/wallet'
import { useLearningStore } from '../stores/learning'

const learning = useLearningStore()
const goalDraft = ref(learning.upcomingDailyGoal)
const clearConfirmOpen = ref(false)
const goalOptions = Array.from({ length: 9 }, (_, index) => 10 + index * 5)
const sourceLabels: Record<WalletSource, string> = {
  practice: '练习奖励',
  'daily-task': '每日任务',
  streak: '连续任务',
  'farm-sale': '农产品出售',
  'farm-purchase': '农场购买',
  'farm-building': '农场建筑',
  'processing-sale': '加工品出售',
  'processing-purchase': '加工坊购买',
  recovery: '恢复补给',
  activity: '活动奖励',
}
const subjectLabels: Record<Subject, string> = { math: '数学', english: '英语' }
const semesterLabels: Record<Semester, string> = { autumn: '上学期', spring: '下学期' }
const abilityLabels: Record<LearningAbility, string> = {
  'math-calculation': '数学计算',
  'math-concept': '数学概念',
  'math-application': '数学应用',
  'english-vocabulary': '英语词汇',
  'english-sentence-grammar': '英语句型语法',
  'english-situational': '英语情境运用',
}
const questionTypeLabels: Record<QuestionType, string> = {
  number: '数字计算',
  'quotient-remainder': '商和余数',
  'fill-blanks': '填空',
  'single-choice': '单项选择',
  'word-problem': '应用题',
  fraction: '分数',
  'english-spelling': '单词拼写',
  'sentence-completion': '句子补全',
}

function courseLabel(courseId: string): string {
  const course = getCourseById(courseId)
  if (!course) return courseId
  // 词汇级别课程的 grade/semester 是名义分类值，直接显示课程标题
  if (course.track === 'vocab-level') return course.title
  return `${course.grade} 年级${semesterLabels[course.semester]}${subjectLabels[course.subject]}`
}

// 课程范围来自课程注册表与真实题库，仅作建议学习范围展示，不宣称地区统一教材目录
const courseScopes = COURSE_REGISTRY.map((course) => {
  const templates =
    course.subject === 'math'
      ? filterMathTemplates({ courseId: course.id, includeReview: true })
      : filterEnglishTemplates({ courseId: course.id, includeReview: true })
  return {
    course,
    units: course.units.filter((unit) => unit.id !== 'prior-review'),
    questionTypes: QUESTION_TYPES.filter((type) =>
      templates.some((template) => template.type === type),
    ).map((type) => questionTypeLabels[type]),
    legacy: course.knowledgePoints.some((point) => point.source !== 'new-pep'),
  }
})
const unavailableTerms = COURSE_AVAILABILITY.filter((entry) => !entry.available)
const currentScope = computed(() =>
  courseScopes.find((scope) => scope.course.id === learning.course.id),
)

const filterPeriod = ref<LearningSummaryPeriod>('today')
const filterSubject = ref<Subject | ''>('')
const filterCourse = ref('')
const filterKnowledgePoint = ref('')
const filteredSummary = computed(() =>
  getFilteredLearningSummary(learning.snapshot, learning.farmNow, {
    period: filterPeriod.value,
    subject: filterSubject.value || undefined,
    courseId: filterCourse.value || undefined,
    knowledgePointId: filterKnowledgePoint.value || undefined,
  }),
)
const filteredEmpty = computed(() =>
  Object.values(filteredSummary.value.counts).every((value) => value === 0),
)
const knowledgePointOptions = computed(() => {
  const seen = new Map<string, { id: string; label: string }>()
  for (const record of learning.snapshot.learning.records) {
    if (filterCourse.value && record.courseId !== filterCourse.value) continue
    if (filterSubject.value && record.subject !== filterSubject.value) continue
    if (seen.has(record.knowledgePointId)) continue
    const name = getCourseById(record.courseId)?.knowledgePoints.find(
      (point) => point.id === record.knowledgePointId,
    )?.name
    seen.set(record.knowledgePointId, {
      id: record.knowledgePointId,
      label: name ? `${name}（${courseLabel(record.courseId)}）` : record.knowledgePointId,
    })
  }
  return [...seen.values()].sort((left, right) => left.label.localeCompare(right.label, 'zh-CN'))
})
watch([filterSubject, filterCourse, knowledgePointOptions], () => {
  if (filterCourse.value) {
    const course = getCourseById(filterCourse.value)
    if (filterSubject.value && course && course.subject !== filterSubject.value) {
      filterCourse.value = ''
    }
  }
  if (
    filterKnowledgePoint.value &&
    !knowledgePointOptions.value.some((option) => option.id === filterKnowledgePoint.value)
  ) {
    filterKnowledgePoint.value = ''
  }
})

const summary = computed(() => learning.parentSummary)
const mainErrorCauses = computed(() => {
  const causes = new Map<string, { id: string; label: string; count: number }>()
  for (const point of summary.value.knowledgePoints) {
    for (const cause of point.errorCauses) {
      const existing = causes.get(cause.id)
      if (existing) existing.count += cause.count
      else causes.set(cause.id, { ...cause })
    }
  }
  return [...causes.values()]
    .sort(
      (left, right) => right.count - left.count || left.label.localeCompare(right.label, 'zh-CN'),
    )
    .slice(0, 6)
})
const activeWalletRows = computed(() =>
  summary.value.wallet.filter(
    (entry) =>
      entry.todayEarned > 0 ||
      entry.todaySpent > 0 ||
      entry.totalEarned > 0 ||
      entry.totalSpent > 0,
  ),
)
const recentLedger = computed(() => getWalletLedgerPage(learning.snapshot, 1, 5).items)
const unclassifiedErrorRecords = computed(() =>
  summary.value.knowledgePoints.reduce((total, point) => total + point.unclassifiedErrorRecords, 0),
)

function knowledgeName(point: KnowledgePointSummary): string {
  // 知识点名称按记录原课程解析，切换当前学期不影响旧数据展示
  const course = point.courseId ? getCourseById(point.courseId) : undefined
  return (
    (course ?? learning.course).knowledgePoints.find(
      (candidate) => candidate.id === point.knowledgePointId,
    )?.name ?? '综合计算'
  )
}

function saveGoal(): void {
  learning.updateDailyGoal(goalDraft.value)
}

function clearData(): void {
  if (learning.clearLearningData()) clearConfirmOpen.value = false
}

function formatTime(timestamp: number): string {
  return new Intl.DateTimeFormat('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(timestamp)
}

onMounted(() => {
  learning.initialize()
  goalDraft.value = learning.upcomingDailyGoal
  window.addEventListener('storage', learning.handleStorageEvent)
})
onUnmounted(() => window.removeEventListener('storage', learning.handleStorageEvent))
</script>

<template>
  <LearningPage
    eyebrow="FAMILY LEARNING FILE"
    title="学习有迹可循，调整不扰今天"
    description="这里汇总当前浏览器中的真实学习记录。统计用于了解练习过程，不生成排名或能力标签。"
  >
    <template #heading-action>
      <span class="learn-tag">本地学习档案</span>
    </template>

    <p v-if="learning.notice" class="learn-message" role="status">{{ learning.notice }}</p>
    <p v-if="learning.saveError" class="learn-message learn-message--error" role="alert">
      {{ learning.saveError }}
    </p>

    <div class="parent-layout learn-reveal learn-reveal--late">
      <section class="learn-paper learn-section" aria-labelledby="course-settings-title">
        <div class="learn-section__heading">
          <div>
            <p class="learn-kicker">课程设置</p>
            <h2 id="course-settings-title">{{ learning.course.title }}</h2>
          </div>
          <span class="learn-tag">{{ learning.course.textbook }}</span>
        </div>
        <p v-if="learning.subjectStatuses.math.contentReady">
          当前课程建议范围与题型如下；专项练习限当前课程范围内的知识点与题型。
        </p>
        <p v-else>{{ learning.subjectStatuses.math.reason }}，课程目录仅用于预览和选择。</p>
        <div class="learn-course-tags" aria-label="当前课程知识模块">
          <span v-for="unit in currentScope?.units ?? []" :key="unit.id" class="learn-tag">
            {{ unit.title }}
          </span>
        </div>
        <p v-if="currentScope" class="parent-help">
          题型：{{ currentScope.questionTypes.join('、') }}。
        </p>
        <details class="learn-details">
          <summary>查看全部课程范围与题型说明</summary>
          <div>
            <p class="parent-help">
              以下范围为建议学习范围，不代表地区统一教材目录；不同地区教学进度可能有差异。
            </p>
            <details v-for="scope in courseScopes" :key="scope.course.id" class="learn-details">
              <summary>
                {{ scope.course.title }}
                <span v-if="scope.legacy" class="learn-tag">保留旧课程</span>
              </summary>
              <div>
                <div class="learn-course-tags" :aria-label="`${scope.course.title}知识模块`">
                  <span v-for="unit in scope.units" :key="unit.id" class="learn-tag">
                    {{ unit.title }}
                  </span>
                </div>
                <p class="parent-help">题型：{{ scope.questionTypes.join('、') }}。</p>
                <p v-if="scope.legacy" class="parent-help">
                  四年级上学期数学为保留的新旧融合旧课程，含已学复习；复习题保留来源标签，不计作本学期新知掌握。
                </p>
              </div>
            </details>
            <p
              v-for="entry in unavailableTerms"
              :key="`${entry.grade}-${entry.semester}-${entry.subject}`"
              class="parent-help"
            >
              {{ entry.grade }} 年级{{ semesterLabels[entry.semester]
              }}{{ subjectLabels[entry.subject] }}：{{ entry.unavailableReason }}。
            </p>
          </div>
        </details>
        <div class="parent-goal">
          <label class="learn-field" for="daily-goal">
            次日起每日目标
            <select id="daily-goal" v-model.number="goalDraft">
              <option v-for="goal in goalOptions" :key="goal" :value="goal">{{ goal }} 题</option>
            </select>
          </label>
          <div class="parent-goal__facts">
            <span
              >今日目标 <strong>{{ learning.today.goal }} 题</strong></span
            >
            <span
              >次日目标 <strong>{{ learning.upcomingDailyGoal }} 题</strong></span
            >
          </div>
        </div>
        <p class="parent-help">
          仅可设置 10–50 题，按 5
          题调整。保存后从下一自然日生效，不改写今日任务快照、历史记录或已发奖励。
        </p>
        <div class="learn-actions">
          <button
            type="button"
            class="learn-button"
            :disabled="learning.saving || goalDraft === learning.upcomingDailyGoal"
            @click="saveGoal"
          >
            保存每日目标
          </button>
        </div>
      </section>

      <section class="learn-paper learn-section" aria-labelledby="experience-settings-title">
        <div class="learn-section__heading">
          <div>
            <p class="learn-kicker">体验设置</p>
            <h2 id="experience-settings-title">音效、动画与农场动态效果</h2>
          </div>
        </div>
        <p>这些设置只影响呈现效果，不改变判分、奖励或农场经营产出。</p>
        <div class="learn-switches">
          <label class="learn-switch">
            <input
              type="checkbox"
              :checked="learning.preferences.soundEnabled"
              @change="
                learning.updatePreferences({
                  soundEnabled: ($event.target as HTMLInputElement).checked,
                })
              "
            />
            正反馈音效
          </label>
          <label class="learn-switch">
            <input
              type="checkbox"
              :checked="learning.preferences.animationsEnabled"
              @change="
                learning.updatePreferences({
                  animationsEnabled: ($event.target as HTMLInputElement).checked,
                })
              "
            />
            页面动画
          </label>
          <label class="learn-switch">
            <input
              type="checkbox"
              :checked="learning.preferences.reduceFarmMotion"
              @change="
                learning.updatePreferences({
                  reduceFarmMotion: ($event.target as HTMLInputElement).checked,
                })
              "
            />
            减少农场动态效果
          </label>
        </div>
        <p v-if="learning.systemReducedMotion" class="parent-help" role="note">
          系统已开启“减少动态效果”，优先于应用内设置：页面动画和农场动态效果均已减少。
        </p>
        <p v-else class="parent-help">
          系统开启“减少动态效果”时会优先于以上开关；关闭农场动态效果后，生长状态与剩余时间仍以文字展示。
        </p>
      </section>

      <section class="learn-ticket parent-streak" aria-labelledby="streak-summary-title">
        <p class="learn-kicker">连续学习记录</p>
        <h2 id="streak-summary-title">当前连续 {{ summary.currentStreak }} 天</h2>
        <div class="parent-streak__numbers">
          <div>
            <strong>{{ summary.currentStreak }}</strong
            ><span>当前连续 / 天</span>
          </div>
          <div>
            <strong>{{ summary.longestStreak }}</strong
            ><span>最长连续 / 天</span>
          </div>
        </div>
        <p>连续记录只由每日任务完成情况产生，农场经营不会增加学习连续天数。</p>
      </section>

      <section class="learn-paper learn-section parent-wide" aria-labelledby="today-summary-title">
        <div class="learn-section__heading">
          <div>
            <p class="learn-kicker">{{ summary.today.dateKey }}</p>
            <h2 id="today-summary-title">今日学习摘要</h2>
          </div>
          <span class="learn-tag"
            >任务 {{ summary.today.taskCompleted }} / {{ summary.today.goal }} 题</span
          >
        </div>
        <dl class="parent-metrics">
          <div>
            <dt>有效完成</dt>
            <dd>{{ summary.today.effectiveCompleted }}</dd>
          </div>
          <div>
            <dt>首次答对</dt>
            <dd>{{ summary.today.firstCorrect }}</dd>
          </div>
          <div>
            <dt>提示后订正</dt>
            <dd>{{ summary.today.correctedAfterHint }}</dd>
          </div>
          <div>
            <dt>讲解后订正</dt>
            <dd>{{ summary.today.correctedAfterExplanation }}</dd>
          </div>
          <div>
            <dt>当前待复测</dt>
            <dd>{{ summary.today.pendingRetest }}</dd>
          </div>
        </dl>
        <p class="parent-help">
          有效完成是首次答对与两类订正之和；放弃和内容换题不计入完成，也不计入首次答对率分母。
        </p>
      </section>

      <section class="learn-paper learn-section parent-wide" aria-labelledby="week-summary-title">
        <div class="learn-section__heading">
          <div>
            <p class="learn-kicker">最近 7 个自然日</p>
            <h2 id="week-summary-title">每日练习回顾</h2>
          </div>
        </div>
        <div class="parent-table-wrap">
          <table class="parent-table">
            <thead>
              <tr>
                <th scope="col">日期</th>
                <th scope="col">任务进度</th>
                <th scope="col">有效完成</th>
                <th scope="col">首次答对</th>
                <th scope="col">提示后订正</th>
                <th scope="col">讲解后订正</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="day in summary.recentDays" :key="day.dateKey">
                <th scope="row">{{ day.dateKey }}</th>
                <td>{{ day.completed }} / {{ day.goal }}</td>
                <td>{{ day.effectiveCompleted }}</td>
                <td>{{ day.firstCorrect }}</td>
                <td>{{ day.correctedAfterHint }}</td>
                <td>{{ day.correctedAfterExplanation }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section class="learn-paper learn-section parent-wide" aria-labelledby="filter-summary-title">
        <div class="learn-section__heading">
          <div>
            <p class="learn-kicker">{{ filteredSummary.from }} 至 {{ filteredSummary.to }}</p>
            <h2 id="filter-summary-title">筛选统计与能力分布</h2>
          </div>
        </div>
        <div class="parent-filters">
          <label class="learn-field" for="summary-period">
            统计时间段
            <select id="summary-period" v-model="filterPeriod">
              <option value="today">今日</option>
              <option value="recent-7-days">最近 7 天</option>
            </select>
          </label>
          <label class="learn-field" for="summary-subject">
            学科
            <select id="summary-subject" v-model="filterSubject">
              <option value="">全部学科</option>
              <option value="math">数学</option>
              <option value="english">英语</option>
            </select>
          </label>
          <label class="learn-field" for="summary-course">
            年级学期
            <select id="summary-course" v-model="filterCourse">
              <option value="">全部课程</option>
              <option v-for="scope in courseScopes" :key="scope.course.id" :value="scope.course.id">
                {{ courseLabel(scope.course.id) }}
              </option>
            </select>
          </label>
          <label class="learn-field" for="summary-knowledge-point">
            知识点
            <select id="summary-knowledge-point" v-model="filterKnowledgePoint">
              <option value="">全部知识点</option>
              <option v-for="option in knowledgePointOptions" :key="option.id" :value="option.id">
                {{ option.label }}
              </option>
            </select>
          </label>
        </div>
        <div v-if="filteredEmpty" class="learn-empty">当前筛选范围内还没有学习记录。</div>
        <template v-else>
          <dl class="parent-metrics">
            <div>
              <dt>有效完成</dt>
              <dd>{{ filteredSummary.counts.effectiveCompleted }}</dd>
            </div>
            <div>
              <dt>首次答对</dt>
              <dd>{{ filteredSummary.counts.firstCorrect }}</dd>
            </div>
            <div>
              <dt>提示后订正</dt>
              <dd>{{ filteredSummary.counts.correctedAfterHint }}</dd>
            </div>
            <div>
              <dt>讲解后订正</dt>
              <dd>{{ filteredSummary.counts.correctedAfterExplanation }}</dd>
            </div>
            <div>
              <dt>未计入完成</dt>
              <dd>{{ filteredSummary.counts.abandoned + filteredSummary.counts.contentError }}</dd>
            </div>
          </dl>
          <div class="parent-table-wrap">
            <table class="parent-table">
              <thead>
                <tr>
                  <th scope="col">学科</th>
                  <th scope="col">有效完成</th>
                  <th scope="col">首次答对</th>
                  <th scope="col">提示后订正</th>
                  <th scope="col">讲解后订正</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="entry in filteredSummary.subjects" :key="entry.subject">
                  <th scope="row">{{ subjectLabels[entry.subject] }}</th>
                  <td>{{ entry.effectiveCompleted }}</td>
                  <td>{{ entry.firstCorrect }}</td>
                  <td>{{ entry.correctedAfterHint }}</td>
                  <td>{{ entry.correctedAfterExplanation }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div class="parent-table-wrap">
            <table class="parent-table">
              <thead>
                <tr>
                  <th scope="col">原课程</th>
                  <th scope="col">有效完成</th>
                  <th scope="col">首次答对</th>
                  <th scope="col">提示后订正</th>
                  <th scope="col">讲解后订正</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="entry in filteredSummary.courses" :key="entry.courseId">
                  <th scope="row">{{ courseLabel(entry.courseId) }}</th>
                  <td>{{ entry.effectiveCompleted }}</td>
                  <td>{{ entry.firstCorrect }}</td>
                  <td>{{ entry.correctedAfterHint }}</td>
                  <td>{{ entry.correctedAfterExplanation }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div v-if="filteredSummary.abilities.length > 0" class="parent-table-wrap">
            <table class="parent-table">
              <thead>
                <tr>
                  <th scope="col">能力分布</th>
                  <th scope="col">有效完成</th>
                  <th scope="col">首次答对</th>
                  <th scope="col">提示后订正</th>
                  <th scope="col">讲解后订正</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="entry in filteredSummary.abilities" :key="entry.ability">
                  <th scope="row">{{ abilityLabels[entry.ability] }}</th>
                  <td>{{ entry.effectiveCompleted }}</td>
                  <td>{{ entry.firstCorrect }}</td>
                  <td>{{ entry.correctedAfterHint }}</td>
                  <td>{{ entry.correctedAfterExplanation }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </template>
        <p class="parent-help">
          统计按记录原课程归属，切换当前学期不会重写旧数据；能力分布仅展示练习计数，不生成排名或“掌握良好”等能力标签。
        </p>
      </section>

      <section class="learn-paper learn-section" aria-labelledby="knowledge-summary-title">
        <div class="learn-section__heading">
          <div>
            <p class="learn-kicker">按原始学习记录汇总</p>
            <h2 id="knowledge-summary-title">知识点摘要</h2>
          </div>
        </div>
        <div v-if="summary.knowledgePoints.length === 0" class="learn-empty">
          还没有学习记录，完成练习后会按知识点显示。
        </div>
        <div v-else class="parent-table-wrap">
          <table class="parent-table">
            <thead>
              <tr>
                <th scope="col">知识点</th>
                <th scope="col">所属课程</th>
                <th scope="col">有效完成</th>
                <th scope="col">首次答对</th>
                <th scope="col">提示后订正</th>
                <th scope="col">讲解后订正</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="point in summary.knowledgePoints" :key="point.knowledgePointId">
                <th scope="row">{{ knowledgeName(point) }}</th>
                <td>{{ point.courseId ? courseLabel(point.courseId) : '旧记录' }}</td>
                <td>{{ point.effectiveCompleted }}</td>
                <td>{{ point.firstCorrect }}</td>
                <td>{{ point.correctedAfterHint }}</td>
                <td>{{ point.correctedAfterExplanation }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section class="learn-ticket" aria-labelledby="causes-title">
        <p class="learn-kicker">从错误提交中累积</p>
        <h2 id="causes-title">主要错因</h2>
        <div v-if="mainErrorCauses.length === 0" class="learn-empty">暂无可归类的错因记录。</div>
        <ol v-else class="parent-causes">
          <li v-for="cause in mainErrorCauses" :key="cause.id">
            <span>{{ cause.label }}</span
            ><strong>{{ cause.count }} 次</strong>
          </li>
        </ol>
        <p v-if="unclassifiedErrorRecords > 0" class="parent-help">
          另有 {{ unclassifiedErrorRecords }} 条旧记录无法追溯具体错因，归入未分类，不做推测。
        </p>
      </section>

      <section class="learn-paper learn-section parent-wide" aria-labelledby="wallet-summary-title">
        <div class="learn-section__heading">
          <div>
            <p class="learn-kicker">统一学习钱包</p>
            <h2 id="wallet-summary-title">金币来源与消耗</h2>
          </div>
          <span class="learn-tag">余额 {{ summary.today.walletBalance }}</span>
        </div>
        <div v-if="activeWalletRows.length === 0" class="learn-empty">
          还没有金币来源或消耗记录。
        </div>
        <div v-else class="parent-table-wrap">
          <table class="parent-table">
            <thead>
              <tr>
                <th scope="col">来源 / 用途</th>
                <th scope="col">今日收入</th>
                <th scope="col">今日消耗</th>
                <th scope="col">累计收入</th>
                <th scope="col">累计消耗</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="entry in activeWalletRows" :key="entry.source">
                <th scope="row">{{ sourceLabels[entry.source] }}</th>
                <td>+{{ entry.todayEarned }}</td>
                <td>-{{ entry.todaySpent }}</td>
                <td>+{{ entry.totalEarned }}</td>
                <td>-{{ entry.totalSpent }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p class="parent-help">
          分类汇总与原始流水、余额一致；加工原料投入只扣减仓库物品，不产生金币流水。
        </p>
        <div class="parent-recent-ledger">
          <div class="learn-section__heading">
            <h3>最近金币流水</h3>
            <RouterLink class="learn-text-button" to="/learning/records">查看全部与分页</RouterLink>
          </div>
          <div v-if="recentLedger.length === 0" class="learn-empty">还没有金币变动。</div>
          <ul v-else class="learn-record-list">
            <li v-for="entry in recentLedger" :key="entry.settlementId">
              <div>
                <strong>{{ sourceLabels[entry.source] }}</strong
                ><time :datetime="new Date(entry.occurredAt).toISOString()">{{
                  formatTime(entry.occurredAt)
                }}</time>
              </div>
              <span class="learn-result"
                >{{ entry.direction === 'earn' ? '+' : '-' }}{{ entry.amount }}</span
              >
              <small>变动后余额 {{ entry.balanceAfter }}</small>
            </li>
          </ul>
        </div>
      </section>

      <section class="parent-danger parent-wide" aria-labelledby="data-management-title">
        <div>
          <p class="learn-kicker">本地数据管理</p>
          <h2 id="data-management-title">清除学习数据前，请确认这些风险</h2>
          <ul>
            <li>学习数据仅保存在当前浏览器，没有账号或多设备同步。</li>
            <li>清理浏览器网站数据、使用隐私模式或更换设备，都可能导致记录丢失。</li>
            <li>清除会删除学习记录、练习组、每日任务、金币和农场数据，且无法撤销。</li>
            <li>音效、动画和每日目标等体验偏好会保留，原打字、游戏及桃源乡数据不受影响。</li>
          </ul>
        </div>
        <button
          type="button"
          class="parent-danger__button"
          :disabled="learning.saving"
          @click="clearConfirmOpen = true"
        >
          清除学习数据
        </button>
      </section>
    </div>

    <LearningConfirmDialog
      v-if="clearConfirmOpen"
      eyebrow="LOCAL DATA · 不可撤销"
      title="确认清除全部学习数据？"
      description="此操作只清除学习、金币和学习农场记录，不会影响原打字、游戏或桃源乡存档。"
      :lines="[
        '所有练习记录、每日任务与连续记录将删除',
        '金币余额、流水和农场资产将删除',
        '清除后无法恢复，也没有多设备副本',
      ]"
      confirm-label="确认清除，不可撤销"
      :busy="learning.saving"
      :error="learning.saveError"
      @cancel="clearConfirmOpen = false"
      @confirm="clearData"
    />
  </LearningPage>
</template>

<style scoped>
.parent-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.65fr) minmax(280px, 0.85fr);
  gap: 24px;
  align-items: start;
}

.parent-wide {
  grid-column: 1 / -1;
}

.parent-layout > * {
  min-width: 0;
}

.parent-goal {
  display: grid;
  grid-template-columns: minmax(160px, 0.65fr) minmax(0, 1.35fr);
  gap: 18px;
  align-items: end;
  margin-top: 22px;
}

.parent-goal__facts {
  display: flex;
  flex-wrap: wrap;
  gap: 10px 22px;
  min-height: 44px;
  align-items: center;
  color: var(--learn-muted);
}

.parent-goal__facts strong {
  color: var(--learn-ink);
}

.parent-help {
  color: var(--learn-muted);
  font-size: 13px;
}

.parent-filters {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;
  margin-bottom: 18px;
}

.parent-table-wrap + .parent-table-wrap {
  margin-top: 18px;
}

.parent-streak__numbers {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin: 22px 0;
}

.parent-streak__numbers div {
  padding: 16px 10px;
  border-top: 3px solid #ab9360;
  background: rgb(255 253 246 / 55%);
  text-align: center;
}

.parent-streak__numbers strong,
.parent-streak__numbers span {
  display: block;
}

.parent-streak__numbers strong {
  font-family: 'Avenir Next', 'Trebuchet MS', sans-serif;
  font-size: 38px;
}

.parent-streak__numbers span {
  margin-top: 5px;
  font-size: 12px;
}

.parent-metrics {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  margin: 0;
  border-top: 1px dashed var(--learn-line);
  border-bottom: 1px dashed var(--learn-line);
}

.parent-metrics div {
  padding: 20px 12px;
  text-align: center;
}

.parent-metrics div + div {
  border-left: 1px dashed var(--learn-line);
}

.parent-metrics dt {
  color: var(--learn-muted);
  font-size: 12px;
}

.parent-metrics dd {
  margin: 7px 0 0;
  font-family: 'Avenir Next', 'Trebuchet MS', sans-serif;
  font-size: 30px;
  font-weight: 800;
}

.parent-table-wrap {
  overflow-x: auto;
}

.parent-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
  white-space: nowrap;
}

.parent-table th,
.parent-table td {
  padding: 13px 12px;
  border-bottom: 1px dashed var(--learn-line);
  text-align: right;
}

.parent-table th:first-child {
  padding-left: 0;
  text-align: left;
}

.parent-table thead th {
  color: var(--learn-muted);
  font-size: 12px;
}

.parent-table tbody th {
  color: var(--learn-jade-dark);
}

.parent-causes {
  display: grid;
  gap: 0;
  margin: 18px 0;
  padding: 0;
  list-style: none;
  counter-reset: causes;
}

.parent-causes li {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 0;
  border-bottom: 1px dashed #c8b98f;
  counter-increment: causes;
}

.parent-causes li::before {
  content: counter(causes, decimal-leading-zero);
  color: #8b7443;
  font-size: 12px;
}

.parent-causes span {
  flex: 1;
}

.parent-recent-ledger {
  margin-top: 28px;
  padding-top: 4px;
  border-top: 1px solid var(--learn-line);
}

.parent-recent-ledger h3 {
  margin: 0;
}

time {
  display: block;
  margin-top: 4px;
  color: var(--learn-muted);
  font-size: 12px;
}

.parent-danger {
  display: flex;
  justify-content: space-between;
  gap: 28px;
  align-items: center;
  padding: 26px 30px;
  border: 1px solid #d5a392;
  border-radius: 4px 18px 4px 18px;
  background: #fff4e9;
}

.parent-danger h2 {
  margin: 0;
  font-family: 'STKaiti', 'KaiTi', 'FangSong', serif;
  font-size: 25px;
}

.parent-danger ul {
  margin: 14px 0 0;
  padding-left: 20px;
  color: #765549;
  line-height: 1.75;
}

.parent-danger__button {
  flex: none;
  min-height: 44px;
  padding: 11px 18px;
  border: 1px solid #873d2e;
  border-radius: 8px;
  color: #873d2e;
  background: #fffdf6;
  font-weight: 750;
  cursor: pointer;
}

.parent-danger__button:hover:not(:disabled) {
  color: #fffdf6;
  background: #873d2e;
}

.parent-danger__button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

@media (max-width: 820px) {
  .parent-layout {
    grid-template-columns: minmax(0, 1fr);
  }

  .parent-filters {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .parent-wide {
    grid-column: auto;
  }

  .parent-metrics {
    grid-template-columns: repeat(3, 1fr);
  }

  .parent-metrics div:nth-child(4) {
    border-left: 0;
  }

  .parent-metrics div:nth-child(n + 4) {
    border-top: 1px dashed var(--learn-line);
  }

  .parent-danger {
    align-items: flex-start;
    flex-direction: column;
  }
}

@media (max-width: 520px) {
  .parent-goal {
    grid-template-columns: 1fr;
  }

  .parent-filters {
    grid-template-columns: 1fr;
  }

  .parent-metrics {
    grid-template-columns: repeat(2, 1fr);
  }

  .parent-metrics div:nth-child(3),
  .parent-metrics div:nth-child(5) {
    border-left: 0;
  }

  .parent-metrics div:nth-child(n + 3) {
    border-top: 1px dashed var(--learn-line);
  }

  .parent-metrics div:nth-child(4) {
    border-left: 1px dashed var(--learn-line);
  }

  .parent-danger {
    padding: 22px;
  }
}
</style>
