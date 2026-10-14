-- Fresh-install PostgreSQL schema.
-- Supabase is used only as the managed PostgreSQL service; authentication is provided by Better Auth in Fastify.

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

create table if not exists public.todos (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public."user"(id) on delete cascade,
  title varchar(200) not null check (char_length(trim(title)) > 0),
  completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists todos_user_id_created_at_idx
  on public.todos (user_id, created_at desc);

-- Only the server-side DATABASE_URL should have access to these tables.
revoke all on table public.todos, public."user", public."session", public."account", public."verification"
  from anon, authenticated;

alter table public.todos enable row level security;
alter table public."user" enable row level security;
alter table public."session" enable row level security;
alter table public."account" enable row level security;
alter table public."verification" enable row level security;

-- Intentionally no anon/authenticated policies. Fastify validates sessions and
-- enforces user ownership before accessing records through the private DB connection.
