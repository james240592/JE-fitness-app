-- 律动 PULSE：聊天 / 预约 / 课时管理 —— 新增数据表
--
-- 使用方法：打开 Supabase Dashboard -> SQL Editor -> New query，
-- 把整个文件粘进去执行一次即可（可重复执行，用了 IF NOT EXISTS）。
--
-- 权限模型延续现有 diet_logs/plans 的做法：
--   - 客户本人（auth.uid() = client_id）可以读写自己的记录
--   - 任意 role='coach' 的账号可以读写所有客户的记录（app 里教练不区分归属）
--
-- 2026-07-11 补充说明：以下几处是"代码里在用、但 SQL 从没进过仓库"的补票，
-- 都是 2026-07-10 那几次改动（multi-coach client sharing / delete-student /
-- diet nutrition auto-estimation）直接在 Dashboard 手写执行、忘了回写文件导致的：
--   0. client_coaches 表 + 回填 + 新用户自动同步触发器
--   4. foods 表 + 种子数据
--   5. diet_logs 的 estimated_* 列
--   6. delete_client_account RPC

-- ============ 0. 教练-客户关系 client_coaches ============
create table if not exists public.client_coaches (
  coach_id uuid not null references public.profiles(id) on delete cascade,
  client_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (coach_id, client_id)
);
create index if not exists client_coaches_client_id_idx on public.client_coaches(client_id);

alter table public.client_coaches enable row level security;

drop policy if exists "client_coaches_select" on public.client_coaches;
create policy "client_coaches_select" on public.client_coaches for select
  using (
    auth.uid() = coach_id
    or auth.uid() = client_id
  );

drop policy if exists "client_coaches_insert" on public.client_coaches;
create policy "client_coaches_insert" on public.client_coaches for insert
  with check (
    auth.uid() = coach_id
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'coach')
  );

drop policy if exists "client_coaches_delete" on public.client_coaches;
create policy "client_coaches_delete" on public.client_coaches for delete
  using (auth.uid() = coach_id);

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
    or exists (
      select 1 from public.client_coaches cc
      where cc.client_id = messages.client_id and cc.coach_id = auth.uid()
    )
  );

drop policy if exists "messages_insert" on public.messages;
create policy "messages_insert" on public.messages for insert
  with check (
    sender_id = auth.uid()
    and (
      auth.uid() = client_id
      or exists (
        select 1 from public.client_coaches cc
        where cc.client_id = messages.client_id and cc.coach_id = auth.uid()
      )
    )
  );

drop policy if exists "messages_update" on public.messages;
create policy "messages_update" on public.messages for update
  using (
    auth.uid() = client_id
    or exists (
      select 1 from public.client_coaches cc
      where cc.client_id = messages.client_id and cc.coach_id = auth.uid()
    )
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
    or exists (
      select 1 from public.client_coaches cc
      where cc.client_id = appointments.client_id and cc.coach_id = auth.uid()
    )
  );

drop policy if exists "appointments_insert" on public.appointments;
create policy "appointments_insert" on public.appointments for insert
  with check (
    auth.uid() = client_id
    or exists (
      select 1 from public.client_coaches cc
      where cc.client_id = appointments.client_id and cc.coach_id = auth.uid()
    )
  );

drop policy if exists "appointments_update" on public.appointments;
create policy "appointments_update" on public.appointments for update
  using (
    auth.uid() = client_id
    or exists (
      select 1 from public.client_coaches cc
      where cc.client_id = appointments.client_id and cc.coach_id = auth.uid()
    )
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
    or exists (
      select 1 from public.client_coaches cc
      where cc.client_id = session_packages.client_id and cc.coach_id = auth.uid()
    )
  );

drop policy if exists "session_packages_insert" on public.session_packages;
create policy "session_packages_insert" on public.session_packages for insert
  with check (
    exists (
      select 1 from public.client_coaches cc
      where cc.client_id = session_packages.client_id and cc.coach_id = auth.uid()
    )
  );

