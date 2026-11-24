<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import LearningAnswerInput from '../components/learning/LearningAnswerInput.vue'
import {
  emptyAnswerForm,
  formFromAnswer,
  type AnswerFormValue,
} from '../components/learning/answer-form'
import LearningFeedback from '../components/learning/LearningFeedback.vue'
import LearningPage from '../components/learning/LearningPage.vue'
import PracticeCompletion from '../components/learning/PracticeCompletion.vue'
import { LEARNING_RULES } from '../learning/config/rules'
import { getCourseById } from '../learning/content/course-registry'
import type { Answer } from '../learning/types'
import { useLearningStore } from '../stores/learning'

const route = useRoute()
const router = useRouter()
const learning = useLearningStore()
const form = ref<AnswerFormValue>(emptyAnswerForm())
const showAbandonConfirm = ref(false)

const sessionId = computed(() => String(route.params.sessionId ?? ''))
const session = computed(() => learning.getSession(sessionId.value))
const entry = computed(() => session.value?.questions[session.value.currentIndex])
const settled = computed(() =>
  entry.value
    ? ['first-correct', 'mastered-after-hint', 'corrected-awaiting-retest'].includes(
        entry.value.status,
      )
    : false,
)
const correcting = computed(() =>
  entry.value ? ['awaiting-correction', 'needs-explanation'].includes(entry.value.status) : false,
)
const sessionCourse = computed(() => {
  const courseId =
    entry.value?.question.classification.courseId ??
    session.value?.questions[0]?.question.classification.courseId
  return courseId ? getCourseById(courseId) : undefined
})
const knowledgePoint = computed(() =>
  sessionCourse.value?.knowledgePoints.find(
    (point) => point.id === entry.value?.question.classification.knowledgePointId,
  ),
)
const practiceReward = computed(() =>
  entry.value ? learning.practiceRewardFor(entry.value.question.instanceId) : 0,
)
const sourceLabel = computed(() => {
  if (entry.value?.question.source === 'new-pep') return '新版同步'
  if (entry.value?.question.source === 'old-pep') return '旧版补充'
  return '已学复习'
})
const questionLabel = computed(() => {
  switch (entry.value?.question.type) {
    case 'single-choice':
      return '选一选'
    case 'fill-blanks':
    case 'fraction':
      return '填一填'
    case 'word-problem':
      return '解决问题'
    case 'english-spelling':
      return '拼一拼'
    case 'sentence-completion':
      return '补全句子'
    default:
      return '算一算'
  }
})

function resetForm(): void {
  form.value = formFromAnswer(entry.value?.lastAnswer)
}

watch(() => entry.value?.question.instanceId, resetForm, { immediate: true })
watch(sessionId, (id) => {
  if (!id || !learning.ready) return
  learning.clearMessages()
  learning.resumeSession(id)
  showAbandonConfirm.value = false
})

function playSuccessSound(): void {
  if (!learning.preferences.soundEnabled || !window.AudioContext) return
  try {
    const context = new window.AudioContext()
    const oscillator = context.createOscillator()
    const gain = context.createGain()
    oscillator.type = 'sine'
    oscillator.frequency.setValueAtTime(660, context.currentTime)
    oscillator.frequency.setValueAtTime(880, context.currentTime + 0.07)
    gain.gain.setValueAtTime(0.0001, context.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.08, context.currentTime + 0.015)
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.16)
    oscillator.connect(gain)
    gain.connect(context.destination)
    oscillator.start()
    oscillator.stop(context.currentTime + 0.17)
    oscillator.addEventListener('ended', () => void context.close())
  } catch {
    // 音频设备不可用时保留全部文字反馈。
  }
}

function submit(answer: Answer): void {
  if (!entry.value) return
  const wasSettled = settled.value
  const result = learning.submitAnswer(sessionId.value, answer)
  if (result === 'submitted' && !wasSettled && settled.value && practiceReward.value > 0) {
    playSuccessSound()
  }
  if (result === 'replaced') resetForm()
}

function advance(): void {
  learning.clearMessages()
  learning.advanceSession(sessionId.value)
}

function startComprehensive(): void {
  try {
    const id = learning.startPractice({ mode: 'comprehensive', subject: 'math' })
    if (id) void router.push({ name: 'learning-practice', params: { sessionId: id } })
  } catch {
    // 创建失败时保留在当前完成页，首页可重新尝试。
  }
}

onMounted(() => {
  if (learning.initialize()) learning.resumeSession(sessionId.value)
  window.addEventListener('storage', learning.handleStorageEvent)
})
onUnmounted(() => window.removeEventListener('storage', learning.handleStorageEvent))
</script>

