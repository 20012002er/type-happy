<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import LearningPage from '../components/learning/LearningPage.vue'
import { GRADE4_AUTUMN_MATH_COURSE } from '../learning/content/grade4-math'
import { LEARNING_RULES } from '../learning/config/rules'
import type { CourseSelection } from '../learning/persistence/snapshot'
import { filterMathTemplates } from '../learning/practice/math-templates'
import { filterEnglishTemplates } from '../learning/practice/english-templates'
import {
  QUESTION_TYPES,
  type Difficulty,
  type LearningAbility,
  type QuestionType,
  type Subject,
} from '../learning/types'
import { useLearningStore } from '../stores/learning'

const learning = useLearningStore()
const router = useRouter()
const selectedUnit = ref('written-multiplication')
const selectedKnowledgePoint = ref('')
const selectedQuestionType = ref<QuestionType | ''>('')
const selectedDifficulty = ref<Difficulty>('L2')
const startError = ref('')
const ENGLISH_ABILITIES: readonly { value: LearningAbility; label: string }[] = [
  { value: 'english-vocabulary', label: '词汇' },
  { value: 'english-sentence-grammar', label: '句型语法' },
  { value: 'english-situational', label: '情境运用' },
]
const englishAbility = ref<LearningAbility | ''>('english-vocabulary')
const englishUnit = ref('')
const englishQuestionType = ref<QuestionType | ''>('')
const englishDifficulty = ref<Difficulty>('L2')
const QUESTION_TYPE_LABELS: Partial<Record<QuestionType, string>> = {
  number: '数字计算',
  'quotient-remainder': '商和余数',
  'fill-blanks': '填空',
  'single-choice': '单项选择',
  'word-problem': '应用题',
  fraction: '分数',
  'english-spelling': '单词拼写',
  'sentence-completion': '句子补全',
}
const terms: readonly (CourseSelection & { label: string })[] = [
  { grade: 4, semester: 'autumn', label: '四年级上学期' },
  { grade: 4, semester: 'spring', label: '四年级下学期' },
  { grade: 5, semester: 'autumn', label: '五年级上学期' },
  { grade: 5, semester: 'spring', label: '五年级下学期' },
]

const currentTerm = computed(
  () =>
    terms.find(
      (term) =>
        term.grade === learning.snapshot.course.grade &&
        term.semester === learning.snapshot.course.semester,
    ) ?? terms[0],
)
const units = computed(() => learning.course.units.filter((unit) => unit.id !== 'prior-review'))
const knowledgePoints = computed(() =>
  learning.course.knowledgePoints.filter((point) => point.unitId === selectedUnit.value),
)
const unitKnowledgeTemplates = computed(() =>
  filterMathTemplates({
    courseId: learning.course.id,
    unitId: selectedUnit.value,
    knowledgePointId: selectedKnowledgePoint.value || undefined,
    includeReview: false,
  }),
)
const availableQuestionTypes = computed(() =>
  QUESTION_TYPES.filter((type) =>
    unitKnowledgeTemplates.value.some((template) => template.type === type),
  ),
)
const supportedDifficulties = computed(
  () =>
    new Set(
      unitKnowledgeTemplates.value
        .filter(
          (template) => !selectedQuestionType.value || template.type === selectedQuestionType.value,
        )
        .flatMap((template) => template.supportedDifficulties),
    ),
)
const hasSpecialMatches = computed(
  () => learning.subjectStatuses.math.contentReady && supportedDifficulties.value.size > 0,
)
const englishCourse = computed(() => learning.subjectStatuses.english.course)
const englishUnits = computed(() => englishCourse.value?.units ?? [])
const englishTemplates = computed(() =>
  englishCourse.value
    ? filterEnglishTemplates({
        courseId: englishCourse.value.id,
        unitId: englishUnit.value || undefined,
        ability: englishAbility.value || undefined,
        includeReview: false,
      })
    : [],
)
const availableEnglishQuestionTypes = computed(() =>
  QUESTION_TYPES.filter((type) =>
    englishTemplates.value.some((template) => template.type === type),
  ),
)
const englishSupportedDifficulties = computed(
  () =>
    new Set(
      englishTemplates.value
        .filter(
          (template) => !englishQuestionType.value || template.type === englishQuestionType.value,
        )
        .flatMap((template) => template.supportedDifficulties),
    ),
)
const hasEnglishSpecialMatches = computed(
  () =>
    learning.subjectStatuses.english.contentReady &&
    Boolean(englishAbility.value || englishUnit.value) &&
    englishSupportedDifficulties.value.size > 0,
)
const progress = computed(() =>
  Math.min(100, Math.round((learning.today.taskCompleted / learning.today.goal) * 100)),
)
const milestoneRemaining = computed(() =>
  Math.max(0, learning.today.nextMilestone.days - learning.today.currentStreak),
)
const activeCourseChanged = computed(
  () => learning.activeCourse && learning.activeCourse.id !== learning.course.id,
)

