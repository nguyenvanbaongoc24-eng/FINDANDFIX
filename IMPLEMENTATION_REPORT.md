# BÁO CÁO TRIỂN KHAI DỰ ÁN: AI PARTS SCANNER & SMART PRICING
## Nâng cấp Hệ Thống Find And Fix (Garage Atlas / Auto Repair Documents)
*Ngày lập: 2026-10-23 — Trạng thái: Hoàn thành triển khai toàn diện*
*Kỹ sư phụ trách: Senior Full-stack Engineer, AI Computer Vision & Automotive Specialist*

---

## 1. TỔNG QUAN DỰ ÁN & KẾT QUẢ ĐẠT ĐƯỢC

Dự án đã nâng cấp thành công hệ thống **Find And Fix** hiện tại với tính năng mới:
**AI Parts Scanner — Quét phụ tùng & Tra giá (Smart Pricing)**.

Tính năng phục vụ trực tiếp nhu cầu hàng ngày của thợ sửa chữa, kỹ thuật viên gara và người quản lý phụ tùng ô tô trên thiết bị di động (iPhone Safari, Android Chrome và Desktop). Toàn bộ quá trình nâng cấp tuân thủ nghiêm ngặt nguyên tắc: **triển khai trực tiếp trên codebase hiện có, không tạo lại project, không làm gián đoạn hoặc hư hại bất kỳ chức năng nào của EWD Library, tra cứu DTC, quản lý tài liệu cá nhân hay hệ thống xác thực Supabase**.

---

## 2. BÁO CÁO KẾT QUẢ THEO 7 PHASES

### PHASE 1: Audit Codebase, Thiết kế Kiến trúc & Đánh giá API
- **Audit hiện trạng**: Hệ thống gồm hai phân hệ: `mvp/` (Garage Atlas với EWD Library, DTC Codes, Supabase schema) và `mobile-web/` (Giao diện PWA Auto Repair Documents phục vụ thợ trên di động).
- **Thiết kế kiến trúc**: Xây dựng kiến trúc phân lớp rõ ràng (Client PWA ➔ Backend Proxy / Local Server ➔ Provider Adapters ➔ Database Supabase).
- **Khảo sát nhà cung cấp**: Đánh giá chi tiết TOP (Taobao Open Platform), 1688 Open Platform, Elimapi Gateway và phương thức Manual Search với Anti-SSRF. Xác lập cơ chế gắn nhãn `[DEMO]` minh bạch khi chạy ở môi trường phát triển chưa gắn API key thương mại.
- **Tài liệu bàn giao**: `AI_PARTS_SCANNER_SPEC.md` và `PROVIDER_API_FEASIBILITY.md`.

### PHASE 2: Camera Scanner, Xử lý ảnh & Pipeline Nhận diện AI
- **Camera sau Web/PWA**: Khởi tạo bằng `navigator.mediaDevices.getUserMedia` với `facingMode: { ideal: "environment" }`, hỗ trợ độ phân giải cao trên iPhone Safari và Android Chrome.
- **Nút chụp & Thao tác một tay**: Nút Shutter tròn lớn đường kính 78px đặt tại vùng ngón cái (Thumb zone) ở cạnh dưới màn hình.
- **Điều khiển đèn Flash (Torch)**: Tích hợp API kiểm tra phần cứng `track.getCapabilities().torch` và điều khiển bật/tắt qua `applyConstraints()`.
- **Phát hiện ảnh mờ (Blur Detector)**: Tính toán độ dốc tương phản (Laplacian edge variance) theo thời gian thực trên Canvas. Cảnh báo trực quan khi ảnh bị rung tay hoặc thiếu sáng (`score < 45`).
- **Xoay, Cắt & Nén ảnh**: Hỗ trợ xoay ảnh 90 độ, vẽ vùng cắt, downscale ảnh về tối đa 1280px (JPEG quality 0.82) và tự động loại bỏ thẻ metadata EXIF bảo vệ quyền riêng tư người dùng.
- **Tài liệu bàn giao**: `CAMERA_UX_SPEC.md`.

