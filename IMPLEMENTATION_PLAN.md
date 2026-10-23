# Implementation plan

## Milestone 0 — hoàn thành

- Audit môi trường và hồ sơ nguồn dữ liệu.
- Tài liệu requirements, reference, schema, ingestion và UI.
- Không thay đổi code hoặc cấu hình quan trọng của app hiện hữu.

## Milestone 1 — MVP local

1. Tạo thư mục `mvp/` độc lập với `mobile-web/`.
2. Tạo PWA mobile-first với dữ liệu sample được cấp phép trong repository.
3. Cài đặt chọn xe, DTC, thư viện document, bookmark local, theme và viewer SVG/PDF sample.
4. Thêm admin dashboard mock data, không có quyền upload thật.
5. Kiểm tra với Chrome/iPhone viewport, keyboard navigation và offline shell.

## Milestone 2 — Supabase integration

1. Owner tạo Supabase project và cung cấp URL/anon key qua `.env.local` không commit.
2. Admin chạy migration theo `DATABASE_SCHEMA.md`; xác minh RLS và private bucket.
3. Chuyển sample repository data sang seed/migration; web client dùng public read policies tối thiểu.
4. Dùng Edge Function để cấp signed file URL và kiểm tra distribution right.

## Milestone 3 — ingestion

1. Triển khai admin uploader cùng checksum/extraction audit.
2. Bật crawler cho từng source chỉ sau approval record và legal review.
3. Theo dõi job, storage cost, failures và revoke workflow.

## Definition of done for MVP

- Mở được PWA local; chọn xe và tìm DTC/tài liệu sample.
- Viewer mở 1 PDF sample và 1 SVG sample do dự án tạo.
- Bookmark/historical state rõ ràng; dark mode và safe-area hoạt động.
- Không dùng tài liệu/reference asset của Carmin hay Auto Repair Documents.
- Migration, schema và ingestion guardrails được giao nhưng không tự chạy lên Supabase.
