import { createRouter, createWebHashHistory } from 'vue-router';

const router = createRouter({
  // 集成改造:主站以 iframe 嵌入 /games/wuxia/index.html,
  // history 模式在该 URL 下无法匹配根路由,改用 hash 模式保证任意托管路径可用
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      name: 'game',
      component: () => import('@/views/GameView.vue'),
      meta: {
        title: '武侠放置 · WuXia Idle'
      }
    },
    {
      path: '/settings',
      redirect: () => {
        try { localStorage.setItem('wuxia-idle-last-view', 'settings'); } catch (e) {
          console.warn('[Router] Failed to save last view:', e);
        }
        return { path: '/' };
      }
    },
    {
      path: '/about',
      name: 'about',
      component: () => import('@/views/AboutView.vue'),
      meta: {
        title: '关于'
      }
    }
  ]
});

// 路由守卫 - 设置页面标题
router.beforeEach((to) => {
  if (to.meta.title) {
    document.title = to.meta.title as string;
  }
});

export default router;
