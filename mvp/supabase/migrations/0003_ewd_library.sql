create table public.ewd_systems (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references public.ewd_systems(id) on delete set null,
  code text not null unique,
  name text not null,
  description text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.ewd_artifacts (
  id uuid primary key default gen_random_uuid(),
  document_id uuid references public.documents(id) on delete cascade,
  document_file_id uuid references public.document_files(id) on delete set null,
  source_id uuid not null references public.source_registry(id),
  electrical_system_id uuid references public.ewd_systems(id) on delete set null,
  manufacturer_id uuid references public.manufacturers(id) on delete set null,
  vehicle_model_id uuid references public.vehicle_models(id) on delete set null,
  vehicle_variant_id uuid references public.vehicle_variants(id) on delete set null,
  title text not null,
  artifact_type text not null check (artifact_type in ('wiring_schematic','system_diagram','power_distribution','fuse_relay','ecu_pinout','connector_view','ground_location','splice_junction','component_location','wire_color_code','dtc_flow')),
  format text not null check (format in ('pdf','svg','image','html','external_link')),
  display_mode text not null default 'internal' check (display_mode in ('internal','link_only')),
  original_url text,
  page_or_locator text,
  year_start integer,
  year_end integer,
  engine_label text,
  review_status text not null default 'pending' check (review_status in ('pending','approved','rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((display_mode = 'link_only' and document_file_id is null and original_url is not null) or display_mode = 'internal')
);

create table public.ewd_relations (
  id uuid primary key default gen_random_uuid(),
  from_artifact_id uuid not null references public.ewd_artifacts(id) on delete cascade,
  to_artifact_id uuid not null references public.ewd_artifacts(id) on delete cascade,
  relation_type text not null check (relation_type in ('continues_to','references_connector','references_ground','references_ecu','uses_wire_color','related_system')),
  unique(from_artifact_id, to_artifact_id, relation_type),
  check (from_artifact_id <> to_artifact_id)
);

create table public.ecu_pinouts (
  id uuid primary key default gen_random_uuid(),
  artifact_id uuid not null references public.ewd_artifacts(id) on delete cascade,
  ecu_name text not null,
  connector_name text not null,
  terminal text not null,
  signal_name text,
  wire_color_code text,
  direction text check (direction in ('input','output','bidirectional','power','ground','unknown')) default 'unknown',
  review_status text not null default 'pending' check (review_status in ('pending','approved','rejected')),
  unique(artifact_id, connector_name, terminal)
);

create table public.connector_views (
  id uuid primary key default gen_random_uuid(),
  artifact_id uuid not null references public.ewd_artifacts(id) on delete cascade,
  connector_code text not null,
  location_label text,
  terminal_count integer,
  description text,
  review_status text not null default 'pending' check (review_status in ('pending','approved','rejected')),
  unique(artifact_id, connector_code)
);

create table public.ground_locations (
  id uuid primary key default gen_random_uuid(),
  artifact_id uuid not null references public.ewd_artifacts(id) on delete cascade,
  ground_code text not null,
  location_label text,
  description text,
  review_status text not null default 'pending' check (review_status in ('pending','approved','rejected')),
  unique(artifact_id, ground_code)
);

create table public.wire_color_codes (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.source_registry(id),
  manufacturer_id uuid references public.manufacturers(id) on delete set null,
  code text not null,
  primary_color text not null,
  tracer_color text,
  display_label text not null,
  review_status text not null default 'pending' check (review_status in ('pending','approved','rejected')),
  unique(source_id, manufacturer_id, code)
);

create index ewd_artifacts_scope_idx on public.ewd_artifacts(manufacturer_id, vehicle_model_id, year_start, year_end);
create index ewd_artifacts_system_idx on public.ewd_artifacts(electrical_system_id, artifact_type, review_status);
create index ewd_relations_from_idx on public.ewd_relations(from_artifact_id);

alter table public.ewd_systems enable row level security;
alter table public.ewd_artifacts enable row level security;
alter table public.ewd_relations enable row level security;
alter table public.ecu_pinouts enable row level security;
alter table public.connector_views enable row level security;
alter table public.ground_locations enable row level security;
alter table public.wire_color_codes enable row level security;

create policy "approved ewd systems public read" on public.ewd_systems for select using (true);
create policy "approved ewd artifacts public read" on public.ewd_artifacts for select using (review_status = 'approved');
create policy "related approved ewd public read" on public.ewd_relations for select using (
  exists (select 1 from public.ewd_artifacts a where a.id = from_artifact_id and a.review_status = 'approved') and
  exists (select 1 from public.ewd_artifacts a where a.id = to_artifact_id and a.review_status = 'approved')
);
create policy "approved pinouts public read" on public.ecu_pinouts for select using (review_status = 'approved');
create policy "approved connectors public read" on public.connector_views for select using (review_status = 'approved');
create policy "approved grounds public read" on public.ground_locations for select using (review_status = 'approved');
create policy "approved wire colors public read" on public.wire_color_codes for select using (review_status = 'approved');

-- No anonymous write policy is created. An administrator role must validate the source license before publishing an artifact.
