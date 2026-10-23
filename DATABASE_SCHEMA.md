# Database schema

Supabase PostgreSQL là system of record. UUID dùng cho khóa chính; `created_at` và `updated_at` mặc định UTC.

## Quan hệ

```text
manufacturers → vehicle_models → vehicle_variants
document_categories → documents → document_files
data_sources ────────┬───────────→ documents
document_licenses ──┘
dtc_codes ─────────────→ manufacturers / vehicle_variants (tùy chọn)
ingestion_jobs ───────→ data_sources
user_bookmarks ───────→ documents + auth.users
```

## Bảng

| Bảng | Trường nghiệp vụ cốt lõi |
| --- | --- |
| `manufacturers` | name, slug, country, active |
| `vehicle_models` | manufacturer_id, name, slug, production_start_year, production_end_year |
| `vehicle_variants` | vehicle_model_id, name, engine_code, engine_name, fuel_type, transmission, year_from, year_to |
| `document_categories` | parent_id, name_vi, slug, sort_order |
| `data_sources` | name, base_url, source_type, terms_url, robots_url, rights_status, approved_at, approved_by |
| `document_licenses` | name, license_url, storage_allowed, redistribution_allowed, attribution_text, reviewed_at, reviewed_by |
| `documents` | title, summary, category_id, source_id, license_id, manufacturer_id, model_id, variant_id, year_from, year_to, visibility, distribution_allowed, status |
| `document_files` | document_id, storage_bucket, storage_path, mime_type, byte_size, sha256, page_count, extracted_text, ocr_status, view_allowed |
| `dtc_codes` | code, standard, manufacturer_id?, variant_id?, system, title_vi, description_vi, diagnostics_hint, source_id, license_id |
| `ingestion_jobs` | source_id, type, status, requested_by, cursor, attempts, bytes_downloaded, error, started_at, finished_at |
| `user_bookmarks` | user_id, document_id, created_at; unique `(user_id, document_id)` |

## Integrity and access

- `documents.distribution_allowed` phải đồng thời phù hợp với license và source đã duyệt; app chỉ tạo signed URL khi cả document và file đều được phép.
- SHA-256 unique ở `document_files` cho cùng storage bucket/path logic, và index `sha256` để phát hiện duplicate.
- Bật RLS: khách chỉ đọc document/file `published` và được phép; bookmarks chỉ owner; admin workflow qua role/claim server-side.
- Storage bucket `repair-documents` là private. Chỉ Edge Function/worker cấp signed URL ngắn hạn sau kiểm tra quyền.

## Migration delivery

DDL thực thi sẽ nằm tại `mvp/supabase/migrations/0001_initial_schema.sql`. Migration không chạy tự động và không chứa URL/key Supabase.
