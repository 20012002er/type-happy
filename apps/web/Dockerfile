# syntax=docker/dockerfile:1
# 构建上下文必须是仓库根目录:docker build -f apps/web/Dockerfile .

# ---- 构建阶段:安装全部依赖,编译 shared → server → web,并预渲染 SEO 静态快照 ----
# 预渲染脚本需要 Playwright Chromium;Playwright 不支持 alpine(musl),故构建阶段用 debian slim,
# 最终运行镜像仍为 nginx:alpine,不受影响。
FROM node:22-bookworm-slim AS build
RUN npm install -g pnpm@10.34.6
WORKDIR /app

# 先复制依赖清单,利用 Docker 层缓存
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
RUN pnpm install --frozen-lockfile

# 预渲染用 Chromium(独立层缓存,仅 playwright 版本变化时重新下载)
RUN pnpm --filter @type-happy/web exec playwright install --with-deps chromium

# 站点对外地址(sitemap.xml / robots.txt / canonical / OG 使用),可通过构建参数覆盖
ARG SITE_URL=https://type.toby-blog.com
ENV SITE_URL=$SITE_URL
ENV VITE_SITE_URL=$SITE_URL

# 再复制源码:构建 shared/server/web,gen-seo 生成 sitemap/robots,prerender 产出全路由静态快照
COPY packages/shared packages/shared
COPY apps/server apps/server
COPY apps/web apps/web
RUN pnpm --filter @type-happy/shared build \
 && pnpm --filter @type-happy/server build \
 && pnpm --filter @type-happy/web build \
 && pnpm --filter @type-happy/web prerender

# ---- 运行阶段:nginx 托管静态产物并反代 /api 到 server 容器 ----
FROM nginx:1.27-alpine AS runtime
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1/ > /dev/null 2>&1 || exit 1
