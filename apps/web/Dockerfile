# syntax=docker/dockerfile:1
# 构建上下文必须是仓库根目录:docker build -f apps/web/Dockerfile .
#
# 运行镜像始终是 nginx:alpine + 静态产物(约 50MB),不含 Node/Playwright/Chromium。
# Playwright 仅存在于构建阶段,且不是测试用途,而是 SEO 预渲染(生成全路由静态快照)。
#
# 构建参数:
#   PRERENDER=true(默认) 安装 Chromium Headless Shell 并预渲染 61 个路由;
#                          不执行 JS 的爬虫(Baiduspider)依赖这些快照抓取正文。
#   PRERENDER=false        完全跳过浏览器下载与预渲染,构建资源占用最小,
#                          产出纯 SPA(仅入口壳带 meta,Google 可渲染,百度收录效果差)。
#   SITE_URL               站点对外地址(sitemap/robots/canonical/OG)。

FROM node:22-bookworm-slim AS build
RUN npm install -g pnpm@10.34.6
WORKDIR /app

ARG PRERENDER=true
ARG SITE_URL=https://type.toby-blog.com
ENV SITE_URL=$SITE_URL
ENV VITE_SITE_URL=$SITE_URL

# 先复制依赖清单,利用 Docker 层缓存;--filter 只装 shared/server/web 依赖树,
# 跳过仓库根的 eslint/prettier/concurrently 等与镜像构建无关的工具
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
RUN pnpm install --frozen-lockfile --filter "@type-happy/server..." --filter "@type-happy/web..."

# 仅 PRERENDER=true 时下载 Headless Shell(约 100MB,比完整 Chromium 省约 40%;
# 无头渲染不需要完整浏览器)。独立层缓存,仅 playwright 版本变化时重新下载。
ENV PRERENDER_CHANNEL=chromium-headless-shell
RUN if [ "$PRERENDER" = "true" ]; then \
      pnpm --filter @type-happy/web exec playwright install --with-deps chromium-headless-shell; \
    else \
      echo "[build] PRERENDER=false,跳过浏览器安装"; \
    fi

# 构建:gen-seo 生成 sitemap/robots → vite build →(可选)prerender 全路由快照
COPY packages/shared packages/shared
COPY apps/server apps/server
COPY apps/web apps/web
RUN pnpm --filter @type-happy/shared build \
 && pnpm --filter @type-happy/server build \
 && pnpm --filter @type-happy/web build \
 && if [ "$PRERENDER" = "true" ]; then \
      pnpm --filter @type-happy/web prerender; \
    else \
      echo "[build] PRERENDER=false,跳过预渲染"; \
    fi

# ---- 运行阶段:nginx 托管静态产物并反代 /api 到 server 容器 ----
FROM nginx:1.27-alpine AS runtime
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1/ > /dev/null 2>&1 || exit 1
