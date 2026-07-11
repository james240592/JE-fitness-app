-- 律动 PULSE：聊天 / 预约 / 课时管理 —— 新增数据表
--
-- 使用方法：打开 Supabase Dashboard -> SQL Editor -> New query，
-- 把整个文件粘进去执行一次即可（可重复执行，用了 IF NOT EXISTS）。
--
-- 权限模型（2026-07-10 multi-coach client sharing 上线后已变化，不再是"任意教练
-- 可读写任意客户"）：
--   - 客户本人（auth.uid() = client_id）可以读写自己的记录
--   - 只有通过 client_coaches 关联到该客户的教练才能读写（is_coach_of() 或等价的
--     inline EXISTS client_coaches 判断），这条规则现在覆盖 diet_logs / body_logs /
--     train_logs / plans / posture / posture_photos / messages / appointments /
--     session_packages 等全部客户数据表，即使这些表本身不在本仓库创建
--
-- 2026-07-11 补充说明：以下几处是"代码里在用、但 SQL 从没进过仓库"的补票，
-- 都是 2026-07-10 那几次改动（multi-coach client sharing / delete-student /
-- diet nutrition auto-estimation）直接在 Dashboard 手写执行、忘了回写文件导致的：
--   0. client_coaches 表 + 回填 + 新用户自动同步触发器
--   4. foods 表 + 种子数据
--   5. diet_logs 的 estimated_* 列
--   6. delete_client_account RPC
--
-- 2026-07-11（续，第二次核对）：聊天发不出消息（400）的根因是 messages 表线上
-- 实际有一个 NOT NULL 的 coach_id 列，同样是 Dashboard 手写加的、没写回本文件，
-- 前端插入时也没传这个字段。借这次修复顺带把 client_coaches 上线以来所有"线上有、
-- 仓库没有"的 schema 对象补全（第 7 节开始）。做法是逐条对着 Supabase 的
-- supabase_migrations.schema_migrations 和 pg_policies 核对当前真实生效的定义，
-- 而不是假设 CLI 迁移历史等于线上现状——这个项目里两者已经对不上了，原因见下面
-- 第 9 节的说明。

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

-- ============ 7. 权限判断函数 is_coach() / is_coach_of() ============
-- 从 multi_coach_client_relationship 那次改动起，diet_logs / body_logs / train_logs /
-- plans / posture / posture_photos / messages / appointments / session_packages /
-- storage.objects(posture-photos) 的教练侧权限判断全部改用 is_coach_of(target_client)
-- （"auth.uid() 是不是 target_client 名下 client_coaches 里的教练"），不再是
-- "role = coach 就放行"。这两个函数本身也是 Dashboard 手写、从没进过仓库。
create or replace function public.is_coach()
returns boolean
language sql
stable security definer
as $$
  select exists(select 1 from public.profiles where id = auth.uid() and role = 'coach');
$$;

create or replace function public.is_coach_of(target_client uuid)
returns boolean
language sql
stable security definer
set search_path = public
as $$
  select exists(
    select 1 from public.client_coaches
    where client_id = target_client and coach_id = auth.uid()
  );
$$;

-- ============ 8. messages：补 coach_id 列（聊天发不出消息的根因） ============
-- 线上这一列早就是 not null，前端插入时却一直没传，每次 insert 都被 400 拒绝。
-- 现在补齐建表脚本，回填历史消息（当时每个学员基本只有一位教练，按 client_coaches
-- 直接反推），并把列设为 not null，和线上保持一致。
alter table public.messages add column if not exists coach_id uuid references public.profiles(id);

update public.messages m
set coach_id = cc.coach_id
from public.client_coaches cc
where m.coach_id is null
  and cc.client_id = m.client_id;

alter table public.messages alter column coach_id set not null;

-- 注：messages_select / messages_insert / messages_update 这三条策略线上目前仍是
-- 本文件第 1 节里那种"client_coaches 里任意一位关联教练都能读写整条 client_id 会话"
-- 的判断，coach_id 只是标记"这条消息归属哪位教练"，不参与可见性判断——不是按
-- (client_id, coach_id) 拆分成一对一独立会话。之所以确定这一点，是因为
-- add_coach_id_to_messages_per_pair_threads 这条迁移历史里其实把三条策略重写成了
-- "auth.uid() = client_id or auth.uid() = coach_id"（真正按对拆分），但后来又被一次
-- "把整份 schema_additions.sql 粘进 SQL Editor 重跑一遍"的操作用本文件里更早、更宽松
-- 的版本覆盖回去了。教训：CLI 迁移历史（supabase_migrations.schema_migrations）不等于
-- 线上真实生效的定义，改之前要用 pg_policies 核对当前状态，不能只看迁移记录。

-- ============ 9. train_logs：补 coach_id 列 + 写入校验 ============
-- 学员记录训练日志时可以选择"这次是哪位教练带的"，同一批改动加的列，也没进仓库。
alter table public.train_logs add column if not exists coach_id uuid references public.profiles(id) on delete set null;

drop policy if exists "train_insert" on public.train_logs;
create policy "train_insert" on public.train_logs for insert
  with check (
    auth.uid() = user_id
    and (coach_id is null or exists (
      select 1 from public.client_coaches cc
      where cc.client_id = auth.uid() and cc.coach_id = train_logs.coach_id
    ))
  );

