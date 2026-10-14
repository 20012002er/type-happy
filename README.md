# 打字乐园(type-happy)

一个纯打字练习网站:三大课程(**标准指法练习 / 英文练习 / 中文练习**),SVG 虚拟键盘指法引导,中文 IME 拼音逐音节判分;另含**游戏模块**(消气球 / 打鸭子 / 街霸 / 放置刷装备 / 涂鸦跳跃 / 放置武林)。成绩与游戏进度均保存在浏览器本地。无账号、无排行榜、无数据库。

## 快速开始

要求 Node ≥ 20、pnpm(可通过 `corepack enable pnpm` 启用)。

```bash
pnpm install
pnpm dev          # 同时启动后端(:3001)与前端(:5173),浏览器访问 http://localhost:5173
```

常用脚本(仓库根目录):

| 命令                                      | 说明                                                  |
| ----------------------------------------- | ----------------------------------------------------- |
| `pnpm dev`                                | 并行启动 server + web(dev proxy `/api` → `:3001`)     |
| `pnpm build`                              | 全部构建(shared → server/web,拓扑序)                  |
| `pnpm typecheck`                          | 全部类型检查(tsc / vue-tsc)                           |
| `pnpm lint`                               | ESLint 全仓检查                                       |
| `pnpm format`                             | Prettier 格式化                                       |
| `pnpm --filter @type-happy/web smoke`     | 打字引擎冒烟测试(Node 内模拟浏览器事件)               |
| `pnpm --filter @type-happy/web prerender` | 预渲染全部路由为静态 HTML(SEO,见「SEO」章节)          |
| `node apps/web/scripts/e2e-doodle.mjs`    | 涂鸦跳跃 Playwright e2e(需 dev server,见「涂鸦跳跃」) |
| `node apps/web/scripts/e2e-wulin.mjs`     | 放置武林 Playwright e2e(需 dev server,见「放置武林」) |

## Docker 部署

一条命令启动生产环境(两个容器:nginx 托管前端 + Node 运行只读 API):

```bash
docker compose up -d --build
```

启动后访问 **http://localhost:8088**。`web` 容器内的 nginx 托管前端静态产物,并把 `/api` 与 `/health` 反向代理到 `server` 容器的 3001 端口;`server` 通过健康检查(`/health`)就绪后 `web` 才会启动。

| 操作           | 命令                     |
| -------------- | ------------------------ |
| 查看日志       | `docker compose logs -f` |
| 停止并移除容器 | `docker compose down`    |
| 重新构建镜像   | `docker compose build`   |

说明:

- 对外端口在 `docker-compose.yml` 的 `web.ports`(默认 `8088:80`)中修改;
- 站点对外地址通过构建参数注入(sitemap/robots/canonical/OG 使用):`SITE_URL=https://type.toby-blog.com docker compose up -d --build`(默认即该域名);
- 构建参数 `PRERENDER`(默认 `true`)控制是否在**构建阶段**下载 Chromium Headless Shell 并预渲染全部路由;运行镜像始终是 nginx:alpine + 静态产物(约 50MB + 7MB dist),**不含** Node/Playwright/Chromium。`PRERENDER=false docker compose build` 可获得最小构建资源占用,代价是不执行 JS 的爬虫(百度)只能抓到入口壳 meta;
- `server` 的 3001 端口默认只在 compose 内部网络可达,需要从宿主机直连 API 时取消该服务 `ports` 的注释;
- 两个 Dockerfile(`apps/server/Dockerfile`、`apps/web/Dockerfile`)均以**仓库根目录**为构建上下文的多阶段构建,单独构建示例:`docker build -f apps/server/Dockerfile .`;
- nginx 反代地址为 compose 服务名 `server:3001`(`apps/web/nginx.conf`),改服务名需同步修改;`proxy_pass` 使用变量 + Docker 内置 DNS resolver,server 容器重建换 IP 后无需 reload;
- nginx 已开启 `absolute_redirect off`,放在 TLS 终止代理(https)之后部署时,目录补斜杠等 301 不会因 http 绝对地址被浏览器当作混合内容拦截。

## SEO

面向搜索引擎(含不执行 JS 的 Baiduspider)的完整优化,构建管线自动完成,无需手动操作:

