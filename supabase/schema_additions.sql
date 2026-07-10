-- 律动 PULSE：聊天 / 预约 / 课时管理 —— 新增数据表
--
-- 使用方法：打开 Supabase Dashboard -> SQL Editor -> New query，
-- 把整个文件粘进去执行一次即可（可重复执行，用了 IF NOT EXISTS）。
--
-- 权限模型延续现有 diet_logs/plans 的做法：
--   - 客户本人（auth.uid() = client_id）可以读写自己的记录
--   - 任意 role='coach' 的账号可以读写所有客户的记录（app 里教练不区分归属）

-- ============ 1. 聊天 messages ============
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  sender_role text not null check (sender_role in ('coach', 'client')),
  body text not null,
  created_at timestamptz not null default now(),
  read_by_coach boolean not null default false,
  read_by_client boolean not null default false
);
create index if not exists messages_client_id_idx on public.messages(client_id, created_at);

alter table public.messages enable row level security;

drop policy if exists "messages_select" on public.messages;
create policy "messages_select" on public.messages for select
  using (
    auth.uid() = client_id
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'coach')
  );

drop policy if exists "messages_insert" on public.messages;
create policy "messages_insert" on public.messages for insert
  with check (
    sender_id = auth.uid()
    and (
      auth.uid() = client_id
      or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'coach')
    )
  );

drop policy if exists "messages_update" on public.messages;
create policy "messages_update" on public.messages for update
  using (
    auth.uid() = client_id
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'coach')
  );

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;
end $$;

-- ============ 2. 到店预约 appointments ============
create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles(id) on delete cascade,
  coach_id uuid references public.profiles(id) on delete set null,
  requested_date text not null,
  requested_time text not null,
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'declined', 'cancelled', 'completed')),
  note text,
  coach_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists appointments_client_id_idx on public.appointments(client_id, requested_date);

alter table public.appointments enable row level security;

drop policy if exists "appointments_select" on public.appointments;
create policy "appointments_select" on public.appointments for select
  using (
    auth.uid() = client_id
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'coach')
  );

drop policy if exists "appointments_insert" on public.appointments;
create policy "appointments_insert" on public.appointments for insert
  with check (
    auth.uid() = client_id
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'coach')
  );

drop policy if exists "appointments_update" on public.appointments;
create policy "appointments_update" on public.appointments for update
  using (
    auth.uid() = client_id
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'coach')
  );

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'appointments'
  ) then
    alter publication supabase_realtime add table public.appointments;
  end if;
end $$;

-- ============ 3. 课时包 session_packages ============
create table if not exists public.session_packages (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles(id) on delete cascade,
  coach_id uuid references public.profiles(id) on delete set null,
  total_sessions integer not null check (total_sessions > 0),
  used_sessions integer not null default 0 check (used_sessions >= 0),
  price numeric,
  purchase_date text not null,
  note text,
  created_at timestamptz not null default now()
);
create index if not exists session_packages_client_id_idx on public.session_packages(client_id, created_at);

alter table public.session_packages enable row level security;

drop policy if exists "session_packages_select" on public.session_packages;
create policy "session_packages_select" on public.session_packages for select
  using (
    auth.uid() = client_id
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'coach')
  );

drop policy if exists "session_packages_insert" on public.session_packages;
create policy "session_packages_insert" on public.session_packages for insert
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'coach'));

drop policy if exists "session_packages_update" on public.session_packages;
create policy "session_packages_update" on public.session_packages for update
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'coach'));
