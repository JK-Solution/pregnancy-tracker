-- 备孕记录应用 · Supabase 初始化脚本
-- 使用方法：登录 Supabase → 左侧 SQL Editor → New Query → 粘贴运行

-- 1. 创建记录表（一行 = 某天某类型的一条记录）
create table if not exists public.daily_records (
  id uuid primary key default gen_random_uuid(),
  family_id text not null,
  record_date date not null,
  record_type text not null,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. 查询索引 + 唯一约束（同一天同一类型只存一行，upsert 用）
create index if not exists idx_records_lookup
  on public.daily_records (family_id, record_date, record_type);

alter table public.daily_records
  add constraint uq_family_date_type unique (family_id, record_date, record_type);

-- 3. 开启行级安全并允许匿名读写（数据通过 family_id 隔离，此码即访问钥匙）
alter table public.daily_records enable row level security;

create policy "anon_all" on public.daily_records
  for all to anon using (true) with check (true);