watch(selectedUnit, () => {
  selectedKnowledgePoint.value = ''
  selectedQuestionType.value = ''
})
watch([selectedUnit, selectedKnowledgePoint, selectedQuestionType], () => {
  if (
    selectedQuestionType.value &&
    !availableQuestionTypes.value.includes(selectedQuestionType.value)
  ) {
    selectedQuestionType.value = ''
  }
  if (
    supportedDifficulties.value.size > 0 &&
    !supportedDifficulties.value.has(selectedDifficulty.value)
  ) {
    selectedDifficulty.value = supportedDifficulties.value.has('L2') ? 'L2' : 'L1'
  }
})
watch(
  () => learning.course.id,
  () => {
    selectedUnit.value =
      learning.course.id === GRADE4_AUTUMN_MATH_COURSE.id
        ? 'written-multiplication'
        : (units.value[0]?.id ?? '')
    selectedKnowledgePoint.value = ''
    selectedQuestionType.value = ''
    selectedDifficulty.value = 'L2'
    englishAbility.value = 'english-vocabulary'
    englishUnit.value = ''
    englishQuestionType.value = ''
    englishDifficulty.value = 'L2'
  },
)
watch([englishAbility, englishUnit], () => {
  if (
    englishQuestionType.value &&
    !availableEnglishQuestionTypes.value.includes(englishQuestionType.value)
  ) {
    englishQuestionType.value = ''
  }
})
watch([englishAbility, englishUnit, englishQuestionType], () => {
  if (
    englishSupportedDifficulties.value.size > 0 &&
    !englishSupportedDifficulties.value.has(englishDifficulty.value)
  ) {
    englishDifficulty.value = englishSupportedDifficulties.value.has('L2') ? 'L2' : 'L1'
  }
})

function chooseCourse(selection: CourseSelection): void {
  startError.value = ''
  learning.clearMessages()
  if (!learning.selectCourse(selection)) startError.value = learning.saveError
}

function openPractice(sessionId: string | null): void {
  if (!sessionId) {
    startError.value = learning.saveError || '练习组暂时无法创建，请重试'
    return
  }
  void router.push({ name: 'learning-practice', params: { sessionId } })
}

function startComprehensive(subject: Subject): void {
  startError.value = ''
  try {
    openPractice(learning.startPractice({ mode: 'comprehensive', subject }))
  } catch (error) {
    startError.value = error instanceof Error ? error.message : '练习组暂时无法创建，请重试'
  }
}

function startSpecial(): void {
  startError.value = ''
  try {
    openPractice(
      learning.startPractice({
        mode: 'special',
        subject: 'math',
        unitId: selectedUnit.value,
        knowledgePointId: selectedKnowledgePoint.value || undefined,
        questionType: selectedQuestionType.value || undefined,
        difficulty: selectedDifficulty.value,
      }),
    )
  } catch (error) {
    startError.value = error instanceof Error ? error.message : '所选专项暂时没有可用题目'
  }
}

function startEnglishSpecial(): void {
  startError.value = ''
  try {
    openPractice(
      learning.startPractice({
        mode: 'special',
        subject: 'english',
        unitId: englishUnit.value || undefined,
        ability: englishAbility.value || undefined,
        questionType: englishQuestionType.value || undefined,
        difficulty: englishDifficulty.value,
      }),
    )
  } catch (error) {
    startError.value = error instanceof Error ? error.message : '所选专项暂时没有可用题目'
  }
}

onMounted(() => {
  learning.initialize()
  window.addEventListener('storage', learning.handleStorageEvent)
})
onUnmounted(() => window.removeEventListener('storage', learning.handleStorageEvent))
</script>

