# Khảo sát project dữ liệu sửa chữa

Ngày khảo sát: 23-10-2026.

| Hạng mục | Kết quả |
| --- | --- |
| Ứng dụng | PWA tĩnh mobile-first tại `mvp/`; trang gốc Vercel chuyển đến `/mvp/`. |
| Frontend | HTML, CSS và JavaScript thuần; không có `package.json` hay framework runtime để thay thế. |
| Backend local | `local_server.py`, dùng Python standard library `ThreadingHTTPServer`. |
| Database production | Supabase PostgreSQL; migration tại `mvp/supabase/migrations/`. Publishable key chỉ có vai trò client, không thực thi DDL. |
| Database development | Chưa có. Pipeline mới dùng SQLite cục bộ tại `data/dev/repair_data.sqlite`; thư mục `data/` đã bị Git ignore. |
| Deploy | Vercel static, cấu hình ở `vercel.json`. |
| Thành phần phải giữ | EWD Library, catalog tài liệu, DTC sample, bookmark và registry quyền nguồn. |

## Quyết định tích hợp

1. Không thay framework hay database production.
2. Pipeline dữ liệu dùng Python standard library để không bổ sung dependency máy.
3. Dữ liệu thô/cache nằm trong `data/raw/`, SQLite cục bộ trong `data/dev/`, đều không commit.
4. Một catalog nhỏ đã xử lý, có provenance, được tạo ở `mvp/data/open-data-catalog.json` để PWA chạy ngay; nội dung chỉ gồm NHTSA vPIC/recall/complaint theo truy vấn giới hạn và MechanicDB public sample có ODbL.
5. Các nguồn không có quyền rõ ràng không được download, nhập vào public catalog hay đưa vào Storage.
