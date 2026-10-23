# TÀI LIỆU THIẾT KẾ CƠ SỞ DỮ LIỆU & HƯỚNG DẪN MIGRATION
## Phân hệ AI Parts Scanner & Smart Pricing — Supabase PostgreSQL
*Find And Fix Automotive SaaS — Phiên bản 1.0.0 — Ngày: 2026-10-23*

---

## 1. TỔNG QUAN THIẾT KẾ & BẢO MẬT

Hệ thống cơ sở dữ liệu được xây dựng để lưu trữ toàn bộ chu trình từ khi kỹ thuật viên chụp ảnh phụ tùng, kết quả nhận diện AI, lịch sử tra cứu trên Taobao/1688, bảng tính giá vốn/markup đến các đơn báo giá chính thức gửi khách hàng.

### 1.1. Các nguyên tắc thiết kế:
- **Khóa chính UUID**: Sử dụng `gen_random_uuid()` chuẩn hóa cho toàn bộ bảng.
- **Phân tách Đa Gara (Multi-Tenancy)**: Mọi bảng nghiệp vụ đều chứa `team_id` (hoặc `user_id`) để đảm bảo gara này không thể đọc được dữ liệu báo giá hoặc giá vốn của gara khác.
- **Row Level Security (RLS)**: Bật RLS trên 100% các bảng. Khách hàng thông thường hoặc client chỉ có thể đọc dữ liệu công khai hoặc thuộc về phiên làm việc của mình.
- **Toàn vẹn dữ liệu (Audit Integrity)**: Khi bản báo giá được tạo, các thông số giá (đơn giá, tỷ giá thời điểm đó) được snapshot cố định vào dòng báo giá, không bị thay đổi ngay cả khi giá trên sàn biến động sau này.
- **Thời hạn bộ nhớ đệm (Cache Expiry)**: Kết quả tìm kiếm sản phẩm được cache với trường `expires_at` (mặc định 24 giờ) để tránh việc hiển thị giá cũ quá hạn.

---

## 2. SƠ ĐỒ THỰC THỂ QUAN HỆ (ERD - ENTITY RELATIONSHIP)

```
   [auth.users / teams]
            │
            ├──────────────────────────────────────────────┐
            ▼                                              ▼
+──────────────────────────+                  +──────────────────────────+
|   part_scan_sessions     |                  |       pricing_rules      |
+──────────────────────────+                  +──────────────────────────+
| id (PK)                  |                  | id (PK)                  |
| user_id / team_id        |                  | default_markup_percent   |
| vehicle_info (JSONB)     |                  | domestic_shipping_rate   |
| image_url / storage_path |                  | rounding_rule            |
+──────────────────────────+                  +──────────────────────────+
            │                                              │
            ▼                                              │
+──────────────────────────+                               │
|      detected_parts      |                               │
+──────────────────────────+                               │
| id (PK)                  |                               │
| session_id (FK)          |                               │
| part_name_vi/en/zh       |                               │
| oem_code / category      |                               │
| bounding_box (JSONB)     |                               │
| confidence_score         |                               │
+──────────────────────────+                               │
            │                                              │
            ▼                                              │
+──────────────────────────+                               │
|   part_search_queries    |                               │
+──────────────────────────+                               │
| id (PK)                  |                               │
| detected_part_id (FK)    |                               │
| provider ('taobao'/'1688')                               │
| search_type ('img'/'txt')│                               │
+──────────────────────────+                               │
            │                                              │
            ▼                                              │
+──────────────────────────+                               │
|  product_search_results  |                               │
+──────────────────────────+                               │
| id (PK)                  |                               │
| query_id (FK)            |                               │
| external_id / detail_url |                               │
| price_cny / price_vnd    |                               │
| moq / tier_prices (JSONB)|                               │
| compatibility_score      |                               │
+──────────────────────────+                               │
            │                                              │
            ▼                                              ▼
+──────────────────────────+                  +──────────────────────────+
|   pricing_calculations   | ───────────────► |      customer_quotes     |
+──────────────────────────+                  +──────────────────────────+
| id (PK)                  |                  | id (PK)                  |
| result_id (FK)           |                  | quote_number             |
| source_price_cny / vnd   |                  | customer_name / phone    |
| landed_cost_vnd          |                  | vehicle_plate            |
| markup_percent (30%)     |                  | total_parts_vnd          |
| garage_price_vnd         |                  | labor_cost_vnd           |
+──────────────────────────+                  | grand_total_vnd          |
            │                                 +──────────────────────────+
            │                                              │
            └──────────────────────┬───────────────────────┘
                                   ▼
                      +──────────────────────────+
                      |       quote_items        |
                      +──────────────────────────+
                      | id (PK)                  |
                      | quote_id (FK)            |
                      | part_name / oem_code     |
                      | quantity / unit_price    |
                      | warranty_terms           |
                      +──────────────────────────+
```

---

## 3. DANH SÁCH 10 BẢNG & MỤC ĐÍCH NGHIỆP VỤ

1. **`part_scan_sessions`**: Lưu phiên quét phụ tùng (thời gian, người chụp, thông tin xe đang kiểm tra, ảnh gốc).
2. **`detected_parts`**: Danh sách các chi tiết linh kiện mà AI phát hiện được trong một phiên quét (tọa độ khung bounding box, tên 3 thứ tiếng, độ tin cậy, mã OCR).
3. **`part_search_queries`**: Nhật ký các truy vấn tìm kiếm gửi tới Taobao, 1688 hoặc bên thứ ba (bằng ảnh crop hoặc từ khóa tiếng Trung).
4. **`product_search_results`**: Kết quả sản phẩm tìm được trên sàn (ảnh, link gốc, giá CNY, giá quy đổi VND, MOQ, bảng giá bậc thang, điểm tương thích).
5. **`external_product_sources`**: Danh mục quản lý sàn dữ liệu (Taobao, 1688, Tmall, Elimapi) cùng trạng thái hoạt động và quota.
6. **`exchange_rates`**: Bảng ghi nhận lịch sử và tỷ giá hiện hành CNY/VND (kèm nguồn dữ liệu như Vietcombank, thời điểm lấy và cờ nhập thủ công).
7. **`pricing_rules`**: Quy tắc tính giá của từng gara (mức markup mặc định 30%, cước cân nặng TQ-VN/kg, phí dịch vụ mua hộ, làm tròn số).
8. **`pricing_calculations`**: Bản ghi chi tiết các bước tính giá của một sản phẩm (giá gốc, phí ship nội địa TQ, phí về VN, phí mua hộ, markup 30%, giá bán gara).
9. **`customer_quotes`**: Tiêu đề các bản báo giá lập cho khách (Tên khách, số điện thoại, biển số xe, tổng tiền phụ tùng, tiền công, tổng thanh toán).
10. **`quote_items`**: Chi tiết từng dòng phụ tùng trong bản báo giá (Tên, mã, số lượng, đơn giá gara, thời gian bảo hành).

---

## 4. HƯỚNG DẪN CHẠY MIGRATION

Migration được đặt tại tệp: `mvp/supabase/migrations/0004_ai_parts_scanner.sql`.

### Các bước thực hiện:
1. Mở giao diện **Supabase Dashboard** của dự án (hoặc sử dụng Supabase CLI: `supabase db push`).
2. Vào mục **SQL Editor**.
3. Mở tệp `0004_ai_parts_scanner.sql`, dán toàn bộ nội dung và nhấn **Run**.
4. Kiểm tra danh sách 10 bảng mới và xác nhận các chính sách RLS đã được kích hoạt thành công.
