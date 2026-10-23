# EWD Library — kế hoạch triển khai theo giai đoạn

| Giai đoạn | Phạm vi | Kết quả kiểm chứng | Tiêu chí hoàn tất |
| --- | --- | --- | --- |
| 0. Governance | Lập đánh giá nguồn, taxonomy và kiến trúc; đưa Operation CHARM/AutoZone/Toyota/Hyundai vào registry với trạng thái an toàn | `EWD_SOURCE_ASSESSMENT.md`, source registry | Không có nguồn hạn chế nào bật crawl hoặc storage. |
| 1. Data model | Migration EWD, index metadata và provenance URL; bổ sung seed sample do dự án tạo | SQL migration có thể chạy trên Supabase; kiểm tra constraint/RLS | Link-only không có Storage path; tất cả artifact nội bộ có record license/source. |
| 2. Mobile viewer MVP | Trang `/mvp/ewd/`, lọc xe/hệ thống/loại sơ đồ, zoom, pan, fullscreen, related links và bookmark | Mở local trên mobile viewport, pointer + touch test | Có thể xem SVG mẫu và mở bốn module kỹ thuật mà không ảnh hưởng DTC/search hiện tại. |
| 3. Admin index | Danh sách source, kiểm tra quyền, tạo metadata link-only, duyệt artifact và liên kết diagram | UI thể hiện status/provenance rõ ràng | Không có nút crawl/download với `RESTRICTED`, `REJECTED` hoặc `REVIEW_REQUIRED`. |
| 4. Approved ingestion | Upload tài liệu có quyền, MIME/hash/duplicate, PDF text extraction và OCR tùy chọn | Test file hợp pháp và audit log | Chỉ `APPROVED` được upload và publish; private Storage/RLS hoạt động. |
| 5. Partner integration | API/catalog OEM hoặc partner có thỏa thuận; source-specific adapter và monitoring | Contract test trên sandbox/allowlist | Tài liệu chỉ được xử lý trong phạm vi hợp đồng. |

## Thứ tự triển khai hiện tại

Trong lượt này triển khai Giai đoạn 0–2 ở dạng MVP và chuẩn bị migration Giai đoạn 1. Module dùng artifact minh họa tự tạo; không tự nhận là catalog Toyota, Hyundai, AutoZone hoặc Operation CHARM. Giai đoạn 3–5 yêu cầu quyền quản trị Supabase và/hoặc hợp đồng cấp phép tương ứng trước khi bật các thao tác có tác động dữ liệu.