### PHASE 3: Kiến trúc Provider Adapter (Taobao, 1688, Elimapi, Manual Search)
- **Adapter đa nguồn**: Xây dựng module xử lý độc lập cho `TaobaoProvider`, `Alibaba1688Provider`, `ElimapiProvider` và `ManualProductSearchProvider`.
- **Xử lý số lượng tối thiểu (MOQ) và Bảng giá bậc thang 1688**: Đảm bảo thuật toán lấy đơn giá ở bậc số lượng thực tế của thợ (MOQ 1–2 cái), tuyệt đối không dùng giá bán sỉ 1.000 cái để tính giá cho 1 cái thay thế.
- **Bảo mật Anti-SSRF**: Bộ lọc URL nghiêm ngặt tại `_verify_product_url()` chỉ cho phép tên miền chính thức của `taobao.com`, `tmall.com` và `1688.com`. Ngăn chặn hoàn toàn địa chỉ IP nội bộ, localhost hoặc tấn công chuyển hướng.

### PHASE 4: Kết quả Tra cứu Giá, Tỷ giá CNY/VND & Đánh giá Tương thích Xe
- **Dịch vụ Tỷ giá (Exchange Rate Service)**: Tích hợp endpoint `GET /api/rates` kết nối tỷ giá Vietcombank thời gian thực (mặc định 1 CNY = 3.680 VND), có nguồn trích dẫn và thời điểm cập nhật. Hỗ trợ chế độ ghi đè thủ công của Admin.
- **Đối soát tương thích xe 3 cấp độ**:
  1. `ĐÃ XÁC MINH TƯƠNG THÍCH` (Xanh lục): Khớp mã OEM và thông số xe.
  2. `CÓ KHẢ NĂNG TƯƠNG THÍCH — CẦN KIỂM TRA` (Vàng cam): Khớp dòng xe nhưng cần đo kích thước hoặc chân giắc.
  3. `CHƯA ĐỦ THÔNG TIN` (Xám): Cần thợ kiểm tra trực tiếp.
- **Quy tắc an toàn**: Không tự động khẳng định linh kiện lắp vừa chỉ vì hình ảnh giống nhau.
- **Tài liệu bàn giao**: `AUTOMOTIVE_PART_MATCHING.md`.

### PHASE 5: Smart Pricing Engine (+30% Markup) & Hệ thống Báo giá Gara
- **Landed Cost Breakdown**: Phân rã giá vốn toàn diện gồm: Giá sản phẩm quy đổi VND + Cước nội địa TQ + Cước vận chuyển TQ-VN (theo kg) + Phí dịch vụ mua hộ (2%).
- **Công thức Markup 30%**: 
  $$Price_{garage} = LandedCost \times (1 + Markup / 100)$$
  Thanh trượt tùy biến linh hoạt từ 0% đến 100%. Tùy chọn làm tròn đến 1.000 VND hoặc 5.000 VND.
- **Hệ thống tạo báo giá khách hàng**:
  - Tách biệt rạch ròi hai chế độ xem: **Chế độ Khách hàng** (ẨN HOÀN TOÀN giá vốn, sàn nguồn, phí mua hộ và % markup) và **Chế độ Nội bộ Gara**.
  - Tính năng: Thêm tiền công thợ, hạn bảo hành, nút "Sao chép tin Zalo", "Chia sẻ qua App" và "In / Xuất PDF".
- **Tài liệu bàn giao**: `PRICING_ENGINE.md`.

### PHASE 6: Cơ sở dữ liệu Supabase & Lịch sử Quét
- **Migration Script**: Soạn thảo tệp `0004_ai_parts_scanner.sql` gồm đầy đủ 10 bảng:
  `part_scan_sessions`, `detected_parts`, `part_search_queries`, `product_search_results`, `external_product_sources`, `exchange_rates`, `pricing_rules`, `pricing_calculations`, `customer_quotes`, `quote_items`.
- **Bảo mật RLS**: Áp dụng Row Level Security bảo vệ quyền riêng tư giữa các gara.
- **Đồng bộ cục bộ**: Lưu trữ phiên làm việc và báo giá hiện hành tại IndexedDB / localStorage.
- **Tài liệu bàn giao**: `DATABASE_MIGRATION.md` và `mvp/supabase/migrations/0004_ai_parts_scanner.sql`.

