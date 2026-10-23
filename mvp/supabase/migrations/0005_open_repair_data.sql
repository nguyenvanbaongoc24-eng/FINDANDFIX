-- Open automotive-data catalog. Apply after the existing 0001–0003 migrations.
-- This migration stores only sources with a recorded license/review status.

alter table public.data_sources drop constraint if exists data_sources_source_type_check;
alter table public.data_sources add constraint data_sources_source_type_check check(source_type in ('admin_upload','approved_crawl','sample','public_api','open_dataset','admin_contribution'));
alter table public.data_sources add column if not exists license text;
alter table public.data_sources add column if not exists attribution_text text;
alter table public.data_sources add column if not exists commercial_ok boolean;
alter table public.data_sources add column if not exists redistribution_ok boolean;
alter table public.data_sources add column if not exists license_review_status text not null default 'unknown' check(license_review_status in ('approved','review_required','unknown','rejected'));
alter table public.data_sources add column if not exists last_fetched_at timestamptz;

alter table public.dtc_codes add column if not exists description_en text;
alter table public.dtc_codes add column if not exists translation_status text not null default 'needs_review' check(translation_status in ('source','machine','reviewed','needs_review'));

create table if not exists public.vehicle_years (
  id uuid primary key default gen_random_uuid(),
  vehicle_model_id uuid not null references public.vehicle_models(id) on delete cascade,
  year smallint not null check(year between 1886 and 2100),
  trim text,
  engine text,
  fuel text,
  transmission text,
  source_id uuid not null references public.data_sources(id),
  created_at timestamptz not null default now(),
  unique(vehicle_model_id, year, trim, engine)
);

create table if not exists public.repair_fixes (
  id uuid primary key default gen_random_uuid(),
  dtc_code_id uuid not null references public.dtc_codes(id) on delete cascade,
  source_fix_key text not null,
  rank smallint not null check(rank > 0),
  title text not null,
  difficulty text,
  parts_cost_min_usd numeric(10,2),
  parts_cost_max_usd numeric(10,2),
  labor_hours numeric(8,2),
  steps text,
  source_id uuid not null references public.data_sources(id),
  created_at timestamptz not null default now(),
  unique(source_id, source_fix_key)
);

create table if not exists public.parts (
  id uuid primary key default gen_random_uuid(),
  source_part_key text not null,
  name_en text not null,
  name_vi text,
  category text,
  oem_number text,
  notes text,
  translation_status text not null default 'needs_review' check(translation_status in ('source','machine','reviewed','needs_review')),
  source_id uuid not null references public.data_sources(id),
  created_at timestamptz not null default now(),
  unique(source_id, source_part_key)
);

create table if not exists public.fix_parts (
  fix_id uuid not null references public.repair_fixes(id) on delete cascade,
  part_id uuid not null references public.parts(id) on delete cascade,
  primary key(fix_id, part_id)
);

create table if not exists public.recalls (
  id uuid primary key default gen_random_uuid(),
  campaign_no text not null,
  make text not null,
  model text not null,
  model_year smallint not null,
  component text,
  summary text,
  consequence text,
  remedy text,
  report_date date,
  source_url text not null,
  source_id uuid not null references public.data_sources(id),
  created_at timestamptz not null default now(),
  unique(source_id, campaign_no)
);

create table if not exists public.complaints (
  id uuid primary key default gen_random_uuid(),
  odi_no text not null,
  make text not null,
  model text not null,
  model_year smallint not null,
  component text,
  summary text,
  complaint_date date,
  source_url text not null,
  source_id uuid not null references public.data_sources(id),
  created_at timestamptz not null default now(),
  unique(source_id, odi_no)
);

create table if not exists public.vehicle_specs (
  id uuid primary key default gen_random_uuid(),
  vehicle_year_id uuid references public.vehicle_years(id) on delete cascade,
  type text not null check(type in ('torque','fluid_capacity','interval')),
  value text not null,
  unit text,
  source_id uuid not null references public.data_sources(id),
  created_at timestamptz not null default now()
);

create table if not exists public.data_sync_cache (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.data_sources(id),
  request_url text not null,
  response_sha256 text not null,
  fetched_at timestamptz not null default now(),
  expires_at timestamptz,
  status_code integer not null,
  unique(source_id, request_url)
);

create table if not exists public.parts_contributions (
  id uuid primary key default gen_random_uuid(),
  part_id uuid references public.parts(id) on delete set null,
  name_vi text not null,
  oem_number text,
  price_vnd numeric(14,0),
  notes text,
  contributed_by uuid references auth.users(id) on delete set null,
  verified boolean not null default false,
  verified_by uuid references auth.users(id) on delete set null,
  verified_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists repair_fixes_dtc_idx on public.repair_fixes(dtc_code_id, rank);
create index if not exists parts_search_idx on public.parts using gin (to_tsvector('simple', coalesce(name_en,'') || ' ' || coalesce(name_vi,'') || ' ' || coalesce(oem_number,'')));
create index if not exists recalls_vehicle_idx on public.recalls(make, model, model_year);
create index if not exists complaints_vehicle_idx on public.complaints(make, model, model_year);

alter table public.vehicle_years enable row level security;
alter table public.repair_fixes enable row level security;
alter table public.parts enable row level security;
alter table public.fix_parts enable row level security;
alter table public.recalls enable row level security;
alter table public.complaints enable row level security;
alter table public.vehicle_specs enable row level security;
alter table public.data_sync_cache enable row level security;
alter table public.parts_contributions enable row level security;

create policy "approved public DTC read" on public.dtc_codes for select using (exists(select 1 from public.data_sources s where s.id=source_id and s.license_review_status='approved'));
create policy "approved public repair fixes read" on public.repair_fixes for select using (exists(select 1 from public.data_sources s where s.id=source_id and s.license_review_status='approved'));
create policy "approved public parts read" on public.parts for select using (exists(select 1 from public.data_sources s where s.id=source_id and s.license_review_status='approved'));
create policy "approved public recalls read" on public.recalls for select using (exists(select 1 from public.data_sources s where s.id=source_id and s.license_review_status='approved'));
create policy "approved public complaints read" on public.complaints for select using (exists(select 1 from public.data_sources s where s.id=source_id and s.license_review_status='approved'));
create policy "approved public vehicle years read" on public.vehicle_years for select using (exists(select 1 from public.data_sources s where s.id=source_id and s.license_review_status='approved'));
