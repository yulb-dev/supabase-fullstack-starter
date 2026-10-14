-- Move authentication out of Supabase Auth and into Better Auth.
-- Supabase is now used only as the managed PostgreSQL database.
-- If a previous version has real users/todos, migrate identities before applying this:
-- old todo.user_id values reference auth.users and cannot automatically map to Better Auth users.

create table if not exists public."user" (
  id text primary key,
  name text not null,
  email text not null unique,
  "emailVerified" boolean not null default false,
  image text,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

create table if not exists public."session" (
  id text primary key,
  "expiresAt" timestamptz not null,
  token text not null unique,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now(),
  "ipAddress" text,
  "userAgent" text,
  "userId" text not null references public."user"(id) on delete cascade
);
create index if not exists session_user_id_idx on public."session" ("userId");

create table if not exists public."account" (
  id text primary key,
  "accountId" text not null,
  "providerId" text not null,
  "userId" text not null references public."user"(id) on delete cascade,
  "accessToken" text,
  "refreshToken" text,
  "idToken" text,
  "accessTokenExpiresAt" timestamptz,
  "refreshTokenExpiresAt" timestamptz,
  scope text,
  password text,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);
create index if not exists account_user_id_idx on public."account" ("userId");
create unique index if not exists account_provider_account_idx
  on public."account" ("providerId", "accountId");

create table if not exists public."verification" (
  id text primary key,
  identifier text not null,
  value text not null,
  "expiresAt" timestamptz not null,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);
create index if not exists verification_identifier_idx on public."verification" (identifier);

-- Drop legacy Supabase Auth RLS policies if the previous starter migration was applied.
drop policy if exists "Users can read their own todos" on public.todos;
drop policy if exists "Users can create their own todos" on public.todos;
drop policy if exists "Users can update their own todos" on public.todos;
drop policy if exists "Users can delete their own todos" on public.todos;

alter table public.todos drop constraint if exists todos_user_id_fkey;
alter table public.todos alter column user_id type text using user_id::text;
alter table public.todos
  add constraint todos_user_id_fkey
  foreign key (user_id) references public."user"(id) on delete cascade;

revoke all on table public.todos from anon, authenticated;
revoke all on table public."user", public."session", public."account", public."verification"
  from anon, authenticated;

alter table public.todos enable row level security;
alter table public."user" enable row level security;
alter table public."session" enable row level security;
alter table public."account" enable row level security;
alter table public."verification" enable row level security;

-- Intentionally no anon/authenticated RLS policies. Access is via the private
-- server-side DATABASE_URL, with ownership checks enforced in Fastify.
