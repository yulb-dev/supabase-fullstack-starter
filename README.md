# PostgreSQL Full-Stack Starter

前后端分离的 TypeScript 全栈工程模板，目标是给真实项目一个可扩展、可检查、可部署的起点，而不只是一个 Todo 示例。

**Supabase 在本项目中只提供 PostgreSQL。** 登录、注册和会话由运行在 Fastify 服务中的 Better Auth 处理；应用运行时不依赖 Supabase Auth、Storage、Realtime 或 Edge Functions。Supabase CLI 只用于管理 PostgreSQL migration。

## 技术栈

| 层 | 组件 |
|---|---|
| 前端 | React 19、TypeScript、Vite、React Router、Tailwind CSS 4 |
| 数据请求/表单 | TanStack Query、React Hook Form、Zod |
| 后端 | Node.js 24、Fastify 5、TypeScript、REST API |
| 认证 | Better Auth、邮箱/密码、HTTP-only session cookie |
| 数据库 | Supabase PostgreSQL、Drizzle ORM、Postgres.js |
| API 文档/安全 | OpenAPI、Swagger UI、Helmet、安全 Origin 校验、Rate Limit |
| 质量工具 | ESLint、Prettier、Vitest、React Testing Library、Node test runner、Playwright |
| 交付 | GitHub Actions CI、Dependabot、Docker、Docker Compose |

直接依赖使用精确版本，避免 semver 范围导致直接依赖静默漂移。项目需要提交 `pnpm-lock.yaml` 才能冻结完整的传递依赖。首次在 `main` 分支推送后，CI 会在质量检查通过时生成并尝试提交锁文件；后续 CI 和 Docker 构建检测到锁文件后会使用 `--frozen-lockfile`。如果仓库开启了禁止 GitHub Actions 推送的分支保护，CI 会给出 warning，需要在本地运行 `pnpm install` 后手动提交生成的 `pnpm-lock.yaml`。

## 项目结构

```text
apps/
  web/
    src/
      pages/                  # React Router pages
      lib/                    # Better Auth client + API client
      App.tsx
      App.test.tsx
      main.tsx
    vitest.config.ts
  api/
    src/
      db/                     # Drizzle schema + PostgreSQL connection
      modules/todos/          # Todo CRUD + schema validation
      plugins/auth.ts         # Better Auth server + session guard
      app.ts                  # Fastify plugins, route registration, error handling
      index.ts
      app.test.ts
supabase/
  migrations/                 # Better Auth tables + application schema
e2e/
  app.spec.ts                 # Playwright smoke tests
.github/
  workflows/ci.yml
  dependabot.yml
Dockerfile.api
Dockerfile.web
docker-compose.yml
```

## 前置条件

- Node.js **24 LTS**（最低兼容 Node.js 22.12）
- pnpm **12.11.2**
- 一个 Supabase 项目，用于托管 PostgreSQL
- Docker / Docker Compose（仅在使用容器部署时需要）

## 1. 配置 PostgreSQL 和认证密钥

