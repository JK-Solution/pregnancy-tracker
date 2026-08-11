-- 备孕记录应用 · Supabase 初始化脚本（幂等，可重复运行）
-- 使用方法：登录 Supabase → SQL Editor → New Query → 整段粘贴运行
-- 前置要求：控制台 → Authentication → Providers → 开启 "Anonymous sign-ins"（匿名登录）
--
-- 安全模型（v3）：
--   旧版 header 方案实测不可用（Supabase 网关不把自定义请求头转发给数据库 GUC），
--   本脚本改为 Supabase Auth 匿名登录：每台设备一个匿名账户（auth.uid()），
--   通过家庭码 join_family() 加入家庭；daily_records 的 RLS 按成员关系隔离。
--   家庭码只以 bcrypt 哈希存储，仅在加入时随请求发送一次。

-- ========== 1. 记录表（原有结构） ==========
create table if not exists public.daily_records (
  id uuid primary key default gen_random_uuid(),
  family_id text not null,
  record_date date not null,
  record_type text not null,
  data jsonb not null default '{}',
  by text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_records_lookup
  on public.daily_records (family_id, record_date, record_type);

-- 约束已存在时跳过（add constraint 不支持 if not exists，老库重跑会报 42P07）
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'uq_family_date_type'
      and conrelid = 'public.daily_records'::regclass
  ) then
    alter table public.daily_records
      add constraint uq_family_date_type unique (family_id, record_date, record_type);
  end if;
end $$;

-- ========== 2. 家庭与成员（新增，仅通过下方 security definer 函数访问） ==========
-- pgcrypto：若已存在（Supabase 通常装在 extensions schema）则跳过；
-- 若未安装则装到 public。join_family 的 search_path 两种都兼容。
create extension if not exists pgcrypto with schema public;

create table if not exists public.families (
  code text primary key,
  code_hash text not null,              -- bcrypt 哈希，不存明文
  created_at timestamptz not null default now()
);

create table if not exists public.family_members (
  user_id uuid not null references auth.users(id) on delete cascade,
  family_code text not null references public.families(code) on delete cascade,
  role text not null default '',
  created_at timestamptz not null default now(),
  primary key (user_id, family_code)
);

alter table public.families enable row level security;
alter table public.family_members enable row level security;
-- families 不建任何策略 = 全拒；family_members 只允许读自己的成员行（RLS 策略内子查询需要）
-- create policy 不支持 if not exists，先删后建保证幂等
drop policy if exists "members_read_own" on public.family_members;

create policy "members_read_own" on public.family_members
  for select to authenticated
  using (user_id = auth.uid());

-- ========== 3. 家庭码：加入 / 创建 ==========
-- security definer：以函数属主身份读写 families / family_members（绕过 RLS），
-- 入口校验（已登录 + 码强度）后按码加入，家庭不存在则自动创建。
create or replace function public.join_family(p_code text)
returns jsonb
language plpgsql security definer
set search_path = public, extensions, pg_temp
as $$
declare
  u uuid := auth.uid();
  created boolean := false;
begin
  if u is null then
    raise exception 'not_authenticated';
  end if;
  if p_code is null or length(p_code) < 8 or p_code !~ '^[A-Za-z0-9_]+$' then
    raise exception 'invalid_code';
  end if;
  if not exists (select 1 from public.families where code = p_code) then
    insert into public.families (code, code_hash)
    values (p_code, crypt(p_code, gen_salt('bf', 8)));
    created := true;
  end if;
  insert into public.family_members (user_id, family_code)
  values (u, p_code)
  on conflict do nothing;
  return jsonb_build_object('code', p_code, 'created', created);
end $$;

grant execute on function public.join_family(text) to authenticated;

-- ========== 4. 记录读写权限：成员隔离 ==========
-- 旧策略全部移除（anon_all 全开放 / family_scope 依赖 header GUC，均作废）
alter table public.daily_records enable row level security;

drop policy if exists "anon_all" on public.daily_records;
drop policy if exists "family_scope" on public.daily_records;
drop policy if exists "member_scope" on public.daily_records;

create policy "member_scope" on public.daily_records
  for all to authenticated
  using (exists (
    select 1 from public.family_members fm
    where fm.user_id = auth.uid() and fm.family_code = family_id
  ))
  with check (exists (
    select 1 from public.family_members fm
    where fm.user_id = auth.uid() and fm.family_code = family_id
  ));

-- ========== 5. 条件更新函数（防止旧数据覆盖新数据） ==========
-- security invoker：函数内 SQL 仍受 member_scope 约束，非成员家庭会被拒绝。
create or replace function public.upsert_record(
  p_family text,
  p_date date,
  p_type text,
  p_data jsonb,
  p_by text,
  p_ts timestamptz
) returns void
language plpgsql security invoker as $$
declare
  cur_ts timestamptz;
begin
  select updated_at into cur_ts from public.daily_records
    where family_id = p_family and record_date = p_date and record_type = p_type;
  if not found then
    insert into public.daily_records (family_id, record_date, record_type, data, by, updated_at)
    values (p_family, p_date, p_type, p_data, p_by, p_ts);
  elsif p_ts >= cur_ts then
    update public.daily_records set data = p_data, by = p_by, updated_at = p_ts
      where family_id = p_family and record_date = p_date and record_type = p_type;
  end if;
end $$;

grant execute on function public.upsert_record(text, date, text, jsonb, text, timestamptz) to authenticated;
revoke execute on function public.upsert_record(text, date, text, jsonb, text, timestamptz) from anon;
