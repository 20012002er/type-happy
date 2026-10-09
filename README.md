# 打字乐园(type-happy)

一个纯打字练习网站:三大课程(**标准指法练习 / 英文练习 / 中文练习**),SVG 虚拟键盘指法引导,中文 IME 拼音逐音节判分;另含**打字游戏模块**(消气球 / 打鸭子 / 街霸 / 放置刷装备)。成绩与游戏进度均保存在浏览器本地。无账号、无排行榜、无数据库。

## 快速开始

要求 Node ≥ 20、pnpm(可通过 `corepack enable pnpm` 启用)。

```bash
pnpm install
pnpm dev          # 同时启动后端(:3001)与前端(:5173),浏览器访问 http://localhost:5173
```

常用脚本(仓库根目录):

| 命令                                  | 说明                                              |
| ------------------------------------- | ------------------------------------------------- |
| `pnpm dev`                            | 并行启动 server + web(dev proxy `/api` → `:3001`) |
| `pnpm build`                          | 全部构建(shared → server/web,拓扑序)              |
| `pnpm typecheck`                      | 全部类型检查(tsc / vue-tsc)                       |
| `pnpm lint`                           | ESLint 全仓检查                                   |
| `pnpm format`                         | Prettier 格式化                                   |
| `pnpm --filter @type-happy/web smoke` | 打字引擎冒烟测试(Node 内模拟浏览器事件)           |

## Docker 部署

一条命令启动生产环境(两个容器:nginx 托管前端 + Node 运行只读 API):

```bash
docker compose up -d --build
```

启动后访问 **http://localhost:8088**。`web` 容器内的 nginx 托管前端静态产物,并把 `/api` 与 `/health` 反向代理到 `server` 容器的 3001 端口;`server` 通过健康检查(`/health`)就绪后 `web` 才会启动。

| 操作                     | 命令                        |
| ------------------------ | --------------------------- |
| 查看日志                 | `docker compose logs -f`    |
| 停止并移除容器           | `docker compose down`       |
| 重新构建镜像             | `docker compose build`      |

说明:

- 对外端口在 `docker-compose.yml` 的 `web.ports`(默认 `8088:80`)中修改;
- `server` 的 3001 端口默认只在 compose 内部网络可达,需要从宿主机直连 API 时取消该服务 `ports` 的注释;
- 两个 Dockerfile(`apps/server/Dockerfile`、`apps/web/Dockerfile`)均以**仓库根目录**为构建上下文的多阶段构建,单独构建示例:`docker build -f apps/server/Dockerfile .`;
- nginx 反代地址写死为 compose 服务名 `server:3001`(`apps/web/nginx.conf`),改服务名需同步修改。

## 项目结构

```
type-happy/
├── packages/shared/          # @type-happy/shared:前后端共享 TS 类型
├── apps/
│   ├── server/               # @type-happy/server:Fastify 只读 API
│   │   ├── src/index.ts          # 启动、CORS、健康检查
│   │   ├── src/data-loader.ts    # JSON 加载 + zod 校验(启动时全量读入内存)
│   │   ├── src/routes/courses.ts # 课程/关卡路由
│   │   ├── src/data/             # 课程内容 JSON(一课一文件)
│   │   ├── scripts/gen-content.mjs # 内容生成器
│   │   └── Dockerfile            # 后端 API 生产镜像(Node 运行时,多阶段构建)
│   └── web/                  # @type-happy/web:Vue 3 SPA
│       ├── src/composables/      # useTypingEngine / useChineseEngine / useKeyGame / useFightGame / useStats
│       ├── src/components/       # 虚拟键盘、打字区、拼音打字区、统计、结算
│       │   └── games/            # 小游戏组件(BalloonGame / DuckGame / FighterGame 及 HUD、Overlay)
│       ├── src/stores/           # progress.ts(练习进度)+ games.ts(游戏最高分),均为 Pinia + localStorage
│       ├── src/utils/            # fingerMap / keyboardLayout / format
│       ├── src/views/            # Home / CourseList / CourseDetail / Practice / GameList + 各游戏页
│       ├── games/vue-idle-game/  # 放置刷装备源码(vendored,Vue 2 独立构建,见「游戏模块」)
│       ├── public/games/idle/    # vue-idle-game 构建产物,由 vite 原样托管在 /games/idle/
│       ├── nginx.conf            # 前端容器 nginx:SPA 回退 + /api 反代
│       └── Dockerfile            # 前端镜像(vite 产物 + nginx)
├── docker-compose.yml        # 一键启动 web(nginx,:8088)+ server(API,:3001)
├── .dockerignore
└── README.md
```

技术栈:pnpm monorepo;前端 Vue 3 + Vite + TypeScript + Pinia + Vue Router + Tailwind CSS v4(vite 插件方式,无 tailwind.config);后端 Node + TypeScript + Fastify + zod;课程内容为静态 JSON。

## API

| 方法 | 路径                                       | 说明                                |
| ---- | ------------------------------------------ | ----------------------------------- |
| GET  | `/api/courses`                             | 课程列表(含 lessonCount)            |
| GET  | `/api/courses/:courseId`                   | `{ course, lessons: LessonMeta[] }` |
| GET  | `/api/courses/:courseId/lessons/:lessonId` | 关卡完整内容                        |
| GET  | `/health`                                  | 健康检查                            |

courseId:`fingering` / `english` / `chinese`。非法 id 返回 404。