在 [Supabase Dashboard](https://supabase.com/dashboard) 创建或选择一个项目，进入 **Connect → Database** 获取 PostgreSQL 连接字符串。常驻 Node.js API 通常使用 Session Pooler；特殊字符必须按 URI 规则编码。

复制环境变量模板：

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
```

编辑 `apps/api/.env`：

- `DATABASE_URL`：Supabase PostgreSQL 连接字符串，只能存在于服务端环境。
- `BETTER_AUTH_SECRET`：生成一个随机密钥。可用 `openssl rand -base64 32`。
- `BETTER_AUTH_URL`：本地为 `http://localhost:4000`；部署时改成 API 的 HTTPS 公网 URL。
- `WEB_ORIGIN`：前端的完整 origin，本地默认 `http://localhost:5173`；部署时设为正式站点的 origin。

编辑 `apps/web/.env`，设置 `VITE_API_BASE_URL`，本地默认 `http://localhost:4000`。前端变量会被编译到浏览器里，**永远不要把数据库连接串、数据库密码或 Better Auth secret 放入 `VITE_` 变量。**

## 2. 安装与数据库迁移

```bash
pnpm install
pnpm exec supabase login
pnpm exec supabase link --project-ref <你的-project-ref>
pnpm db:push
```

迁移创建 Better Auth 所需的 `user`、`session`、`account`、`verification` 表，以及 Todo 表；相关表启用 RLS，但没有给 Supabase Data API 的 `anon` / `authenticated` 角色开放查询策略。应用通过后端私有 `DATABASE_URL` 访问数据，并在 Fastify 中检查会话和资源所有权。

> 旧版模板曾把 Todo 用户 ID 关联到 Supabase Auth 的 `auth.users`。新方案改用 Better Auth 的 `public.user`。如果项目已有旧用户或 Todo 数据，先备份并处理 ID 映射，再应用升级 migration；旧登录身份不会自动迁移。

## 3. 本地开发

```bash
pnpm dev
```

- Web：<http://localhost:5173>
- API health：<http://localhost:4000/health>
- Swagger UI：<http://localhost:4000/docs>
- 机器可读 OpenAPI：<http://localhost:4000/openapi.json>

认证使用 Better Auth 的 HTTP-only cookie；前端通过 `credentials: include` 发送 cookie。写入 Todo 的请求必须携带允许的 `Origin`。生产环境必须使用 HTTPS。

## 4. 常用脚本

```bash
pnpm dev             # 同时启动 Web 与 API
pnpm lint            # ESLint
pnpm format          # Prettier 格式化
pnpm format:check    # 检查格式
pnpm typecheck       # API 与前端 TypeScript 检查
pnpm test            # API + 前端单元测试
pnpm test:coverage   # 前端覆盖率
pnpm test:e2e        # Playwright Chromium smoke tests
pnpm build           # 构建 API 与 Web
pnpm check           # lint + typecheck + tests + build
pnpm db:push         # 推送 SQL migration
pnpm db:status       # 查看 migration 状态
```

前端测试使用 Vitest 与 React Testing Library；API smoke tests 使用 Node.js test runner 与 Fastify `inject`；Playwright 验证应用启动和路由回退。CI 将运行 lint、typecheck、单元/ API 测试、生产构建和 Playwright E2E。

## API 路由

Better Auth endpoints 位于 `/api/auth/*)。业务路由如下：

| Method | Path | 说明 |
|---|---|---|
| `GET` | `/health` | 健康检查，不泄漏密钥 |
| `GET` | `/openapi.json` | 由 Fastify route schemas 生成的 OpenAPI |
| `GET` | `/docs` | Swagger UI |
| `GET` | `/api/v1/todos` | 获取当前用户 Todo |
| `POST` | `/api/v1/todos` | 创建 Todo，body: `{ "title": "..." }` |
| `PATCH` | `/api/v1/todos/:id` | 更新标题或完成状态 |
| `DELETE` | `/api/v1/todos/:id` | 删除 Todo |

业务接口的请求参数由 Fastify JSON Schema 验证，错误响应使用统一的 `{ error: { code, message } }` 结构。

## 安全边界

- Supabase 仅作为托管 PostgreSQL；应用运行时不调用 Supabase Auth、Storage、Realtime 或 Edge Functions。
- 数据库连接串和 Better Auth secret 只放在 API 服务器环境。
- Fastify 使用 Helmet 安全响应头、CORS allowlist、全局请求速率限制，以及认证写入端点更严格的速率限制。
- Todo 的 POST / PATCH / DELETE 检查 `Origin` 是否在 `WEB_ORIGIN` allowlist 中；Better Auth 另外使用 `trustedOrigins`。
- RLS 为相关表启用但不向浏览器角色开放策略，应用通过服务端数据库连接访问。数据库 owner / 高权限服务端连接可以绕过 RLS，因此 API 仍需校验用户会话和资源所有权。
- 当前限流器使用进程内存；多副本部署时应配置共享限流存储（例如 Redis）。
- 生产环境必须使用 HTTPS、精确的 `WEB_ORIGIN`、强随机 `BETTER_AUTH_SECRET`、数据库备份和日志监控。生产部署前请审查 Helmet CSP、代理头信任配置以及跨域 cookie 策略。

## Docker 部署

准备好 `apps/api/.env`（至少包含 `DATABASE_URL`、`BETTER_AUTH_URL`、`BETTER_AUTH_SECRET` 和正确的 `WEB_ORIGIN`），然后：

```bash
docker compose build
docker compose up -d
```

- Web：<http://localhost:8080>
- API：<http://localhost:4000>
- Health：<http://localhost:4000/health>

Docker Compose 不会另起一个数据库容器；它连接你配置的 Supabase PostgreSQL。部署到真实域名时，把 `VITE_API_BASE_URL` 指向浏览器可访问的 API HTTPS URL，并把 `WEB_ORIGIN` 与 `BETTER_AUTH_URL` 更新到真实站点。

## 质量门禁与后续扩展

- GitHub Actions：lint、typecheck、测试、构建、浏览器 smoke tests。
- Dependabot：每周检查 npm/pnpm workspace 依赖更新。
- 接下来按业务需求再加：Redis（共享限流 / cache）、队列、文件对象存储、邮件服务和观测平台；这些不是基础模板的强制依赖。