drop policy if exists "session_packages_update" on public.session_packages;
create policy "session_packages_update" on public.session_packages for update
  using (
    exists (
      select 1 from public.client_coaches cc
      where cc.client_id = session_packages.client_id and cc.coach_id = auth.uid()
    )
  );

-- ============ 0（续）. client_coaches 回填 + 新增用户自动同步 ============
-- 回填 1：从课时包记录反推教练-客户关系
insert into public.client_coaches (coach_id, client_id)
select distinct sp.coach_id, sp.client_id
from public.session_packages sp
where sp.coach_id is not null
on conflict do nothing;

-- 回填 2：从预约记录反推教练-客户关系
insert into public.client_coaches (coach_id, client_id)
select distinct a.coach_id, a.client_id
from public.appointments a
where a.coach_id is not null
on conflict do nothing;

-- 回填 3：从历史聊天记录反推教练-客户关系（教练发过消息 = 双方存在关系）
insert into public.client_coaches (coach_id, client_id)
select distinct m.sender_id, m.client_id
from public.messages m
where m.sender_role = 'coach'
on conflict do nothing;

-- 兜底：客户完全没有课时包/预约/聊天历史就查不到关系，把所有现有教练都关联上去，
-- 恢复迁移前"任意教练可服务任意客户"的效果，避免这些客户被彻底孤立。
insert into public.client_coaches (coach_id, client_id)
select p_coach.id, p_client.id
from public.profiles p_client
cross join public.profiles p_coach
where p_client.role = 'client'
  and p_coach.role = 'coach'
  and not exists (select 1 from public.client_coaches cc where cc.client_id = p_client.id)
on conflict do nothing;

-- 遗留问题 1：新客户注册后没有自动进入 client_coaches，教练看不到新学员。
-- profiles 行是已有的 handle_new_user 触发器（不在本仓库管辖范围内）在 auth.users
-- 插入后自动创建的，这里单独挂一个触发器，在 profiles 出现新的 client / 新晋升的
-- coach 时自动补齐 client_coaches 关系：
--   - 新客户注册 -> 关联所有现有教练（沿用"任意教练可服务任意客户"的默认行为）
--   - 管理员把某人角色改成 coach -> 让这位新教练关联所有现有客户
create or replace function public.sync_client_coaches_on_profile_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role = 'client' and (tg_op = 'INSERT' or old.role is distinct from 'client') then
    insert into public.client_coaches (coach_id, client_id)
    select p.id, new.id from public.profiles p where p.role = 'coach'
    on conflict do nothing;
  elsif new.role = 'coach' and (tg_op = 'INSERT' or old.role is distinct from 'coach') then
    insert into public.client_coaches (coach_id, client_id)
    select new.id, p.id from public.profiles p where p.role = 'client'
    on conflict do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_sync_client_coaches on public.profiles;
create trigger trg_sync_client_coaches
after insert or update of role on public.profiles
for each row execute function public.sync_client_coaches_on_profile_change();

-- ============ 4. 食物营养库 foods（本地饮食估算用，src/nutritionEstimate.js 消费） ============
create table if not exists public.foods (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  aliases text[] not null default '{}',
  calories_per_100g numeric not null,
  protein_per_100g numeric not null,
  fat_per_100g numeric not null,
  carbs_per_100g numeric not null,
  default_unit_grams jsonb,
  created_at timestamptz not null default now()
);

alter table public.foods enable row level security;

drop policy if exists "foods_select" on public.foods;
create policy "foods_select" on public.foods for select
  using (auth.uid() is not null);

