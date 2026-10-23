create table public.source_registry (
  id uuid primary key default gen_random_uuid(),
  source_key text not null unique,
  name text not null,
  base_url text,
  status text not null check(status in ('APPROVED','REVIEW_REQUIRED','RESTRICTED','REJECTED')),
  source_type text not null,
  terms_url text,
  robots_url text,
  terms_checked_at timestamptz,
  robots_checked_at timestamptz,
  allowed_domains text[] not null default '{}',
  allowed_path_prefixes text[] not null default '{}',
  storage_allowed boolean not null default false,
  redistribution_allowed boolean not null default false,
  crawl_enabled boolean not null default false,
  notes text,
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status = 'APPROVED' and storage_allowed and redistribution_allowed and crawl_enabled) or status <> 'APPROVED' or not crawl_enabled)
);

alter table public.source_registry enable row level security;
create policy "source registry public read" on public.source_registry for select using (true);

alter table public.document_files add column if not exists acquired_at timestamptz;
alter table public.document_files add column if not exists source_url text;
alter table public.document_files add column if not exists review_status text not null default 'pending' check(review_status in ('pending','approved','rejected'));

insert into storage.buckets (id, name, public) values ('repair-documents', 'repair-documents', false) on conflict (id) do nothing;

create policy "public may read only approved publishable documents" on storage.objects for select using (
  bucket_id = 'repair-documents' and exists (
    select 1 from public.document_files f join public.documents d on d.id=f.document_id
    where f.storage_path = name and f.review_status='approved' and f.view_allowed and d.status='published' and d.distribution_allowed
  )
);

-- Admin write access must be added with an authenticated custom role; no anonymous upload policy is created.
