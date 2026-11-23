<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import LearningPage from '../components/learning/LearningPage.vue'
import { LEARNING_RULES } from '../learning/config/rules'
import { MATH_TEMPLATES } from '../learning/practice/math-templates'
import type { Difficulty } from '../learning/types'
import { useLearningStore } from '../stores/learning'

const learning = useLearningStore()
const router = useRouter()
const selectedUnit = ref('written-multiplication')
const selectedDifficulty = ref<Difficulty>('L2')
const startError = ref('')

const units = computed(() => learning.course.units.filter((unit) => unit.id !== 'prior-review'))
const supportedDifficulties = computed(
  () =>
    new Set(
      MATH_TEMPLATES.filter(
        (template) => template.classification.unitId === selectedUnit.value && !template.review,
      ).flatMap((template) => template.supportedDifficulties),
    ),
)
const progress = computed(() =>
  Math.min(100, Math.round((learning.today.taskCompleted / learning.today.goal) * 100)),
)
const primaryLabel = computed(() => {
  if (learning.activeSession) return '继续本组练习'
  return learning.today.taskRemaining === 0 ? '开始一组加练' : '开始今日练习'
})
const milestoneRemaining = computed(() =>
  Math.max(0, learning.today.nextMilestone.days - learning.today.currentStreak),
)

watch(selectedUnit, () => {
  if (!supportedDifficulties.value.has(selectedDifficulty.value)) {
    selectedDifficulty.value = supportedDifficulties.value.has('L2') ? 'L2' : 'L1'
  }
})

function openPractice(sessionId: string | null): void {
  if (!sessionId) {
    startError.value = learning.saveError || '练习组暂时无法创建，请重试'
    return
  }
  void router.push({ name: 'learning-practice', params: { sessionId } })
}

function startComprehensive(): void {
  startError.value = ''
  try {
    openPractice(learning.startPractice({ mode: 'comprehensive' }))
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
        unitId: selectedUnit.value,
        difficulty: selectedDifficulty.value,
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
    eyebrow="MATH · GRADE 4"
    title="今天，也算出一点新进步"
    description="数学 · 四年级上学期 · 人教版新旧融合综合计算，包含两位数除法。答错可以订正，学会比速度更重要。"
  >
    <template #heading-action>
      <span class="learn-tag">本地保存 · 无需注册</span>
    </template>

    <section
      v-if="learning.ready && !learning.preferences.courseIntroSeen"
      class="learn-note learn-reveal"
      aria-labelledby="course-intro-title"
    >
      <strong id="course-intro-title">给家长：首次课程设置</strong>
      默认使用人教版四上新旧融合计算课程，每日 {{ LEARNING_RULES.dailyTask.defaultGoal }} 题。
      课程包含多位数乘两位数和两位数除法，不包含小数、分数或系统混合运算。跳过设置也按此默认范围执行。
      <div class="learn-actions">
        <button
          type="button"
          class="learn-button"
          @click="learning.updatePreferences({ courseIntroSeen: true })"
        >
          按默认课程设置
        </button>
      </div>
    </section>

    <div v-if="startError" class="learn-message learn-message--error" role="alert">
      {{ startError }}
    </div>

    <div class="learn-grid learn-reveal learn-reveal--late">
      <div class="learn-stack">
        <section class="learn-paper learn-section" aria-labelledby="today-practice-title">
          <p class="learn-kicker">今日练习单</p>
          <div class="learn-section__heading">
            <h2 id="today-practice-title">
              {{ learning.today.taskRemaining === 0 ? '今日目标已完成' : '每日综合练习' }}
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
            <span>有效完成才计入目标</span>
            <span>{{ progress }}%</span>
          </p>

          <div
            v-if="learning.today.taskRemaining === 0"
            class="learn-note"
            style="margin-top: 20px"
          >
            今日学习已完成，可以去农场看看，也可以休息。若主动加练，新题按首次答对 2 金币、
            提示后订正 1 金币、讲解后订正 0 金币计算，不再增加今日任务进度。
          </div>

          <div class="learn-actions">
            <button
              type="button"
              class="learn-button"
              :disabled="learning.saving"
              @click="startComprehensive"
            >
              {{ primaryLabel }}
            </button>
            <RouterLink class="learn-button learn-button--secondary" to="/learning/tasks">
              查看今日任务
            </RouterLink>
          </div>
        </section>

        <section class="learn-paper learn-section" aria-labelledby="special-title">
          <div class="learn-section__heading">
            <div>
              <p class="learn-kicker">按需要练一练</p>
              <h2 id="special-title">知识点专项练习</h2>
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
          <div class="learn-actions">
            <button
              type="button"
              class="learn-button learn-button--secondary"
              @click="startSpecial"
            >
              开始专项练习
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
          <summary>查看融合课程范围</summary>
          <div>
            <div class="learn-course-tags">
              <span v-for="unit in units" :key="unit.id" class="learn-tag">{{ unit.title }}</span>
            </div>
            新版同步内容与旧版补充内容会保留来源标签。每日目标默认 30 题，可在家长设置中按 5
            题调整，调整次日生效。
          </div>
        </details>
      </aside>
    </div>
  </LearningPage>
</template>
