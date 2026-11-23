<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { useLearningStore } from '../../stores/learning'
import '../../learning/learning.css'

defineProps<{
  eyebrow?: string
  title: string
  description?: string
}>()

const learning = useLearningStore()
</script>

<template>
  <div class="learn-page" :class="{ 'learn-no-motion': !learning.preferences.animationsEnabled }">
    <div class="learn-page__inner">
      <nav class="learn-local-nav" aria-label="学习模块导航">
        <RouterLink to="/learning" exact-active-class="is-active">学习首页</RouterLink>
        <RouterLink to="/learning/tasks" active-class="is-active">今日任务</RouterLink>
        <RouterLink to="/learning/farm" active-class="is-active">学习农场</RouterLink>
        <RouterLink to="/learning/records" active-class="is-active">金币流水</RouterLink>
        <RouterLink to="/learning/parent" active-class="is-active">家长设置</RouterLink>
        <span class="learn-local-nav__coin" aria-label="学习金币余额">
          <span aria-hidden="true">●</span>
          {{ learning.today.walletBalance }} 金币
        </span>
      </nav>

      <header class="learn-heading learn-reveal">
        <div>
          <p v-if="eyebrow" class="learn-eyebrow">{{ eyebrow }}</p>
          <h1>{{ title }}</h1>
          <p v-if="description" class="learn-heading__description">{{ description }}</p>
        </div>
        <slot name="heading-action" />
      </header>

      <div v-if="learning.loadError" class="learn-message learn-message--error" role="alert">
        <strong>学习数据暂时不可用</strong>
        <span>{{ learning.loadError }}</span>
        <button type="button" class="learn-text-button" @click="learning.refresh()">
          重新读取
        </button>
      </div>

      <slot />
    </div>
  </div>
</template>
