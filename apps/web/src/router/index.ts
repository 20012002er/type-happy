import { createRouter, createWebHistory } from 'vue-router'

declare module 'vue-router' {
  interface RouteMeta {
    title?: string
    description?: string
    /** 结构化数据类型标记,App.vue 依据它注入对应 JSON-LD */
    ld?: 'VideoGame'
  }
}

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('../views/HomeView.vue'),
      meta: {
        title: '打字乐园',
        description:
          '打字乐园是免费在线打字练习网站:标准指法练习、英文打字练习、中文拼音打字三大课程,SVG 虚拟键盘指法引导,还有消气球、打鸭子、街霸、涂鸦跳跃等打字游戏。无需注册,打开浏览器即练,成绩保存在本地。',
      },
    },
    {
      path: '/courses',
      name: 'courses',
      component: () => import('../views/CourseListView.vue'),
      meta: {
        title: '全部课程',
        description:
          '打字乐园全部课程:标准指法练习、英文打字练习、中文拼音打字练习,关卡循序渐进、线性解锁,虚拟键盘实时引导指法,成绩自动保存在本地浏览器,免费无需注册。',
      },
    },
    {
      path: '/courses/:courseId',
      name: 'course-detail',
      component: () => import('../views/CourseDetailView.vue'),
      props: true,
      meta: {
        title: '课程',
        description:
          '打字练习课程关卡列表:循序渐进的关卡设计,虚拟键盘指法引导,完成上一关解锁下一关。',
      },
    },
    {
      path: '/courses/:courseId/lessons/:lessonId',
      name: 'practice',
      component: () => import('../views/PracticeView.vue'),
      props: true,
      meta: {
        title: '练习',
        description:
          '在线打字练习关卡:实时判分,统计 WPM 速度与准确率,虚拟键盘高亮下一个目标键并提示手指分工。',
      },
    },
    {
      path: '/games',
      name: 'games',
      component: () => import('../views/GameListView.vue'),
      meta: {
        title: '打字游戏',
        description:
          '免费打字游戏合集:打字消气球、打字打鸭子、打字街霸、放置刷装备、涂鸦跳跃,边玩边练打字,最高分与进度保存在本地浏览器,无需注册。',
      },
    },
    {
      path: '/games/balloon',
      name: 'game-balloon',
      component: () => import('../views/BalloonGameView.vue'),
      meta: {
        title: '打字消气球',
        description:
          '打字消气球:彩色气球带着键位从底部升起,按下对应键位扎破气球,别让它们飘到顶部!免费键位反应练习打字小游戏,最高分本地保存。',
        ld: 'VideoGame',
      },
    },
    {
      path: '/games/duck',
      name: 'game-duck',
      component: () => import('../views/DuckGameView.vue'),
      meta: {
        title: '打字打鸭子',
        description:
          '打字打鸭子:鸭子带着键位从草丛中飞出,按下对应键位让猎人开枪击落它们,别让鸭子飞走!免费趣味键位练习打字小游戏。',
        ld: 'VideoGame',
      },
    },
    {
      path: '/games/fighter',
      name: 'game-fighter',
      component: () => import('../views/FighterGameView.vue'),
      meta: {
        title: '打字街霸',
        description:
          '打字街霸:隆 VS 肯!限时打出随机英文单词即可出招,短词波动拳、长词升龙拳,打错或超时会被反击。对战式英文打字练习游戏,免费即开即玩。',
        ld: 'VideoGame',
      },
    },
    {
      path: '/games/idle',
      name: 'game-idle',
      component: () => import('../views/IdleGameView.vue'),
      meta: {
        title: '放置刷装备',
        description:
          '放置刷装备:全随机的放置类挂机小游戏,打怪掉落随机词条装备、强化升级,看看你能刷出什么样的极品!本地存档,免费无需注册。',
        ld: 'VideoGame',
      },
    },
    {
      path: '/games/doodle',
      name: 'game-doodle',
      component: () => import('../views/DoodleGameView.vue'),
      meta: {
        title: '涂鸦跳跃',
        description:
          '涂鸦跳跃:重制自经典 Doodle Jump 的免费网页游戏,踩平台、躲怪物、吃弹簧火箭道具一路向上,支持键盘与触屏操作,含主题解锁、成就与任务,进度本地保存。',
        ld: 'VideoGame',
      },
    },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
  scrollBehavior: () => ({ top: 0 }),
})

export default router
