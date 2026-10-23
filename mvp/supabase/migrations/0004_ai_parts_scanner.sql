-- ============================================================================
-- Migration: 0004_ai_parts_scanner.sql
-- Description: AI Parts Scanner, Taobao/1688 Search Results & Smart Pricing Engine
-- Applied after: 0001_initial_schema.sql, 0002_acquisition_controls.sql, 0003_ewd_library.sql
-- ============================================================================

create extension if not exists pgcrypto;

-- 1. ENUMS FOR PARTS SCANNER
do $$ begin
  if not exists (select 1 from pg_type where typname = 'compatibility_status') then
    create type public.compatibility_status as enum ('verified', 'probable', 'unverified');
  end if;
  if not exists (select 1 from pg_type where typname = 'scanner_provider_type') then
    create type public.scanner_provider_type as enum ('taobao', '1688', 'third_party', 'manual');
  end if;
  if not exists (select 1 from pg_type where typname = 'quote_status') then
    create type public.quote_status as enum ('draft', 'sent', 'accepted', 'rejected', 'completed');
  end if;
end $$;

-- 2. PART SCAN SESSIONS
create table if not exists public.part_scan_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  team_id uuid,
  vehicle_make text,
  vehicle_model text,
  vehicle_year smallint,
  vehicle_engine text,
  vin text,
  image_url text,
  image_storage_path text,
  blur_score numeric(5,2),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3. DETECTED PARTS
create table if not exists public.detected_parts (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.part_scan_sessions(id) on delete cascade,
  part_name_vi text not null,
  part_name_en text,
  part_name_zh text not null,
  part_category text not null,
  detected_brand text,
  detected_oem_code text,
  ocr_extracted_text text,
  specifications jsonb not null default '{}'::jsonb,
  bounding_box jsonb not null default '{"ymin":0,"xmin":0,"ymax":1,"xmax":1}'::jsonb,
  confidence_score numeric(4,2) not null default 0.80,
  user_verified boolean not null default false,
  verified_part_name text,
  created_at timestamptz not null default now()
);

-- 4. EXTERNAL PRODUCT SOURCES
create table if not exists public.external_product_sources (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  base_url text not null,
  provider_type public.scanner_provider_type not null default 'manual',
  active boolean not null default true,
  supports_image_search boolean not null default false,
  supports_keyword_search boolean not null default true,
  daily_call_limit integer not null default 1000,
  current_day_calls integer not null default 0,
  notes text,
  created_at timestamptz not null default now()
);

-- Insert standard providers if missing
insert into public.external_product_sources (code, name, base_url, provider_type, supports_image_search, supports_keyword_search)
values
  ('taobao', 'Taobao Marketplace', 'https://www.taobao.com', 'taobao', true, true),
  ('1688', 'Alibaba 1688 Wholesale', 'https://www.1688.com', '1688', true, true),
  ('elimapi', 'Elimapi E-Commerce Gateway', 'https://elimapi.com', 'third_party', true, true),
  ('manual', 'Manual Verified Search', 'https://findandfix.app', 'manual', false, true)
on conflict (code) do nothing;

-- 5. PART SEARCH QUERIES
create table if not exists public.part_search_queries (
  id uuid primary key default gen_random_uuid(),
  detected_part_id uuid references public.detected_parts(id) on delete cascade,
  source_id uuid references public.external_product_sources(id) on delete set null,
  search_type text not null check (search_type in ('image', 'keyword', 'manual_url')),
  query_payload text not null,
  status text not null default 'success' check (status in ('pending', 'success', 'failed', 'timeout')),
  error_message text,
  created_at timestamptz not null default now()
);

-- 6. PRODUCT SEARCH RESULTS
create table if not exists public.product_search_results (
  id uuid primary key default gen_random_uuid(),
  query_id uuid references public.part_search_queries(id) on delete cascade,
  source_code text not null default 'taobao',
  external_product_id text not null,
  title_original text not null,
  title_vi text,
  image_url text not null,
  detail_url text not null,
  price_cny numeric(12,2) not null,
  price_vnd numeric(15,0) not null,
  shop_name text,
  shop_location text,
  moq integer not null default 1,
  tier_prices jsonb not null default '[]'::jsonb,
  is_oem boolean not null default false,
  compatibility_status public.compatibility_status not null default 'unverified',
  compatibility_score smallint not null default 50,
  compatibility_notes text,
  is_demo boolean not null default false,
  expires_at timestamptz not null default (now() + interval '24 hours'),
  created_at timestamptz not null default now()
);

-- 7. EXCHANGE RATES
create table if not exists public.exchange_rates (
  id uuid primary key default gen_random_uuid(),
  currency_from text not null default 'CNY',
  currency_to text not null default 'VND',
  rate numeric(10,4) not null,
  source text not null default 'Vietcombank',
  is_manual_override boolean not null default false,
  updated_by uuid references auth.users(id) on delete set null,
  recorded_at timestamptz not null default now()
);

-- Insert initial sample exchange rate
insert into public.exchange_rates (currency_from, currency_to, rate, source)
values ('CNY', 'VND', 3680.0000, 'Vietcombank');

