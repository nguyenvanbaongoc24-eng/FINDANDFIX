# Environment audit

**Thời điểm audit:** 23-10-2026 (Asia/Bangkok)
**Nguyên tắc:** chỉ đọc cấu hình và hệ thống; không cài đặt, cập nhật hay ghi đè công cụ.

## Project hiện tại

| Hạng mục | Kết quả |
| --- | --- |
| Workspace | `D:\AI APP\AUTO DOCUMENT` |
| Ứng dụng hiện có | `mobile-web/`: HTML, CSS và JavaScript thuần, PWA nhẹ |
| Framework | Không có framework, bundler, `package.json` hoặc dependency lockfile |
| Database | Không có database hay Supabase project được cấu hình |
| Server local | `local_server.py`, chạy tại `http://localhost:4173/` |
| Dữ liệu hiện hữu | `data/auto-repair-public-index.json` chỉ là metadata nghiên cứu; chưa được phê duyệt làm nguồn phát hành |
| Mã nguồn Git | Root workspace không phải Git repository; `rea/` là repository độc lập |

## Công cụ

| Hạng mục | Trạng thái | Ghi chú |
| --- | --- | --- |
| Node.js | Có: `v24.14.0` trên PATH | Bản portable `v24.22.1` cũng có tại `.tools/` |
| npm | Có: `11.9.0` | Không dùng để cài mới trong audit |
| Python | Có | Đang dùng cho local server |
| JDK / `java` / `javac` | Không có trên PATH | Không thực hiện cài đặt |
| JADX | Không có trên PATH | Không thực hiện cài đặt |
| Android SDK / `sdkmanager` | Không có trên PATH | Không thực hiện cài đặt |
| ADB | Không có trên PATH | Không thực hiện cài đặt |

## REA MCP

`C:\Users\LENOVO\.codex\config.toml` có mục `mcp_servers.rea` trỏ đến REA `6.7.0` trong `.tools\rea`. Cấu hình hợp lệ về mặt đường dẫn. Tool REA không xuất hiện trong catalog tool của phiên hiện tại, vì vậy cần khởi động lại Codex hoặc mở một phiên mới để xác nhận kết nối runtime. Không sửa cấu hình trong audit này.

## Kết luận kỹ thuật

MVP nên được tạo trong thư mục mới, không thay đổi `mobile-web/`. Kiến trúc mục tiêu là web client tĩnh/PWA kết nối Supabase khi biến môi trường được cấp. Database migration và ingestion worker được cung cấp dưới dạng mã nguồn nhưng không chạy migration, không tạo Supabase project và không truy cập Storage khi chưa có thông tin kết nối do chủ sở hữu cung cấp.
