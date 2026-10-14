# Supabase Full-Stack Starter

一个可扩展的前后端分离 TypeScript 项目模板：React + Vite 前端、Fastify API、Supabase Auth + PostgreSQL、Drizzle ORM。示例业务是登录后的个人 Todo CRUD。

> 本仓库包含本地项目模板和数据库迁移，不会自动创建 Supabase 云项目，也不包含真实密钥。

## 技术栈

- Frontend: React 19, TypeScript, Vite
- Backend: Node.js, Fastify 5, TypeScript, REST API
- Database: Supabase PostgreSQL, Drizzle ORM
- Auth: Supabase Auth; API validates Bearer access tokens

## 下一步

项目源文件将按前后端分离结构提交。配置 `.env` 时不要提交真实密钥；数据库密码和服务端密钥不得放入 `VITE_` 前端变量。