-- 8. PRICING RULES (PER GARAGE / TEAM)
create table if not exists public.pricing_rules (
  id uuid primary key default gen_random_uuid(),
  team_id uuid unique,
  user_id uuid references auth.users(id) on delete set null,
  default_markup_percent numeric(5,2) not null default 30.00 check (default_markup_percent >= 0 and default_markup_percent <= 100),
  category_markups jsonb not null default '{"wiper":30,"brake":35,"electrical":25,"filter":40}'::jsonb,
  apply_markup_on_landed_cost boolean not null default true,
  china_domestic_shipping_cny numeric(8,2) not null default 10.00,
  shipping_rate_per_kg_vnd numeric(12,0) not null default 28000,
  procurement_fee_percent numeric(5,2) not null default 2.00,
  rounding_rule text not null default 'round_1000' check (rounding_rule in ('none', 'round_1000', 'round_5000', 'round_10000')),
  updated_at timestamptz not null default now()
);

-- 9. PRICING CALCULATIONS
create table if not exists public.pricing_calculations (
  id uuid primary key default gen_random_uuid(),
  search_result_id uuid references public.product_search_results(id) on delete set null,
  source_price_cny numeric(12,2) not null,
  exchange_rate numeric(10,4) not null,
  source_price_vnd numeric(15,0) not null,
  china_shipping_vnd numeric(12,0) not null default 0,
  vn_shipping_vnd numeric(12,0) not null default 0,
  procurement_fee_vnd numeric(12,0) not null default 0,
  total_landed_cost_vnd numeric(15,0) not null,
  markup_percent numeric(5,2) not null default 30.00,
  markup_amount_vnd numeric(15,0) not null,
  suggested_garage_price_vnd numeric(15,0) not null,
  final_rounded_price_vnd numeric(15,0) not null,
  created_at timestamptz not null default now()
);

-- 10. CUSTOMER QUOTES
create table if not exists public.customer_quotes (
  id uuid primary key default gen_random_uuid(),
  team_id uuid,
  user_id uuid references auth.users(id) on delete set null,
  quote_number text not null unique,
  customer_name text not null,
  customer_phone text,
  vehicle_plate text not null,
  vehicle_description text not null,
  total_parts_amount_vnd numeric(15,0) not null default 0,
  labor_cost_vnd numeric(15,0) not null default 0,
  discount_amount_vnd numeric(15,0) not null default 0,
  tax_amount_vnd numeric(15,0) not null default 0,
  grand_total_vnd numeric(15,0) not null default 0,
  status public.quote_status not null default 'draft',
  warranty_notes text default 'Bảo hành 6 tháng theo tiêu chuẩn gara.',
  internal_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 11. QUOTE ITEMS
create table if not exists public.quote_items (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.customer_quotes(id) on delete cascade,
  part_name text not null,
  part_oem_code text,
  part_category text,
  compatibility_status public.compatibility_status not null default 'probable',
  quantity integer not null default 1 check (quantity > 0),
  unit_price_vnd numeric(15,0) not null check (unit_price_vnd >= 0),
  subtotal_vnd numeric(15,0) not null check (subtotal_vnd >= 0),
  warranty_duration text default '6 tháng',
  calculation_id uuid references public.pricing_calculations(id) on delete set null,
  created_at timestamptz not null default now()
);

-- 12. ROW LEVEL SECURITY (RLS) POLICIES
alter table public.part_scan_sessions enable row level security;
alter table public.detected_parts enable row level security;
alter table public.external_product_sources enable row level security;
alter table public.part_search_queries enable row level security;
alter table public.product_search_results enable row level security;
alter table public.exchange_rates enable row level security;
alter table public.pricing_rules enable row level security;
alter table public.pricing_calculations enable row level security;
alter table public.customer_quotes enable row level security;
alter table public.quote_items enable row level security;

-- Public/Authenticated read policies for general catalogs & rates
create policy "Allow read external sources" on public.external_product_sources for select using (true);
create policy "Allow read exchange rates" on public.exchange_rates for select using (true);

-- User-scoped access for sessions and quotes
create policy "Allow user access own sessions" on public.part_scan_sessions
  for all using (auth.uid() is null or auth.uid() = user_id) with check (auth.uid() is null or auth.uid() = user_id);

create policy "Allow user access detected parts" on public.detected_parts
  for all using (true) with check (true);

create policy "Allow user access search queries" on public.part_search_queries
  for all using (true) with check (true);

create policy "Allow user access search results" on public.product_search_results
  for all using (true) with check (true);

create policy "Allow user access pricing rules" on public.pricing_rules
  for all using (auth.uid() is null or auth.uid() = user_id) with check (auth.uid() is null or auth.uid() = user_id);

create policy "Allow user access calculations" on public.pricing_calculations
  for all using (true) with check (true);

create policy "Allow user access customer quotes" on public.customer_quotes
  for all using (auth.uid() is null or auth.uid() = user_id) with check (auth.uid() is null or auth.uid() = user_id);

create policy "Allow user access quote items" on public.quote_items
  for all using (true) with check (true);

-- Indexes for performance
create index if not exists idx_detected_parts_session on public.detected_parts(session_id);
create index if not exists idx_search_results_query on public.product_search_results(query_id);
create index if not exists idx_quote_items_quote on public.quote_items(quote_id);
create index if not exists idx_exchange_rates_time on public.exchange_rates(recorded_at desc);
create index if not exists idx_quotes_plate on public.customer_quotes(vehicle_plate);
