create extension if not exists pgcrypto;

create type public.rights_status as enum ('draft', 'review', 'approved', 'rejected', 'revoked');
create type public.document_status as enum ('draft', 'processing', 'awaiting_review', 'published', 'rejected', 'archived');
create type public.ingestion_status as enum ('queued', 'preflight', 'fetching', 'hashing', 'extracting', 'awaiting_review', 'published', 'rejected', 'failed', 'paused');

create table public.manufacturers (
  id uuid primary key default gen_random_uuid(), name text not null, slug text not null unique,
  country text, active boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.vehicle_models (
  id uuid primary key default gen_random_uuid(), manufacturer_id uuid not null references public.manufacturers(id) on delete cascade,
  name text not null, slug text not null, production_start_year smallint, production_end_year smallint,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(manufacturer_id, slug)
);
create table public.vehicle_variants (
  id uuid primary key default gen_random_uuid(), vehicle_model_id uuid not null references public.vehicle_models(id) on delete cascade,
  name text not null, engine_code text, engine_name text, fuel_type text, transmission text, year_from smallint, year_to smallint,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.document_categories (
  id uuid primary key default gen_random_uuid(), parent_id uuid references public.document_categories(id) on delete set null,
  name_vi text not null, slug text not null unique, sort_order integer not null default 0, created_at timestamptz not null default now()
);
create table public.data_sources (
  id uuid primary key default gen_random_uuid(), name text not null, base_url text, source_type text not null check(source_type in ('admin_upload','approved_crawl','sample')),
  terms_url text, robots_url text, rights_status public.rights_status not null default 'draft', allowed_path_prefixes text[] not null default '{}',
  approved_at timestamptz, approved_by uuid references auth.users(id), notes text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.document_licenses (
  id uuid primary key default gen_random_uuid(), name text not null, license_url text, storage_allowed boolean not null default false,
  redistribution_allowed boolean not null default false, attribution_text text, rights_status public.rights_status not null default 'draft',
  reviewed_at timestamptz, reviewed_by uuid references auth.users(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.documents (
  id uuid primary key default gen_random_uuid(), title text not null, summary text, category_id uuid references public.document_categories(id) on delete set null,
  source_id uuid not null references public.data_sources(id), license_id uuid not null references public.document_licenses(id),
  manufacturer_id uuid references public.manufacturers(id), model_id uuid references public.vehicle_models(id), variant_id uuid references public.vehicle_variants(id),
  year_from smallint, year_to smallint, status public.document_status not null default 'draft', visibility text not null default 'private' check(visibility in ('private','authenticated','public')),
  distribution_allowed boolean not null default false, created_by uuid references auth.users(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.document_files (
  id uuid primary key default gen_random_uuid(), document_id uuid not null references public.documents(id) on delete cascade,
  storage_bucket text not null default 'repair-documents', storage_path text not null unique, mime_type text not null,
  byte_size bigint not null check(byte_size > 0), sha256 text not null, page_count integer, extracted_text text, ocr_status text not null default 'not_requested' check(ocr_status in ('not_requested','queued','complete','failed')),
  view_allowed boolean not null default false, created_at timestamptz not null default now(), unique(sha256)
);
create table public.dtc_codes (
  id uuid primary key default gen_random_uuid(), code text not null, standard text not null default 'OBD-II', manufacturer_id uuid references public.manufacturers(id),
  variant_id uuid references public.vehicle_variants(id), system text not null, title_vi text not null, description_vi text, diagnostics_hint text,
  source_id uuid not null references public.data_sources(id), license_id uuid not null references public.document_licenses(id), created_at timestamptz not null default now(),
  unique(code, standard, manufacturer_id, variant_id)
);
create table public.ingestion_jobs (
  id uuid primary key default gen_random_uuid(), source_id uuid not null references public.data_sources(id), type text not null check(type in ('upload','crawl')),
  status public.ingestion_status not null default 'queued', requested_by uuid references auth.users(id), cursor jsonb not null default '{}'::jsonb,
  attempts integer not null default 0, bytes_downloaded bigint not null default 0, error text, audit_log jsonb not null default '[]'::jsonb,
  started_at timestamptz, finished_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.user_bookmarks (
  user_id uuid not null references auth.users(id) on delete cascade, document_id uuid not null references public.documents(id) on delete cascade,
  created_at timestamptz not null default now(), primary key(user_id, document_id)
);

create index documents_search_idx on public.documents using gin (to_tsvector('simple', coalesce(title,'') || ' ' || coalesce(summary,'')));
create index document_files_document_idx on public.document_files(document_id);
create index dtc_codes_lookup_idx on public.dtc_codes(code, manufacturer_id, variant_id);
create index ingestion_jobs_status_idx on public.ingestion_jobs(status, created_at desc);

alter table public.manufacturers enable row level security;
alter table public.vehicle_models enable row level security;
alter table public.vehicle_variants enable row level security;
alter table public.document_categories enable row level security;
alter table public.documents enable row level security;
alter table public.document_files enable row level security;
alter table public.dtc_codes enable row level security;
alter table public.user_bookmarks enable row level security;

create policy "published documents are readable" on public.documents for select using (status = 'published' and visibility = 'public' and distribution_allowed);
create policy "permitted files are readable" on public.document_files for select using (view_allowed and exists(select 1 from public.documents d join public.document_licenses l on l.id=d.license_id where d.id=document_id and d.status='published' and d.distribution_allowed and l.redistribution_allowed));
create policy "users manage their own bookmarks" on public.user_bookmarks for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Admin/editor write policies belong in a subsequent migration after custom JWT role claims are configured.
