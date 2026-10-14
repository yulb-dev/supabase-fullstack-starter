-- Personal Todo table for the starter app.
-- The API uses a server-side PostgreSQL connection and must still enforce ownership in every query.

create table if not exists public.todos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title varchar(200) not null check (char_length(trim(title)) > 0),
  completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists todos_user_id_created_at_idx
  on public.todos (user_id, created_at desc);

alter table public.todos enable row level security;

revoke all on table public.todos from anon;
grant select, insert, update, delete on table public.todos to authenticated;

drop policy if exists "Users can read their own todos" on public.todos;
create policy "Users can read their own todos"
  on public.todos for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can create their own todos" on public.todos;
create policy "Users can create their own todos"
  on public.todos for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own todos" on public.todos;
create policy "Users can update their own todos"
  on public.todos for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their own todos" on public.todos;
create policy "Users can delete their own todos"
  on public.todos for delete to authenticated
  using ((select auth.uid()) = user_id);