## 核心机制

### 字符级引擎(指法/英文)

监听全局 `keydown`;首次按键启动计时;错误字符标红计错,退格可修正;**最后一个字符输入正确时结算**。输入法组合事件期间自动挂起。WPM 采用 5 字符 = 1 词换算。

### 中文 IME 拼音比对

- 隐藏 input 保持焦点,监听 `compositionstart/update/end` 与 `input` 事件;
- 组合中:拼音(去声调)与当前起连续汉字的音节逐字母比对,实时着色;
- 上屏后:按音节切片比对,**拼音完全匹配即正确**(同音字不误判);不匹配标错并前进,不阻塞;
- 兼容 Chrome(compositionend 后跟随 input)与 Safari(input 先于 compositionend)两种事件顺序,按 composition session 去重;
- 标点由输入法直接上屏,按字符相等比对(内容数据统一使用全角标点);
- 输入法关闭时退化为手动拼音缓冲比对,空格作为音节分隔兜底;
- 多音字由内容 JSON 固定读音,不做运行时消歧。

### 虚拟键盘

数据驱动 SVG:主键盘区布局表 + 键位→手指映射(8 指分色 + 拇指),高亮下一个目标键、大写上档时提示对侧 Shift、按键对错闪烁反馈。中文课高亮当前音节首字母。键盘下方叠加双手手势提示图:待击键对应的手指(大写时为对侧小指按 Shift、空格为双拇指)会伸向目标键并高亮,带 120ms 过渡动画。

### 进度存储

- localStorage key:`type-happy:progress:v1`,版本化便于迁移;
- 每关记录 `{ best, attempts, history(≤20) }`;最佳按 WPM(同分比准确率);
- 关卡**线性解锁**:完成第 N 关解锁第 N+1 关;
- 练习中途离开页面不保存本次成绩;localStorage 损坏时自动重置损坏条目。

## 游戏模块

入口 `/games`,四个小游戏,成绩均只保存在本机浏览器:

| 游戏 | 路由 | 实现 |
| ---- | ---- | ---- |
| 🎈 打字消气球 | `/games/balloon` | 原生 Vue 3 组件(`useKeyGame` 共享引擎) |
| 🦆 打字打鸭子 | `/games/duck` | 同上 |
| 🥋 打字街霸 | `/games/fighter` | 原生 Vue 3 组件(`useFightGame`,限时打单词出招) |
| ⚔️ 放置刷装备 | `/games/idle` | vendored 开源游戏 [vue-idle-game](https://github.com/Couy69/vue-idle-game)(MIT),iframe 嵌入 |

打字类游戏的最高分/连击/局数记录在 localStorage key `type-happy:games:v1`(`stores/games.ts`)。

### 放置刷装备(vue-idle-game)

- 源码位于 `apps/web/games/vue-idle-game/`(Vue 2 + vue-cli 独立子项目,**不在** pnpm workspace 与 ESLint/tsconfig 范围内,自带 `node_modules` 与 npm 脚本);
- 已做本地化改造:移除云端接口(couy.xyz 建议提交/拉取)与百度统计,**无任何外部请求**,存档仅用浏览器 localStorage(游戏内支持导出/导入存档文本);
- 构建产物提交在 `apps/web/public/games/idle/`,由 vite 作为静态资源托管在 `/games/idle/`,主站页面 `IdleGameView.vue` 以 iframe 嵌入;
- 修改源码后重新构建并同步产物:

```bash
cd apps/web/games/vue-idle-game
npm install --legacy-peer-deps   # 首次
npm run build                    # 内置 --openssl-legacy-provider,兼容新版 Node
rsync -a --delete dist/ ../../public/games/idle/
```

## 内容扩充指南

课程数据位于 `apps/server/src/data/<courseId>/lesson-XX.json`,一课一文件,启动时由 zod 校验加载。**推荐通过生成器维护**:编辑 `apps/server/scripts/gen-content.mjs` 中的课程数组后运行:

```bash
node apps/server/scripts/gen-content.mjs
```

生成器会清空三个课程目录并重写全部关卡(紧凑编写格式:指法/英文传文本,中文传文本 + 空格分隔的无声调拼音,标点自动占位并归一化为全角)。

也可以直接手写 JSON,格式:

```jsonc
// 指法/英文关卡
{
  "id": "f-21",            // 课程内唯一
  "courseId": "fingering",
  "index": 21,             // 课程内唯一,决定关卡顺序
  "title": "关卡标题",
  "description": "可选说明",
  "content": { "kind": "text", "text": "练习文本,\n换行需按 Enter", "showKeyboard": true }
}

// 中文关卡(多音字在此固定读音)
{
  "id": "c-16",
  "courseId": "chinese",
  "index": 16,
  "title": "关卡标题",
  "content": {
    "kind": "pinyin",
    "chars": [{ "char": "你", "pinyin": "ni" }, { "char": "。", "pinyin": "。" }]
  }
}
```

## 已知边界

- 中文课需在系统拼音输入法下练习;输入法关闭时按手动拼音缓冲判定,体验降级但可用;
- IME 候选窗位置跟随隐藏 input(位于当前汉字下方),个别输入法可能略有偏移;
- 生产部署:推荐 `docker compose up -d --build` 一键启动(见上文「Docker 部署」);也可手动 `pnpm build` 后 `pnpm --filter @type-happy/server start`(内置只读 API,前端产物需另行静态托管或将 proxy 指回)。