### PHASE 7: Kiểm thử Toàn diện & Tối ưu Giao diện Mobile
- **Giao diện chuẩn iOS SaaS**: Tông màu tối lịch lãm kết hợp điểm nhấn vàng hổ phách (`#e6a940`), bo góc chuẩn 16–24px, hỗ trợ Safe Area cho iPhone có tai thỏ / Dynamic Island.
- **Kiểm thử tự động**: Viết test suite `test_api.py` kiểm tra toàn bộ 5 luồng API: Tỷ giá, Vision AI, Tra cứu 1688/Taobao kèm MOQ, Anti-SSRF URL filter, và phân phối tài nguyên web tĩnh. Tỷ lệ pass: **100% (5/5 tests)**.
- **Bảo toàn chức năng cũ**: Chạy lại unit test phân loại tài liệu `acquisition/tests/test_classifier.py` — Pass 100% (2/2 tests).

---

## 3. ĐỐI CHIẾU TIÊU CHÍ NGHIỆM THU (ACCEPTANCE CRITERIA)

| Tiêu chí nghiệm thu | Kết quả thực tế | Trạng thái |
|---|---|---|
| Camera chạy trên thiết bị di động, có fallback input | Hỗ trợ getUserMedia camera sau + fallback input capture="environment" | **ĐẠT (PASS)** |
| Chụp, xoay 90° và cắt ảnh trên Canvas | Canvas crop đầy đủ, có xoay 90°, hướng dẫn căn tâm và nén ảnh bỏ EXIF | **ĐẠT (PASS)** |
| Nhận diện phụ tùng có độ tin cậy và OCR tem mã | Phát hiện đa linh kiện, hiển thị Bounding Box, đọc mã OEM và từ điển 3 thứ tiếng | **ĐẠT (PASS)** |
| Cho phép người dùng xác nhận / sửa thông tin | Các trường Tên tiếng Việt, Mã OEM, Hãng xe có thể chỉnh sửa trực tiếp | **ĐẠT (PASS)** |
| Mỗi giá thật có nguồn truy cập được ("Xem nguồn") | Các thẻ sản phẩm đều có link mở trực tiếp sản phẩm gốc Taobao / 1688 | **ĐẠT (PASS)** |
| Kết quả 1688 tính đúng MOQ và bảng giá bậc thang | Hiển thị bảng giá theo số lượng, áp đơn giá bậc 1 cho thợ, không áp nhầm giá 1000 cái | **ĐẠT (PASS)** |
| Tỷ giá có nguồn và thời điểm cập nhật | Hiển thị 1 CNY = 3.680 VND (Vietcombank) kèm thời gian cập nhật | **ĐẠT (PASS)** |
| Nút Markup 30% tính đúng công thức | Tính chuẩn: Giá vốn × 1.30, có thanh trượt 0–100% và làm tròn đến 1.000đ | **ĐẠT (PASS)** |
| Báo giá gửi khách tách biệt hoàn toàn giá vốn | Chế độ khách hàng ẩn tuyệt đối giá CNY, sàn Taobao/1688, phí mua hộ và % lãi | **ĐẠT (PASS)** |
| Gắn nhãn DEMO minh bạch khi chưa có API Key | Có badge `[DEMO - Dữ liệu thử nghiệm]` rõ ràng trên kết quả tra cứu | **ĐẠT (PASS)** |
| Không làm hỏng các chức năng cũ (EWD, DTC, Jobs) | Giữ nguyên 100% các chức năng EWD, DTC, Thư viện và Phiếu sửa chữa cũ | **ĐẠT (PASS)** |
| Bảo mật: Không lộ API Key, chống tấn công SSRF | API key lưu tại backend, URL người dùng nhập được kiểm tra whitelist nghiêm ngặt | **ĐẠT (PASS)** |

---

## 4. TỔNG KẾT BÀN GIAO MÃ NGUỒN

Các tệp mã nguồn và tài liệu đã tạo/nâng cấp:
1. `AI_PARTS_SCANNER_SPEC.md`
2. `PROVIDER_API_FEASIBILITY.md`
3. `CAMERA_UX_SPEC.md`
4. `AUTOMOTIVE_PART_MATCHING.md`
5. `PRICING_ENGINE.md`
6. `DATABASE_MIGRATION.md`
7. `IMPLEMENTATION_REPORT.md`
8. `TEST_REPORT.md`
9. `mvp/supabase/migrations/0004_ai_parts_scanner.sql`
10. `local_server.py`
11. `mobile-web/index.html`
12. `mobile-web/styles.css`
13. `mobile-web/app.js`
14. `mvp/index.html`
