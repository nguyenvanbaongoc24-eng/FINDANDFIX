# Ingestion architecture

## Hai tuyến ingest

### A. Admin upload

1. Admin chọn source đã duyệt và license đã duyệt.
2. API kiểm tra role, extension, magic bytes/MIME và kích thước.
3. Worker tính SHA-256; nếu trùng, trả metadata hiện có thay vì tạo tệp mới.
4. Lưu file vào private Storage, tạo document/document_file ở trạng thái `processing`.
5. PDF text extraction chạy trong worker; OCR chỉ chạy khi admin bật và tài liệu có quyền xử lý.
6. Admin kiểm tra metadata xe, category, quyền phân phối rồi publish.

### B. Crawler được phê duyệt

1. `data_source` phải có rights_status `approved`, terms/robots snapshot và allowlist path.
2. Job chỉ tải tài nguyên không cần xác thực; không thử login, không né 403/429, không can thiệp DRM/pinning.
3. HEAD/GET giới hạn redirect, MIME và byte budget; streaming hash trước khi lưu.
4. Retry exponential chỉ cho lỗi mạng/5xx; 401/403/429 và MIME sai là terminal review state.
5. Cursor/resume, idempotency key và log từng candidate URL.

## Trạng thái job

`queued → preflight → fetching → hashing → extracting → awaiting_review → published | rejected | failed | paused`

## Controls

- Virus scan hook trước publish.
- SVG sanitize hoặc raster preview trong sandbox trước render.
- PDF parser/ocr chạy worker cô lập; không mở tệp do người dùng tải bằng browser privileged context.
- Không upload tệp chưa có `storage_allowed=true`; không phát hành tệp chưa có `redistribution_allowed=true`.