<template>
  <LearningPage
    eyebrow="PRACTICE NOTEBOOK"
    :title="session?.status === 'active' ? '一步一步，把这道题算明白' : '本组学习结果'"
    :description="
      session?.mode === 'special'
        ? `${sessionCourse?.title ?? '原课程'} · 知识点专项练习 · 每组 10 题`
        : `${sessionCourse?.title ?? '原课程'} · 每日综合练习`
    "
  >
    <div v-if="learning.notice" class="learn-message" role="status">{{ learning.notice }}</div>
    <div v-if="learning.saveError" class="learn-message learn-message--error" role="alert">
      <strong>本次进度暂未保存</strong>
      <span>{{ learning.saveError }}</span>
      <span>请保留当前输入并重试，未保存前不会显示金币到账。</span>
    </div>

    <PracticeCompletion
      v-if="session && session.status !== 'active'"
      :session-id="sessionId"
      @start-comprehensive="startComprehensive"
    />

    <template v-else-if="session && entry">
      <section class="learn-practice-status learn-reveal" aria-label="练习进度">
        <div>
          <span>本组进度</span>
          <strong>第 {{ session.currentIndex + 1 }} / {{ session.questions.length }} 题</strong>
        </div>
        <div>
          <span>今日有效完成</span>
          <strong>{{ learning.today.taskCompleted }} / {{ learning.today.goal }}</strong>
        </div>
        <div>
          <span>学习金币</span>
          <strong>{{ learning.today.walletBalance }}</strong>
        </div>
      </section>

      <div v-if="learning.today.taskRemaining === 0" class="learn-note" style="margin-bottom: 20px">
        <strong>现在是加练</strong>
        新题首次答对 {{ LEARNING_RULES.practiceRewards.extraPractice.firstCorrect }} 金币、
        提示后订正 {{ LEARNING_RULES.practiceRewards.extraPractice.correctedAfterHint }} 金币、
        讲解后订正
        {{ LEARNING_RULES.practiceRewards.extraPractice.correctedAfterExplanation }} 金币；
        不再增加今日任务进度。
      </div>

      <section
        :key="entry.question.instanceId"
        class="learn-paper learn-section learn-question learn-reveal"
      >
        <div class="learn-question__meta">
          <span class="learn-tag">{{ knowledgePoint?.name ?? '综合计算' }}</span>
          <span class="learn-tag">{{ sourceLabel }}</span>
          <span class="learn-tag">{{ entry.question.difficulty }}</span>
          <span v-if="entry.retestOfInstanceId" class="learn-tag">同类变式复测</span>
        </div>

        <p class="learn-question__label">{{ questionLabel }}</p>
        <h2 class="learn-question__prompt">{{ entry.question.prompt }}</h2>

        <LearningAnswerInput
          v-if="!settled"
          v-model="form"
          :question-type="entry.question.type"
          :question="entry.question"
          :correcting="correcting"
          :disabled="learning.saving"
          @submit="submit"
        />

        <LearningFeedback
          v-if="entry.status !== 'pending'"
          :entry="entry"
          :practice-reward="practiceReward"
        />

        <div v-if="settled" class="learn-actions">
          <button type="button" class="learn-button" :disabled="learning.saving" @click="advance">
            {{
              session.currentIndex === session.questions.length - 1
                ? '查看本组结果'
                : '保存并进入下一题'
            }}
          </button>
        </div>

        <details class="learn-details learn-draft">
          <summary>打开草稿区写竖式</summary>
          <label class="learn-field">
            我的草稿（不参与判分，清空不影响答题）
            <textarea rows="5" placeholder="可以在这里写竖式或记录检查过程"></textarea>
          </label>
        </details>
      </section>

      <div class="learn-practice-footer">
        <RouterLink to="/learning" class="learn-text-button">返回首页，稍后继续</RouterLink>
        <button type="button" class="learn-text-button" @click="showAbandonConfirm = true">
          结束本组
        </button>
      </div>
      <div v-if="showAbandonConfirm" class="learn-message" role="group" aria-label="确认结束练习组">
        <span>已结算题目会保留，未做题不计入任务，也不会扣金币。</span>
        <button
          type="button"
          class="learn-button learn-button--secondary"
          @click="learning.abandonSession(sessionId)"
        >
          确认结束本组
        </button>
        <button type="button" class="learn-text-button" @click="showAbandonConfirm = false">
          继续答题
        </button>
      </div>
    </template>

    <section
      v-else-if="learning.ready && !learning.loadError"
      class="learn-paper learn-section learn-empty"
    >
      <h2>没有找到这组练习</h2>
      <p>它可能已被清理，或不属于当前浏览器。</p>
      <RouterLink class="learn-button" to="/learning">返回学习首页</RouterLink>
    </section>
  </LearningPage>
</template>

<style scoped>
.learn-practice-status {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  margin-bottom: 20px;
}

.learn-practice-status > div {
  padding: 12px 16px;
  border-bottom: 2px solid #c6c9b7;
}

.learn-practice-status span,
.learn-practice-status strong {
  display: block;
}

.learn-practice-status span {
  color: var(--learn-muted);
  font-size: 12px;
}

.learn-practice-status strong {
  margin-top: 4px;
  font-size: 18px;
}

.learn-question__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.learn-question__label {
  margin: 32px 0 4px;
  color: var(--learn-muted);
  font-size: 13px;
  font-weight: 700;
}

.learn-question__prompt {
  max-width: 820px;
  margin: 0;
  padding: 12px 0 20px;
  font-family: 'Avenir Next', 'Trebuchet MS', 'PingFang SC', sans-serif;
  font-size: clamp(28px, 5vw, 44px);
  font-weight: 750;
  line-height: 1.45;
  letter-spacing: 0.01em;
}

.learn-draft {
  margin-top: 28px;
}

.learn-draft .learn-field {
  margin-top: 16px;
}

.learn-draft textarea {
  resize: vertical;
  line-height: 1.7;
}

.learn-practice-footer {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  padding: 22px 4px;
}

@media (max-width: 520px) {
  .learn-practice-status {
    gap: 4px;
  }

  .learn-practice-status > div {
    padding: 10px 6px;
  }

  .learn-practice-status strong {
    font-size: 15px;
  }
}
</style>