-- 已修复（2026-07-11）：这处判断原来线上写成了 `cc.coach_id = cc.coach_id`（自比较，
-- 恒真）而不是上面这样和新行的 coach_id 比较。子查询里 client_coaches 自己也有一列
-- 叫 coach_id，未加前缀的 `coach_id` 会先解析到子查询自己的 cc.coach_id，而不是外层
-- train_logs 新行的 coach_id，导致这条"必须是学员真实关联教练之一"的校验形同虚设——
-- 只要学员名下有任意一位教练，插入时 coach_id 传谁都能通过。上面这版加了
-- `train_logs.` 前缀是正确写法，线上策略已经同步换成这版。

drop policy if exists "train_select" on public.train_logs;
create policy "train_select" on public.train_logs for select
  using (auth.uid() = user_id or is_coach_of(user_id));

-- ============ 10. storage.objects：posture-photos 存储策略改用 is_coach_of ============
drop policy if exists "photo_object_select" on storage.objects;
create policy "photo_object_select" on storage.objects for select
  using (
    bucket_id = 'posture-photos'
    and (
      (auth.uid())::text = (storage.foldername(name))[1]
      or is_coach_of(((storage.foldername(name))[1])::uuid)
    )
  );

drop policy if exists "photo_object_insert" on storage.objects;
create policy "photo_object_insert" on storage.objects for insert
  with check (
    bucket_id = 'posture-photos'
    and (
      (auth.uid())::text = (storage.foldername(name))[1]
      or is_coach_of(((storage.foldername(name))[1])::uuid)
    )
  );

drop policy if exists "photo_object_delete" on storage.objects;
create policy "photo_object_delete" on storage.objects for delete
  using (
    bucket_id = 'posture-photos'
    and (
      (auth.uid())::text = (storage.foldername(name))[1]
      or is_coach_of(((storage.foldername(name))[1])::uuid)
    )
  );

-- ============ 11. diet_log_items：饮食记录明细（逐样食物），src/nutritionEstimate.js 消费 ============
create table if not exists public.diet_log_items (
  id uuid primary key default gen_random_uuid(),
  diet_log_id uuid not null references public.diet_logs(id) on delete cascade,
  food_id uuid references public.foods(id),
  food_name text not null,
  grams numeric not null,
  calories numeric,
  protein_g numeric,
  carbs_g numeric,
  fat_g numeric,
  created_at timestamptz not null default now()
);

alter table public.diet_log_items enable row level security;

drop policy if exists "diet_log_items_select" on public.diet_log_items;
create policy "diet_log_items_select" on public.diet_log_items for select
  using (exists (
    select 1 from public.diet_logs
    where diet_logs.id = diet_log_items.diet_log_id
    and (diet_logs.user_id = auth.uid() or is_coach_of(diet_logs.user_id))
  ));

drop policy if exists "diet_log_items_insert" on public.diet_log_items;
create policy "diet_log_items_insert" on public.diet_log_items for insert
  with check (exists (
    select 1 from public.diet_logs
    where diet_logs.id = diet_log_items.diet_log_id
    and diet_logs.user_id = auth.uid()
  ));

-- ============ 12. nutrition_goals：每日营养目标 ============
create table if not exists public.nutrition_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  daily_calories numeric,
  daily_protein numeric,
  daily_carbs numeric,
  daily_fat numeric,
  updated_at timestamptz not null default now()
);

alter table public.nutrition_goals enable row level security;

drop policy if exists "nutrition_goals_owner_all" on public.nutrition_goals;
create policy "nutrition_goals_owner_all" on public.nutrition_goals for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "nutrition_goals_coach_select" on public.nutrition_goals;
create policy "nutrition_goals_coach_select" on public.nutrition_goals for select
  using (is_coach_of(user_id));

-- ============ 13. water_logs：饮水记录 ============
create table if not exists public.water_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  date date not null default current_date,
  ml numeric not null,
  created_at timestamptz not null default now()
);

alter table public.water_logs enable row level security;

drop policy if exists "water_logs_select" on public.water_logs;
create policy "water_logs_select" on public.water_logs for select
  using (auth.uid() = user_id or is_coach_of(user_id));

drop policy if exists "water_logs_insert" on public.water_logs;
create policy "water_logs_insert" on public.water_logs for insert
  with check (auth.uid() = user_id);

drop policy if exists "water_logs_delete" on public.water_logs;
create policy "water_logs_delete" on public.water_logs for delete
  using (auth.uid() = user_id);

-- ============ 14. profiles：补 avatar_seed 列 ============
alter table public.profiles add column if not exists avatar_seed text;

-- ============ 15. auto_assign_new_client：新学员自动关联所有教练（历史遗留） ============
-- 这个函数和触发器是 multi_coach_client_relationship 那次迁移建的，只处理"新学员
-- INSERT 时关联所有教练"。本文件第 0 节里的 sync_client_coaches_on_profile_change /
-- trg_sync_client_coaches 是后来又单独手写的一版，覆盖范围更全（还处理"把某人提升为
-- 教练"的场景），但没有替换掉这一个，导致线上同时存在两个触发器，新学员注册时会
-- 各自 insert 一遍 client_coaches（有 on conflict do nothing 兜底，不会报错或重复行，
-- 纯粹是冗余）。这里如实记录现状，要不要合并成一个由你决定，不在本次改动范围内。
create or replace function public.auto_assign_new_client()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role = 'client' then
    insert into public.client_coaches (client_id, coach_id)
    select new.id, p.id from public.profiles p where p.role = 'coach'
    on conflict do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_auto_assign_new_client on public.profiles;
create trigger trg_auto_assign_new_client
after insert on public.profiles
for each row execute function public.auto_assign_new_client();
