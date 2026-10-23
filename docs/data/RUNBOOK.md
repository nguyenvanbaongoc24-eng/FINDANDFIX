# Runbook cập nhật dữ liệu mở

## Điều kiện

- Python 3.11+; pipeline chỉ dùng standard library.
- Kết nối Internet chỉ khi nạp mới.
- Không cần API key.

## Chạy batch nhỏ có kiểm soát

Từ thư mục root:

```powershell
python scripts/data/pipeline.py
# hoặc
.\scripts\data\run.ps1
```

Pipeline thực hiện preflight license MechanicDB, gọi tối đa khoảng 2 request/giây, retry exponential backoff tối đa 3 lần, cache raw response vào `data/raw/` và upsert vào `data/dev/repair_data.sqlite`. Batch chỉ nạp model cho 11 hãng mục tiêu; recalls/complaints chỉ cho ba xe kiểm thử.

## Chạy lặp hoặc offline

```powershell
python scripts/data/pipeline.py --offline
python -m unittest scripts.data.test_pipeline -v
```

Lần chạy offline phải giữ nguyên số lượng bản ghi. Nếu cache chưa có, pipeline dừng thay vì tự ý truy cập nguồn khác.

## Kết quả

- Catalog PWA: `mvp/data/open-data-catalog.json`.
- SQLite dev và raw responses: `data/` (Git ignore).
- Web local: `http://localhost:4173/mvp/open-data/`.
- Vercel: `/mvp/open-data/`.

## Cập nhật Supabase

Chủ sở hữu Supabase chạy `mvp/supabase/migrations/0005_open_repair_data.sql` bằng SQL Editor hoặc migration tool có quyền DDL. Publishable key không đủ quyền. Trước khi nhập bất cứ batch mới nào, tạo `data_sources` record có license, attribution, review status và quyền commercial/redistribution rõ ràng.

## Dữ liệu Việt Nam do gara đóng góp

Điền `templates/parts_vn.csv`, review thủ công, rồi ghi vào `parts` và `parts_contributions` với `contributed_by` và `verified=false`. Không hiển thị public cho đến khi người có thẩm quyền xác minh.
