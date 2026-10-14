# Supabase Full-Stack Starter

一个可扩展的前后端分离 TypeScript 项目模板：React + Vite 前端、Fastify API、Supabase Auth + PostgreSQL、Drizzle ORM。示例业务是登录后的个人 Todo CRUD。

> 本仓库只包含本地项目模板和数据库迁移，不会自动创建 Supabase 云项目，也不包含任何真实密钥。需要在自己的 Supabase 项目中配置环境变量并应用迁移。

## 技术栈

- **Frontend**：React 19、TypeScript、Vite、Tailwind CSS 4、TanStack Query、React Hook Form、Zod
- **Backend**：Node.js、Fastify 5、TypeScript、REST API
- **Database**：Supabase PostgreSQL、Drizzle ORM、Postgres.js
- **Auth**：Supabase Auth；API 在服务端校验 Bearer access token
- **Quality**：Node.js built-in test runner + Fastify `inject` smoke tests、TypeScript strict mode

依赖版本在各 `package.json` 中精确固定，避免安装时悄悄漂移。首次运行 `pnpm install` 后，请将生成的 `pnpm-lock.yaml` 一并提交，后续 CI 使用 `pnpm install --frozen-lockfile`。

## 目录结构

```text
apps/
  web/                       # React + Vite SPA
    src/
      lib/                   # Supabase client、API client
      App.tsx                # 登录/注册和 Todo 示例
      main.tsx
      styles.css
  api/                       # Fastify REST API
    src/
      db/                    # Drizzle schema + connection
      modules/todos/         # Todo CRUD routes
      plugins/               # Supabase access-token validation
      app.ts                 # Fastify app factory
      index.ts               # Server entrypoint
      app.test.ts            # API smoke tests
supabase/
  config.toml
  migrations/                # SQL migration; RLS policies included
```

## 前置要求

- Node.js **24 LTS**（最低兼容 Node.js 22.12）
- pnpm 12
- Supabase 项目
- Supabase CLI（已作为根目录 devDependency 安装，无需全局安装）

## 1. 配置 Supabase

1. 在 [Supabase Dashboard](https://supabase.com/dashboard) 创建或选择一个项目。
2. 在项目 Connect 面板中获取 **Project URL** 与 **Publishable key**。
3. 在 Connect 面板的 Database connection string 中获取连接 URI。常驻 Node.js API 推荐 **Session pooler**；如果使用 Transaction pooler，请确认连接方式适合你的部署环境。数据库密码中的特殊字符必须按 URI 规则编码。
4. 复制环境变量模板：

   ```bash
   cp apps/api/.env.example apps/api/.env
   cp apps/web/.env.example apps/web/.env
   ```

5. 填写两个 `.env` 文件。`VITE_` 开头的变量会发送给浏览器，只允许填写 Supabase Project URL、Publishable key 和 API URL；**不要将数据库连接串、数据库密码或 `service_role` / secret key 放入前端环境变量。**

### API 环境变量（`apps/api/.env`）

| 变量 | 用途 |
|---|---|
| `PORT` | Fastify 监听端口，默认 `4000` |
| `WEB_ORIGIN` | 允许跨域的前端 origin，默认 `http://localhost:5173` |
| `SUPABASE_URL` | Supabase Project URL，用于验证登录用户 |
| `SUPABASE_PUBLISHABLE_KEY` | Supabase Publishable key，用于 Auth 请求 |
| `DATABASE_URL` | 服务端 PostgreSQL 连接串，只能保存在 API 环境 |

### 前端环境变量（`apps/web/.env`）

| 变量 | 用途 |
|---|---|
| `VITE_SUPABASE_URL` | Supabase Project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase Publishable key |
| `VITE_API_BASE_URL` | Fastify API base URL，默认 `http://localhost:4000` |

## 2. 应用数据库迁移

在仓库根目录运行：

```bash
pnpm install
pnpm exec supabase login
pnpm exec supabase link --project-ref <你的-project-ref>
pnpm db:push
```

迁移会创建 `public.todos`、索引、RLS 和按 `auth.uid()` 限制的策略。先检查目标 Supabase 项目和迁移 SQL，再执行 `db:push`。不要对生产项目盲目执行未经审查的迁移。

如果通过 Supabase Dashboard 的 SQL Editor 执行，打开 `supabase/migrations/20261014160000_create_todos.sql` 并执行完整 SQL 即可；建议仍通过 Supabase CLI 管理后续迁移历史。

## 3. 启动

在项目根目录：

```bash
pnpm dev
```

- Web：<http://localhost:5173>
- API health：<http://localhost:4000/health>
- OpenAPI JSON：<http://localhost:4000/openapi.json>

先注册/登录，再创建、完成或删除 Todo。注册是否需要邮箱确认取决于 Supabase Auth 项目设置。

## 4. 常用命令

```bash
pnpm dev          # 同时启动 Web 和 API
pnpm build        # 构建 API 和 Web
pnpm typecheck    # TypeScript 类型检查
pnpm test         # API smoke tests
pnpm db:push      # 将本地 SQL migration 推送到已 link 的 Supabase 项目
pnpm db:status    # 查看 Supabase migration 状态
pnpm exec supabase --help  # 查看当前锁定版本的 CLI 命令
```

## API 路由

所有 Todo 路由都要求 `Authorization: Bearer <Supabase access token>`。

| Method | Path | 说明 |
|---|---|---|
| `GET` | `/health` | API 存活检查 |
| `GET` | `/openapi.json` | OpenAPI 文档 |
| `GET` | `/api/v1/todos` | 获取当前用户的 Todo |
| `POST` | `/api/v1/todos` | 创建 Todo，body: `{ "title": "..." }` |
| `PATCH` | `/api/v1/todos/:id` | 更新标题或完成状态 |
| `DELETE` | `/api/v1/todos/:id` | 删除 Todo |

统一错误形状：

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request payload"
  }
}
```

## 安全说明

- 前端只使用 Publishable key；不暴露 `DATABASE_URL`、数据库密码或 `service_role` / secret key。
- API 使用 `auth.getUser(accessToken)` 向 Supabase Auth 验证 token，并在每条 Todo 查询、更新和删除中同时按 `user_id` 过滤。
- Migration 对 `public.todos` 启用 RLS，默认拒绝 `anon`，并为 `authenticated` 配置 owner-only policies。直连 PostgreSQL 的高权限角色可能绕过 RLS，因此服务端业务代码仍必须进行身份与所有权校验。
- 生产部署时应设置精确的 `WEB_ORIGIN`、HTTPS、速率限制、审计日志、数据库备份与告警；示例还不是完整的生产安全基线。
- 不要把 `.env` 文件提交到 Git。

## 生产部署建议

前端构建为静态资源并部署到 CDN/静态托管；Fastify 作为单独的 Node.js 服务或容器部署；Supabase 承担 PostgreSQL 与 Auth。API 服务使用 Session pooler 或在网络支持时使用 direct connection；短生命周期 / serverless 场景另行评估 Transaction pooler 与连接上限。
