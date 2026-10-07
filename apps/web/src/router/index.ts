import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('../views/HomeView.vue'),
      meta: { title: '首页' },
    },
    {
      path: '/courses',
      name: 'courses',
      component: () => import('../views/CourseListView.vue'),
      meta: { title: '全部课程' },
    },
    {
      path: '/courses/:courseId',
      name: 'course-detail',
      component: () => import('../views/CourseDetailView.vue'),
      props: true,
      meta: { title: '课程' },
    },
    {
      path: '/courses/:courseId/lessons/:lessonId',
      name: 'practice',
      component: () => import('../views/PracticeView.vue'),
      props: true,
      meta: { title: '练习' },
    },
    {
      path: '/games',
      name: 'games',
      component: () => import('../views/GameListView.vue'),
      meta: { title: '打字游戏' },
    },
    {
      path: '/games/balloon',
      name: 'game-balloon',
      component: () => import('../views/BalloonGameView.vue'),
      meta: { title: '打字消气球' },
    },
    {
      path: '/games/duck',
      name: 'game-duck',
      component: () => import('../views/DuckGameView.vue'),
      meta: { title: '打字打鸭子' },
    },
    {
      path: '/games/fighter',
      name: 'game-fighter',
      component: () => import('../views/FighterGameView.vue'),
      meta: { title: '打字街霸' },
    },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
  scrollBehavior: () => ({ top: 0 }),
})

router.afterEach((to) => {
  const title = typeof to.meta.title === 'string' ? to.meta.title : ''
  document.title = title ? `${title} · 打字乐园` : '打字乐园'
})

export default router