| 能力                                  | 实现                                                                                                                        |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| 每页独立 TDK(title/description)       | `@unhead/vue`:路由 meta 提供默认值,课程/关卡页在数据加载后动态覆盖                                                          |
| canonical / Open Graph / Twitter Card | 全部路由自动注入,地址基于 `VITE_SITE_URL`(默认 https://type.toby-blog.com)                                                  |
| 结构化数据 JSON-LD                    | 首页 `WebSite`;游戏页 `VideoGame`;课程/游戏列表页 `ItemList`;课程与关卡页 `BreadcrumbList`                                  |
| sitemap.xml / robots.txt              | `scripts/gen-seo.mjs` 构建时从课程 JSON 生成(64 个 URL),产物在 `public/`,不入库                                             |
| **静态预渲染**                        | `scripts/prerender.mjs` 用 Playwright 把全部 64 个路由渲染成静态 HTML 快照写入 `dist/`,爬虫无需执行 JS 即可抓取正文与 meta  |
| nginx 快照分发                        | `try_files $uri $uri/index.html /index.html`:干净 URL 直接命中预渲染快照,内部重写无 301;HTML 一律 no-cache                  |
| 站点图标 / PWA manifest               | `public/favicon.svg`(设计源)由 `scripts/gen-icons.mjs` 生成 `.ico`/PNG 全尺寸集与 `manifest.webmanifest`,图标变更时手动重跑 |

本地构建 + 预渲染(与 Docker 构建产物一致):

```bash
pnpm build                              # 含 gen-seo(sitemap/robots)与入口壳缓存
pnpm --filter @type-happy/web prerender # 需本机已安装 Playwright Chromium
```

Docker 构建(web 镜像)默认内置以上全部步骤:构建阶段基于 `node:22-bookworm-slim`(Playwright 不支持 alpine),仅安装 **Chromium Headless Shell**(约 100MB,无头渲染无需完整浏览器,独立层缓存)完成 build + prerender;pnpm 依赖安装用 `--filter` 裁剪,不含仓库根的 lint/format 工具。最终运行镜像仍为 nginx:alpine,不携带任何浏览器/测试组件。追求最小构建资源时可 `PRERENDER=false`(见「Docker 部署」),换域名用 `SITE_URL` 构建参数覆盖。

预渲染实现要点(`scripts/prerender.mjs`):启动 server(随机高位端口,`LOG_LEVEL=silent`)与 `vite preview`(代理 `/api`)→ 4 并发访问每个路由,`networkidle` 后序列化 DOM 写入 `dist/<route>/index.html`;浏览器通道可用 `PRERENDER_CHANNEL` 指定(Docker 内为 `chromium-headless-shell`)。首页快照最后写入并可用 `save-shell.mjs` 缓存的干净壳还原,避免其污染其他路由的 SPA fallback;快照中的预渲染机地址(modulepreload 绝对链接)会被归一为相对路径。快照写入前会检查与 `public/` 静态产物同名冲突(iframe 游戏入口因此改名为 `game.html`),冲突时直接报错终止而非静默覆盖。

上线后到各搜索引擎站长平台提交(一次性操作):

- **Google Search Console** / **Bing Webmaster Tools**:验证站点后提交 `https://type.toby-blog.com/sitemap.xml`;
- **百度搜索资源平台**(ziyuan.baidu.com):验证站点、提交 sitemap,新内容可用「普通收录-主动推送」加速;
- canonical/og:url 已声明 https 正式域名,注意同时提交 `http→https` 与 `www/裸域` 中实际使用的唯一版本。

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
│       ├── src/composables/      # useTypingEngine / useChineseEngine / useKeyGame / useFightGame / useStats / useSeo
│       ├── src/components/       # 虚拟键盘、打字区、拼音打字区、统计、结算
│       │   └── games/            # 小游戏组件(BalloonGame / DuckGame / FighterGame / DoodleJumpGame / WulinGame 及 HUD、Overlay;wulin/ 为放置武林面板组件)
│       ├── src/games/doodle-jump/ # 涂鸦跳跃引擎(Pixi.js:game / save / trackers / audio)
│       ├── src/games/wulin/       # 放置武林引擎(sim 模拟层 / data 内容数据 / render Pixi 水墨渲染 / save / audio)
│       ├── src/stores/           # progress.ts(练习进度)+ games.ts(游戏最高分),均为 Pinia + localStorage
│       ├── src/utils/            # fingerMap / keyboardLayout / format
│       ├── src/views/            # Home / CourseList / CourseDetail / Practice / GameList + 各游戏页
│       ├── scripts/              # smoke-engines.ts(引擎冒烟)+ e2e-doodle.mjs / e2e-wulin.mjs(Playwright e2e)+ gen-seo/prerender/save-shell(SEO 构建管线)+ gen-icons.mjs(图标生成)
│       ├── games/vue-idle-game/  # 放置刷装备源码(vendored,Vue 2 独立构建,见「游戏模块」)
│       ├── public/               # 站点图标(favicon.svg/.ico、apple-touch-icon、icon-192/512、manifest.webmanifest)与 og-cover
│       ├── public/games/idle/    # vue-idle-game 构建产物(入口 game.html),托管在 /games/idle/
│       ├── public/games/doodle/  # 涂鸦跳跃静态资源(atlas / audio / img),托管在 /games/doodle/
│       ├── nginx.conf            # 前端容器 nginx:SPA 回退 + /api 反代
│       └── Dockerfile            # 前端镜像(vite 产物 + nginx)
├── docker-compose.yml        # 一键启动 web(nginx,:8088)+ server(API,:3001)
├── .dockerignore
└── README.md
```

技术栈:pnpm monorepo;前端 Vue 3 + Vite + TypeScript + Pinia + Vue Router + Tailwind CSS v4(vite 插件方式,无 tailwind.config)+ Pixi.js(涂鸦跳跃与放置武林渲染);后端 Node + TypeScript + Fastify + zod;课程内容为静态 JSON。

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

入口 `/games`,六个小游戏,成绩均只保存在本机浏览器:

| 游戏          | 路由             | 实现                                                                                        |
| ------------- | ---------------- | ------------------------------------------------------------------------------------------- |
| 🎈 打字消气球 | `/games/balloon` | 原生 Vue 3 组件(`useKeyGame` 共享引擎)                                                      |
| 🦆 打字打鸭子 | `/games/duck`    | 同上                                                                                        |
| 🥋 打字街霸   | `/games/fighter` | 原生 Vue 3 组件(`useFightGame`,限时打单词出招)                                              |
| ⚔️ 放置刷装备 | `/games/idle`    | vendored 开源游戏 [vue-idle-game](https://github.com/Couy69/vue-idle-game)(MIT),iframe 嵌入 |
| 🐸 涂鸦跳跃   | `/games/doodle`  | 自研 Pixi.js 引擎(`src/games/doodle-jump/`),Doodle Jump 逆向重制                            |
| 🏯 放置武林   | `/games/wulin`   | 自研 Vue 3 + Pixi.js(`src/games/wulin/`),武侠放置 RPG,玩法致敬《放置江湖》、内容原创        |

打字类游戏的最高分/连击/局数记录在 localStorage key `type-happy:games:v1`(`stores/games.ts`);涂鸦跳跃的 bestScore 与放置武林的综合评价也汇总写入该 store。

### 涂鸦跳跃(doodle-jump)

- 引擎与元游戏系统位于 `apps/web/src/games/doodle-jump/`(Pixi.js 8):`game.ts`(物理/平台/怪物/道具)、`save.ts`(存档)、`trackers.ts`(成就与任务)、`audio.ts`(音效);静态资源(图集/音频/图片)在 `apps/web/public/games/doodle/`;
- 操作:←→ / A D 移动,画面上按住拖动倾斜移动,点击(轻点)或 Space 射击,可在选项中开启方向射击;
- 玩法内容:弹簧/蹦床/火箭等道具,怪物与 UFO,黑洞;主题解锁、成就、每局随机 3 个任务,按主题分别记录最高分/局数/击杀/死因等统计;
- 存档在 localStorage key `type-happy:doodle-jump:v1`(版本化,损坏自动回退默认档);
- Playwright e2e 覆盖加载、输入、死亡结算、存档持久化、任务/成就/选项界面与控制台无报错:

```bash
# e2e 依赖 window.__doodle 调试钩子,仅 DEV 构建暴露,须跑 dev server(而非 preview)
pnpm --filter @type-happy/web exec vite --port 5199 &
E2E_BASE=http://localhost:5199 node apps/web/scripts/e2e-doodle.mjs
```

### 放置武林(wulin)

水墨风武侠放置 RPG,**玩法机制致敬《放置江湖》、全部内容(门派/章节/NPC/武学/文案)原创**;自研 Vue 3 + Pixi.js 8,纯 SPA 内嵌(非 iframe),无任何外部请求:

- 引擎位于 `apps/web/src/games/wulin/`,三层分离:
  - `sim/`:纯 TS 模拟层(`character` 属性/面板公式、`combat` 行动条战斗、`training` 请教/练功/闭关/研究/打坐、`idle` 挂机与离线结算、`quests` 收菜/每日/签到/师门任务、`inheritance` 传承、`index` WulinSim 编排器),时钟可注入(`timeOffset`),全部懒结算(时间戳差分),离线可精确快进;
  - `data/`:类型化内容数据(4 出身、7 门派、55 式武学、~60 NPC、10 章 + 传承副本地图、~70 物品);
  - `render/`:Pixi 水墨渲染(`ink.ts` 程序化剪影小人/山水背景/墨迹粒子,`battleScene.ts` 战斗场景,`mapScene.ts` 房间地图),**零外部美术素材**,音效由 `audio.ts` WebAudio 程序合成;
- UI 为 Vue + Tailwind DOM(`components/games/WulinGame.vue` 壳 + `components/games/wulin/` 五个标签面板与 NPC/战斗子面板),Pixi 画布只负责战斗与地图;
- 核心机制(借鉴原作):行动条战斗(黄条 3.0/招式前后摇/PVE 连击 100%-60%-40% 递减/部位命中/加力/主动技能残页解锁)、先天+后天四维属性、武学等级 ≤ 人物等级且 ≤ 基本武学+1、挂机收益×综合评价×福缘×传承、精神恢复=(离线分钟/3)²、三世传承(救弟子→培养四维→属性点 30/40/50);
- 双档节奏:速成(全局 ×5,默认)/ 标准,设置页可切换,只影响后续收益与冷却;
- 存档在 localStorage key `type-happy:wulin:v1`(版本化,损坏自动回退默认档,支持导出/导入 base64 文本);综合评价通过 `stores/games.ts` 汇总到游戏列表卡;
- Playwright e2e 覆盖建角、主线推进、行走、战斗胜负、拾取、章节完成、挂机快进、收菜/签到、五面板渲染、打坐、存档持久化与完整传承流程:

```bash
# e2e 依赖 window.__wulin 调试钩子(sim/fastForward/createTest 等),仅 DEV 构建暴露
pnpm --filter @type-happy/web exec vite --port 5199 &
E2E_BASE=http://localhost:5199 node apps/web/scripts/e2e-wulin.mjs
```

### 放置刷装备(vue-idle-game)

- 源码位于 `apps/web/games/vue-idle-game/`(Vue 2 + vue-cli 独立子项目,**不在** pnpm workspace 与 ESLint/tsconfig 范围内,自带 `node_modules` 与 npm 脚本);
- 已做本地化改造:移除云端接口(couy.xyz 建议提交/拉取)与百度统计,**无任何外部请求**,存档仅用浏览器 localStorage(游戏内支持导出/导入存档文本);
- 构建产物提交在 `apps/web/public/games/idle/`,由 vite 作为静态资源托管在 `/games/idle/`,主站页面 `IdleGameView.vue` 以 iframe 嵌入;**入口文件为 `game.html`**(而非 index.html):`/games/idle` 路由的预渲染快照会写入 `dist/games/idle/index.html`,同名游戏入口会被快照覆盖,导致 iframe 里显示主站页面,改名避让(`prerender.mjs` 已内置冲突检测,再冲突会直接报错);
- 修改源码后重新构建并同步产物:

```bash
cd apps/web/games/vue-idle-game
npm install --legacy-peer-deps   # 首次
npm run build                    # 内置 --openssl-legacy-provider,兼容新版 Node
rsync -a --delete dist/ ../../public/games/idle/
mv ../../public/games/idle/index.html ../../public/games/idle/game.html
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
