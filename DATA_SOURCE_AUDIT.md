# Data source audit

## Policy

Một nguồn chỉ đủ điều kiện ingest sau khi có: (1) điều khoản hoặc giấy phép xác định, (2) kiểm tra `robots.txt`, (3) phạm vi URL được phép, (4) xác nhận lưu trữ/tái phân phối, và (5) duyệt của admin. “Public” không đồng nghĩa với được sao chép hoặc tái phân phối.

| Nguồn | Quan sát | Quyết định MVP |
| --- | --- | --- |
| Google Play listings | Mô tả chức năng và metadata app công khai | Chỉ dùng làm nguồn tham khảo; không ingest asset/tài liệu |
| Carmin | Chưa có APK do người dùng cung cấp và chưa xác minh license phân tích | Không reverse engineering, không crawl |
| Auto Repair Documents website | Website hiển thị danh mục công khai; chưa thấy giấy phép tái phân phối trong audit | Không crawl tệp hoặc tái phân phối; cần approval bằng văn bản |
| `data/auto-repair-public-index.json` | Metadata nghiên cứu đã có; không kèm giấy phép dùng lại | Không đưa vào seed/production; chỉ giữ ngoài MVP như artifact audit |
| Tài liệu mẫu dự án | Tự tạo, CC0/Apache-2.0 hoặc có sự cho phép bằng văn bản | Được dùng làm seed MVP |

## Preflight crawler

1. Fetch và lưu snapshot robots/terms cùng thời điểm job.
2. Dừng job nếu robots/terms không truy cập được, cấm agent hoặc không rõ quyền.
3. Chỉ allowlist HTTPS host/path đã duyệt; không đi theo URL sang host khác.
4. Rate limit mặc định 1 request/giây/host, concurrency 1, giới hạn dung lượng/job.
5. Ghi audit log về URL, response status, header, MIME, hash, quyết định và người duyệt.

Không có URL nào được pre-approve cho crawler trong MVP này.
