# syntax=docker/dockerfile:1
# 构建上下文必须是仓库根目录:docker build -f apps/web/Dockerfile .

# ---- 构建阶段:安装全部依赖并编译 shared → web(vite build)----
FROM node:22-alpine AS build
RUN npm install -g pnpm@10.34.6
WORKDIR /app

# 先复制依赖清单,利用 Docker 层缓存
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
RUN pnpm install --frozen-lockfile

# 再复制源码并构建前端产物
COPY packages/shared packages/shared
COPY apps/web apps/web
RUN pnpm --filter @type-happy/shared build && pnpm --filter @type-happy/web build

# ---- 运行阶段:nginx 托管静态产物并反代 /api 到 server 容器 ----
FROM nginx:1.27-alpine AS runtime
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1/ > /dev/null 2>&1 || exit 1
