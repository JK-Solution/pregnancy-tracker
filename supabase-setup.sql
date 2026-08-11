-- 备孕记录应用 · Supabase 初始化脚本（幂等，可重复运行）
-- 使用方法：登录 Supabase → 左侧 SQL Editor → New Query → 粘贴运行
-- 注意：老库运行前已存在 "anon_all" 全开放策略，本脚本会将其删除并替换为家庭码隔离策略。

-- ========== 1. 表结构 ==========
create table if not exists public.daily_records (
  id uuid primary key default gen_random_uuid(),
  family_id text not null,
  record_date date not null,
  record_type text not null,
  data jsonb not null default '{}'::jsonb,
  by text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_records_lookup
  on public.daily_records (family_id, record_date, record_type);

alter table public.daily_records
  add constraint uq_family_date_type unique (family_id, record_date, record_type);

-- ========== 2. 行级安全（重要！旧版 using(true) 等于全库裸奔，务必更新到这段） ==========
-- 访问凭据 = 请求头 x-family-id（即家庭码）。客户端由 supabase-js 的 global.headers 自动携带。
-- 不知道家庭码的请求：读不到任何行、写不进任何行。家庭码就是钥匙，请用 8 位以上字母+数字混合。
alter table public.daily_records enable row level security;

drop policy if exists "anon_all" on public.daily_records;
drop policy if exists "family_scope" on public.daily_records;

create policy "family_scope" on public.daily_records
  for all to anon
  using (family_id = coalesce(nullif(current_setting('request.headers.x-family-id', true), ''), '###no-family###'))
  with check (family_id = coalesce(nullif(current_setting('request.headers.x-family-id', true), ''), '###no-family###'));

-- ========== 3. 条件更新函数（防止旧数据覆盖新数据） ==========
-- 客户端通过 rpc('upsert_record', ...) 调用；仅当本地修改时间 >= 远端时才覆盖。
-- security invoker：函数内 SQL 仍受 RLS 约束，传别的家庭码会被行级策略拒绝。
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

grant execute on function public.upsert_record(text, date, text, jsonb, text, timestamptz) to anon;