-- 种子数据：常见饮食，覆盖健身场景下的高频食物。按 name 去重，可重复执行。
insert into public.foods (name, aliases, calories_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, default_unit_grams) values
  ('鸡胸肉', array['鸡胸'], 133, 27, 1.9, 0, '{}'),
  ('鸡蛋', array['水煮蛋','鸡蛋羹'], 144, 13, 9.5, 1.1, '{"个": 50}'),
  ('米饭', array['白米饭','米'], 116, 2.6, 0.3, 25.9, '{"碗": 150}'),
  ('牛肉', array['瘦牛肉','牛肉片'], 125, 20, 4.2, 0, '{}'),
  ('三文鱼', array['三文鱼刺身'], 208, 20, 13, 0, '{}'),
  ('西兰花', array['花椰菜'], 34, 2.8, 0.4, 6.6, '{}'),
  ('燕麦', array['燕麦片'], 389, 16.9, 6.9, 66.3, '{"碗": 40}'),
  ('香蕉', array[]::text[], 89, 1.1, 0.3, 22.8, '{"根": 120}'),
  ('苹果', array[]::text[], 52, 0.3, 0.2, 13.8, '{"个": 180}'),
  ('牛奶', array['纯牛奶'], 54, 3.4, 3.6, 5.0, '{"杯": 240}'),
  ('豆腐', array[]::text[], 76, 8.1, 4.8, 1.9, '{"块": 100}'),
  ('红薯', array['地瓜'], 86, 1.6, 0.1, 20.1, '{"个": 150}'),
  ('全麦面包', array['吐司'], 246, 8.9, 3.4, 41.3, '{"片": 30}'),
  ('花生酱', array[]::text[], 588, 25, 50, 20, '{}'),
  ('虾', array['虾仁'], 99, 18.6, 1.4, 2.2, '{}'),
  ('猪里脊', array['瘦猪肉'], 143, 20.9, 6.2, 0, '{}'),
  ('土豆', array['马铃薯'], 77, 2, 0.1, 17, '{"个": 150}'),
  ('黄瓜', array[]::text[], 15, 0.7, 0.1, 3.6, '{}'),
  ('番茄', array['西红柿'], 18, 0.9, 0.2, 3.9, '{"个": 120}'),
  ('酸奶', array['无糖酸奶'], 62, 3.5, 3.3, 4.7, '{"杯": 200}')
on conflict (name) do nothing;

-- ============ 5. diet_logs：补充营养估算字段 ============
-- diet_logs 是这个项目最早的表，不在本仓库任何 SQL 里创建，只做补列，不重建表结构。
alter table public.diet_logs add column if not exists estimated_calories numeric;
alter table public.diet_logs add column if not exists estimated_protein numeric;
alter table public.diet_logs add column if not exists estimated_fat numeric;
alter table public.diet_logs add column if not exists estimated_carbs numeric;

-- ============ 6. delete_client_account RPC ============
-- 教练"永久删除客户账号"用，前端 App.jsx: supabase.rpc("delete_client_account", { p_client_id }).
-- 需要清掉 auth.users，这一步普通角色的 RLS 做不到，所以用 security definer（函数
-- owner 是执行本脚本的角色，在 SQL Editor 里跑就是有权限操作 auth schema 的角色）。
-- 权限校验放在函数体内：只有该客户名下的教练才能删除，delete_client_account 不认
-- 前端传参、只信 auth.uid()。
create or replace function public.delete_client_account(p_client_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.client_coaches cc
    where cc.client_id = p_client_id and cc.coach_id = auth.uid()
  ) then
    raise exception 'not authorized to delete this client';
  end if;

  delete from public.diet_logs where user_id = p_client_id;
  delete from public.body_logs where user_id = p_client_id;
  delete from public.train_logs where user_id = p_client_id;
  delete from public.plans where client_id = p_client_id;
  delete from public.posture where client_id = p_client_id;
  delete from public.posture_photos where client_id = p_client_id;
  delete from public.messages where client_id = p_client_id;
  delete from public.appointments where client_id = p_client_id;
  delete from public.session_packages where client_id = p_client_id;
  delete from public.client_coaches where client_id = p_client_id;
  delete from public.profiles where id = p_client_id;
  delete from auth.users where id = p_client_id;
end;
$$;

grant execute on function public.delete_client_account(uuid) to authenticated;