<template>
  <LearningPage
    eyebrow="LEARNING NOTEBOOK"
    title="今天，也学会一点新本领"
    :description="`${currentTerm.label} · 数学与英语共用一个今日目标。答错可以订正，学会比速度更重要。`"
  >
    <template #heading-action>
      <span class="learn-tag">{{ currentTerm.label }} · 本地保存</span>
    </template>

    <section class="learn-paper learn-section learn-reveal" aria-labelledby="course-title">
      <div class="learn-section__heading">
        <div>
          <p class="learn-kicker">本学期课程</p>
          <h2 id="course-title">选择年级与学期</h2>
        </div>
        <span class="learn-tag">当前：{{ currentTerm.label }}</span>
      </div>
      <div class="learn-course-options" role="group" aria-label="年级学期">
        <button
          v-for="term in terms"
          :key="`${term.grade}-${term.semester}`"
          type="button"
          class="learn-course-option"
          :class="{ 'learn-course-option--selected': currentTerm === term }"
          :aria-pressed="currentTerm === term"
          :disabled="learning.saving || !learning.ready"
          @click="chooseCourse(term)"
        >
          <strong>{{ term.label }}</strong>
          <small>{{ currentTerm === term ? '当前课程' : '选择此课程' }}</small>
        </button>
      </div>
      <div v-if="learning.ready && learning.courseSelectionRequired" class="learn-note">
        <strong id="course-intro-title">新用户请先选择课程</strong>
        点击一个学期确认课程，之后即可开始练习。每日目标默认为
        {{ LEARNING_RULES.dailyTask.defaultGoal }} 题，选择会保存在本机。
      </div>
      <p v-else class="learn-course-hint">
        切换课程不会清空今日任务、连续记录、金币、农场或历史记录；进行中的练习组不受影响。
      </p>
    </section>

    <div v-if="learning.notice" class="learn-message" role="status">{{ learning.notice }}</div>
    <div v-if="startError" class="learn-message learn-message--error" role="alert">
      {{ startError }}
    </div>

    <section
      v-if="learning.activeSession"
      class="learn-note learn-active-course"
      aria-label="进行中的练习"
    >
      <strong>仍有一组{{ learning.activeCourse?.title ?? '原课程' }}练习</strong>
      <template v-if="activeCourseChanged">
        已选择新的学期，但本组题目、答案和课程快照保持不变；完成或放弃本组后，下一组才使用新选择。
      </template>
      <template v-else>继续本组即可接着上次的位置练习。</template>
      <div class="learn-actions">
        <button type="button" class="learn-button" @click="openPractice(learning.activeSession.id)">
          继续{{ learning.activeCourse?.title ?? '原课程' }}练习
        </button>
      </div>
    </section>

    <div class="learn-grid learn-reveal learn-reveal--late">
      <div class="learn-stack">
        <section class="learn-paper learn-section" aria-labelledby="today-practice-title">
          <p class="learn-kicker">数学与英语共享</p>
          <div class="learn-section__heading">
            <h2 id="today-practice-title">
              {{ learning.today.taskRemaining === 0 ? '今日目标已完成' : '今日合计进度' }}
            </h2>
            <span class="learn-tag">{{ learning.today.dateKey }}</span>
          </div>

          <div class="learn-big-number">
            {{ learning.today.taskCompleted }}<small> / {{ learning.today.goal }} 题</small>
          </div>
          <div
            class="learn-progress"
            role="progressbar"
            aria-label="今日有效完成进度"
            :aria-valuenow="learning.today.taskCompleted"
            aria-valuemin="0"
            :aria-valuemax="learning.today.goal"
          >
            <span :style="{ '--progress': `${progress}%` }" />
          </div>
          <p class="learn-progress-note">
            <span>两个学科只计算一个每日目标</span>
            <span>{{ progress }}%</span>
          </p>

          <div v-if="learning.today.taskRemaining === 0" class="learn-note learn-today-note">
            今日学习已完成，可以去农场看看，也可以休息。主动加练不再增加今日任务进度。
          </div>

          <div class="learn-subject-grid">
            <article class="learn-subject-card" aria-labelledby="math-card-title">
              <div class="learn-section__heading">
                <h3 id="math-card-title">{{ currentTerm.label }}数学</h3>
                <span class="learn-tag">
                  {{ learning.subjectStatuses.math.contentReady ? '可练习' : '暂未开放' }}
                </span>
              </div>
              <p>
                {{
                  learning.subjectStatuses.math.contentReady
                    ? '新旧融合综合计算，包含两位数除法；也可在下方选择专项。'
                    : learning.subjectStatuses.math.reason
                }}
              </p>
              <button
                type="button"
                class="learn-button"
                :disabled="
                  learning.saving ||
                  !learning.ready ||
                  learning.courseSelectionRequired ||
                  Boolean(learning.activeSession) ||
                  !learning.subjectStatuses.math.contentReady
                "
                @click="startComprehensive('math')"
              >
                开始{{ currentTerm.label }}数学综合练习
              </button>
            </article>

            <article class="learn-subject-card" aria-labelledby="english-card-title">
              <div class="learn-section__heading">
                <h3 id="english-card-title">{{ currentTerm.label }}英语</h3>
                <span class="learn-tag">
                  {{ learning.subjectStatuses.english.contentReady ? '可练习' : '暂未开放' }}
                </span>
              </div>
              <p>
                {{
                  learning.subjectStatuses.english.contentReady
                    ? '词汇拼写、句型语法与情境表达综合练习；不提供听力或跟读入口。'
                    : `${learning.subjectStatuses.english.reason}，不提供听力或跟读入口。`
                }}
              </p>
              <button
                type="button"
                class="learn-button learn-button--secondary"
                :disabled="
                  learning.saving ||
                  !learning.ready ||
                  learning.courseSelectionRequired ||
                  Boolean(learning.activeSession) ||
                  !learning.subjectStatuses.english.contentReady
                "
                @click="startComprehensive('english')"
              >
                开始{{ currentTerm.label }}英语综合练习
              </button>
            </article>
          </div>

          <div class="learn-actions">
            <RouterLink class="learn-button learn-button--secondary" to="/learning/tasks">
              查看今日任务
            </RouterLink>
          </div>
        </section>

        <section class="learn-paper learn-section" aria-labelledby="special-title">
          <div class="learn-section__heading">
            <div>
              <p class="learn-kicker">按需要练一练</p>
              <h2 id="special-title">数学知识点专项练习</h2>
            </div>
            <span class="learn-tag">每组 10 题</span>
          </div>
          <div class="learn-form-grid">
            <label class="learn-field">
              知识模块
              <select v-model="selectedUnit">
                <option v-for="unit in units" :key="unit.id" :value="unit.id">
                  {{ unit.title }}
                </option>
              </select>
            </label>
            <label class="learn-field">
              知识点
              <select v-model="selectedKnowledgePoint">
                <option value="">全部知识点</option>
                <option v-for="point in knowledgePoints" :key="point.id" :value="point.id">
                  {{ point.name }}
                </option>
              </select>
            </label>
            <label class="learn-field">
              题型
              <select v-model="selectedQuestionType">
                <option value="">全部题型</option>
                <option v-for="type in availableQuestionTypes" :key="type" :value="type">
                  {{ QUESTION_TYPE_LABELS[type] ?? type }}
                </option>
              </select>
            </label>
            <label class="learn-field">
              难度
              <select v-model="selectedDifficulty">
                <option
                  v-for="level in ['L1', 'L2', 'L3']"
                  :key="level"
                  :value="level"
                  :disabled="!supportedDifficulties.has(level as Difficulty)"
                >
                  {{ level }} · {{ level === 'L1' ? '基础' : level === 'L2' ? '达标' : '综合' }}
                </option>
              </select>
            </label>
          </div>
          <div v-if="!hasSpecialMatches" class="learn-empty learn-special-empty">
            当前课程与筛选条件暂无可用题目。请更换知识模块、难度或学期，不会创建空练习组。
          </div>
          <div class="learn-actions">
            <button
              type="button"
              class="learn-button learn-button--secondary"
              :disabled="
                learning.saving ||
                !learning.ready ||
                learning.courseSelectionRequired ||
                Boolean(learning.activeSession) ||
                !hasSpecialMatches
              "
              @click="startSpecial"
            >
              开始专项练习
            </button>
          </div>
        </section>

        <section
          v-if="englishCourse"
          class="learn-paper learn-section"
          aria-labelledby="english-special-title"
        >
          <div class="learn-section__heading">
            <div>
              <p class="learn-kicker">英语练一练</p>
              <h2 id="english-special-title">英语专项练习</h2>
            </div>
            <span class="learn-tag">每组 10 题</span>
          </div>
          <div class="learn-form-grid">
            <label class="learn-field">
              专项能力
              <select v-model="englishAbility">
                <option v-for="item in ENGLISH_ABILITIES" :key="item.value" :value="item.value">
                  {{ item.label }}
                </option>
              </select>
            </label>
            <label class="learn-field">
              知识模块
              <select v-model="englishUnit">
                <option value="">全部单元</option>
                <option v-for="unit in englishUnits" :key="unit.id" :value="unit.id">
                  {{ unit.title }}
                </option>
              </select>
            </label>
            <label class="learn-field">
              题型
              <select v-model="englishQuestionType">
                <option value="">全部题型</option>
                <option v-for="type in availableEnglishQuestionTypes" :key="type" :value="type">
                  {{ QUESTION_TYPE_LABELS[type] ?? type }}
                </option>
              </select>
            </label>
            <label class="learn-field">
              难度
              <select v-model="englishDifficulty">
                <option
                  v-for="level in ['L1', 'L2', 'L3']"
                  :key="level"
                  :value="level"
                  :disabled="!englishSupportedDifficulties.has(level as Difficulty)"
                >
                  {{ level }} · {{ level === 'L1' ? '基础' : level === 'L2' ? '达标' : '综合' }}
                </option>
              </select>
            </label>
          </div>
          <div v-if="!hasEnglishSpecialMatches" class="learn-empty learn-special-empty">
            当前课程与筛选条件暂无可用题目。请更换专项能力、知识模块、难度或学期，不会创建空练习组。
          </div>
          <div class="learn-actions">
            <button
              type="button"
              class="learn-button learn-button--secondary"
              :disabled="
                learning.saving ||
                !learning.ready ||
                learning.courseSelectionRequired ||
                Boolean(learning.activeSession) ||
                !hasEnglishSpecialMatches
              "
              @click="startEnglishSpecial"
            >
              开始英语专项练习
            </button>
          </div>
        </section>
      </div>

      <aside class="learn-stack" aria-label="学习状态与设置">
        <section class="learn-ticket" aria-labelledby="streak-title">
          <p class="learn-kicker">连续学习票根</p>
          <h2 id="streak-title">已连续 {{ learning.today.currentStreak }} 天</h2>
          <p>
            下一个里程碑：连续 {{ learning.today.nextMilestone.days }} 天，奖励
            {{ learning.today.nextMilestone.reward }} 金币。
          </p>
          <p v-if="milestoneRemaining > 0">再完成 {{ milestoneRemaining }} 天即可达到。</p>
          <p v-else>本次里程碑已经达成，奖励会自动到账。</p>
          <dl class="learn-stats">
            <div>
              <dt>今日金币</dt>
              <dd>
                +{{
                  learning.today.practiceReward +
                  learning.today.dailyReward +
                  learning.today.streakReward
                }}
              </dd>
            </div>
            <div>
              <dt>待复测</dt>
              <dd>{{ learning.today.pendingRetest }}</dd>
            </div>
            <div>
              <dt>待收获</dt>
              <dd>{{ learning.pendingHarvests }}</dd>
            </div>
          </dl>
          <div class="learn-actions">
            <RouterLink class="learn-button learn-button--secondary" to="/learning/farm">
              去学习农场
            </RouterLink>
          </div>
        </section>

        <section class="learn-paper learn-section" aria-labelledby="experience-title">
          <h2 id="experience-title">练习体验</h2>
          <p>关闭音效或动画不会影响判分、任务和金币。</p>
          <div class="learn-actions">
            <RouterLink class="learn-button learn-button--secondary" to="/learning/parent">
              家长设置与学习摘要
            </RouterLink>
          </div>
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
          </div>
        </section>

        <details class="learn-details">
          <summary>查看当前课程范围</summary>
          <div>
            <div class="learn-course-tags">
              <span v-for="unit in units" :key="unit.id" class="learn-tag">{{ unit.title }}</span>
            </div>
            <template v-if="learning.subjectStatuses.math.contentReady">
              专项练习限当前课程范围内的知识点与题型；复习题保留来源标签，不计作本学期新知掌握。
            </template>
            <template v-else>{{ learning.subjectStatuses.math.reason }}</template>
            每日目标默认 30 题，可在家长设置中按 5 题调整，调整次日生效。
          </div>
        </details>
      </aside>
    </div>
  </LearningPage>
</template>
