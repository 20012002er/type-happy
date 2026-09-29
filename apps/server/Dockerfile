# syntax=docker/dockerfile:1
# 构建上下文必须是仓库根目录:docker build -f apps/server/Dockerfile .

# ---- 构建阶段:安装全部依赖并编译 shared → server ----
FROM node:22-alpine AS build
RUN npm install -g pnpm@10.34.6
WORKDIR /app

# 先复制依赖清单,利用 Docker 层缓存
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
RUN pnpm install --frozen-lockfile

# 再复制源码并构建(tsc 产物 + 课程数据 dist/data)
COPY packages/shared packages/shared
COPY apps/server apps/server
RUN pnpm --filter @type-happy/shared build && pnpm --filter @type-happy/server build

# ---- 生产依赖阶段:只安装 server 运行所需的依赖 ----
FROM node:22-alpine AS prod-deps
RUN npm install -g pnpm@10.34.6
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
RUN pnpm install --frozen-lockfile --prod --filter "@type-happy/server..."

# ---- 运行阶段:最小化 Node 运行时镜像 ----
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

# pnpm 符号链接结构:根 node_modules(.pnpm 虚拟store)+ server 局部 node_modules
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=prod-deps /app/apps/server/node_modules ./apps/server/node_modules
COPY --from=prod-deps /app/apps/server/package.json ./apps/server/package.json
COPY --from=prod-deps /app/packages/shared/package.json ./packages/shared/package.json
# 构建产物:server dist(含 data)与 shared dist(workspace 依赖解析目标)
COPY --from=build /app/apps/server/dist ./apps/server/dist
COPY --from=build /app/packages/shared/dist ./packages/shared/dist

USER node
EXPOSE 3001
HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=5 \
  CMD wget -qO- "http://127.0.0.1:${PORT:-3001}/health" || exit 1
CMD ["node", "apps/server/dist/index.js"]
