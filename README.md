# PostgreSQL Full-Stack Starter

前后端分离的 TypeScript 项目模板：React + Vite 前端、Fastify API、Drizzle ORM，以及 Supabase 托管的 PostgreSQL 数据库。

**Supabase 在本项目中只提供 PostgreSQL 数据库。** 登录、注册和会话由运行在 Fastify 服务中的 Better Auth 处理；应用不依赖 Supabase Auth、Storage、Realtime 或 Edge Functions。

## 技术栈

- **Frontend**：React 19、TypeScript、Vite、Tailwind CSS 4、TanStack Query、React Hook Form、Zod、Better Auth React client
- **Backend**：Node.js、Fastify 5、TypeScript、REST API、Better Auth
- **Database**：Supabase PostgreSQL、Drizzle ORM、Postgres.js
- **Auth**：Better Auth 邮箱/密码认证、HTTP-only session cookie，认证数据也保存到同一个 PostgreSQL 数据库
- **Migrations**：Supabase CLI 仅用于连接项目和执行 PostgreSQL SQL migrations

## 项目结构

```text
apps/
  web/                         # React + Vite SPA
    src/lib/auth-client.ts     # Better Auth client
    src/lib/api.ts             # cookie-based API client
    src/AuthProvider.tsx
    src/App.tsx                # sign-in / sign-up / Todo demo
  api/
    src/plugins/auth.ts        # Better Auth server + session guard
    src/db/                    # Drizzle schema and PostgreSQL connection
    src/modules/todos/         # Todo CRUD endpoints
    src/app.ts                 # Fastify app and Better Auth routes
    src/index.ts
    src/app.test.ts
supabase/
  migrations/                  # auth + app tables in PostgreSQL
```

## 前置条件

- Node.js 24 LTS（最低兼容 Node.js 22.12）
- pnpm 12
- 一个 Supabase 项目（使用其 PostgreSQL connection string）

## 1. 配置数据库和密钥

在 [Supabase Dashboard](https://supabase.com/dashboard) 创建或选择项目。进入 **Connect → Database** 获取连接字符串；长期运行的 Node.js API 通常使用 Session Pooler。特殊字符应按 URI 规则编码。

复制环境变量模板：

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
```

编辑 `apps/api/.env`：

- `DATABASE_URL`：Supabase PostgreSQL 连接字符串，只能放在后端环境中。
- `BETTER_AUTH_SECRET`：用 `openssl rand -base64 32` 生成的随机密钥。
- `BETTER_AUTH_URL`：本地为 `http://localhost:4000`；部署时改成 API 的 HTTPS 公网 URL。
- `WEB_ORIGIN`：允许访问 API 的前端 origin；部署时配置成正式前端地址。

编辑 `apps/web/.env`，设置 `VITE_API_BASE_URL`（本地默认 `http://localhost:4000`）。

不要将数据库连接串、数据库密码或 Better Auth secret 放进任何 `VITE_` 变量。它们只允许存在于服务端环境。

## 2. 应用数据库迁移

```bash
pnpm install
pnpm exec supabase login
pnpm exec supabase link --project-ref <你的-project-ref>
pnpm db:push
```

迁移会在 PostgreSQL 中创建 Better Auth 所需的 `user`、`session`、`account`、`verification` 表，以及 Todo 表，并启用 RLS。没有给 `anon` 或 `authenticated` 角色开放表策略；业务数据通过后端的私有 `DATABASE_URL` 访问，Fastify 对每个 Todo 操作进行用户归属检查。

### 从旧版模板升级

旧版模板将 `todos.user_id` 关联到 Supabase Auth 的 `auth.users`。新的迁移会把外键切换到 Better Auth 的 `public.user`。**如果旧数据库中已有用户或 Todo 数据，先备份并完成用户 ID 映射，再执行迁移**；旧 Supabase Auth 身份不会自动迁移到 Better Auth。

## 3. 启动

```bash
pnpm dev
```

- Web：<http://localhost:5173>
- API health：<http://localhost:4000/health>
- OpenAPI：<http://localhost:4000/openapi.json>

创建邮箱/密码账户后即可登录，添加、完成和删除 Todo。会话用 HTTP-only cookie 传递，浏览器不保存可由 JavaScript 读取的 access token。

## 常用命令

```bash
pnpm dev          # 同时启动前端和 API
pnpm build        # 构建 API 和前端
pnpm typecheck    # TypeScript 类型检查
pnpm test         # API smoke tests
pnpm db:push      # 推送本地 SQL migration
pnpm db:status    # 查看 migration 状态
```

## API

Better Auth endpoints 使用 `/api/auth/*`。业务接口：

| Method | Path | 说明 |
|---|---|---|
| `GET` | `/health` | 健康检查 |
| `GET` | `/openapi.json` | OpenAPI 文档 |
| `GET` | `/api/v1/todos` | 获取当前用户 Todo |
| `POST` | `/api/v1/todos` | 创建 Todo，body: `{ "title": "..." }` |
| `PATCH` | `/api/v1/todos/:id` | 更新标题或完成状态 |
| `DELETE` | `/api/v1/todos/:id` | 删除 Todo |

Todo 业务路由要求有效的 Better Auth session cookie；前端通过 `credentials: include` 发送 cookie。

## 安全边界

- Supabase 只用作托管 PostgreSQL；运行时不调用 Supabase Auth、Storage、Realtime 或 Edge Functions。
- 数据库连接串与 Better Auth secret 仅保存在 API 端。
- Auth 表和 Todo 表都启用了 RLS，且没有面向 Supabase Data API 的 `anon` / `authenticated` policies。数据库 owner / 高权限服务端连接可以绕过 RLS，因此 Fastify 仍必须校验会话和资源所有权。
- 生产环境请使用 HTTPS、精确的 `WEB_ORIGIN`、强随机 `BETTER_AUTH_SECRET`、数据库备份与日志监控。
- 本项目是起步模板；部署前应在自己的 Supabase 项目上应用并验证迁移、构建和认证流程。
