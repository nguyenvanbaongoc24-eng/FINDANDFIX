# QUY CHUẨN NHẬN DIỆN PHỤ TÙNG Ô TÔ & ĐỐI SOÁT TƯƠNG THÍCH XE
## Automotive Part Recognition, OCR & Vehicle Compatibility Engine
*Find And Fix Automotive Intelligence — Phiên bản 1.0.0 — Ngày: 2026-10-23*

---

## 1. NGUYÊN TẮC CỐT LÕI

> [!CAUTION]
> **Quy tắc an toàn kỹ thuật**: Không bao giờ được tự động đánh dấu một linh kiện là lắp vừa xe chỉ dựa trên hình dáng bên ngoài tương tự!
> Phụ tùng ô tô cùng hình dạng có thể khác biệt hoàn toàn về: kích thước lắp đặt, bước ren, điện áp kích hoạt, sơ đồ chân giắc (pinout), hướng quay mô-tơ hoặc chiều lắp đặt (Trái/Phải).

Mọi kết quả tra cứu của hệ thống phải được phân loại thành 3 cấp độ minh bạch:
1. **ĐÃ XÁC MINH TƯƠNG THÍCH (Verified Compatible)**: Khớp hoàn toàn mã OEM/Part Number chính thức hoặc thông số kỹ thuật kích thước đã được đối chiếu đầy đủ với xe đang tra cứu.
2. **CÓ KHẢ NĂNG TƯƠNG THÍCH — CẦN KIỂM TRA (Probable Match — Verify Spec)**: Đúng đời xe và dòng xe chung nhưng cần kỹ thuật viên xác nhận lại chiều dài, giắc cắm hoặc mã phụ.
3. **CHƯA ĐỦ THÔNG TIN (Insufficient Data)**: Chỉ tìm thấy sản phẩm có hình dáng tương tự; chưa có cơ sở khẳng định lắp vừa xe.

---

## 2. TỪ ĐIỂN DANH PHÁP ĐA NGỮ (VIỆT - ANH - TRUNG GIẢN THỂ)

Hệ thống tích hợp bảng quy chuẩn thuật ngữ chuyên ngành để chuyển đổi chính xác từ tên tiếng Việt sang tiếng Trung giản thể (dùng tra cứu chính xác trên Taobao và 1688):

| Danh mục phụ tùng | Tên Tiếng Việt | English Name (SAE/ISO) | Tiếng Trung Giản Thể (Taobao/1688 Search Term) | Thông số kỹ thuật bắt buộc xác minh |
|---|---|---|---|---|
| **Hệ thống Gạt nước** | Lưỡi gạt mưa | Windshield Wiper Blade | 雨刷片 / 雨刮条 / 汽车无骨雨刮 | Chiều dài (inch/mm), Kiểu đầu móc (U-Hook, Push Button, Pinch Tab, Side Pin). |
| **Hệ thống Gạt nước** | Tay gạt mưa | Wiper Arm | 雨刮臂 / 雨刷连杆臂 | Lỗ then hoa trục (spline diameter), Chiều dài, Bên Trái (L) / Phải (R). |
| **Hệ thống Gạt nước** | Mô-tơ gạt mưa | Wiper Motor | 雨刮电机 / 雨刷马达 | Điện áp 12V/24V, Số chân giắc (4-pin/5-pin), Hướng quay, Mã OEM. |
| **Hệ thống Đánh lửa** | Cuộn đánh lửa (Mobin) | Ignition Coil | 点火线圈 / 高压包 | Số chân giắc (3-pin/4-pin), Chiều dài ống chụp bugi, Mã OEM. |
| **Hệ thống Đánh lửa** | Bugi đánh lửa | Spark Plug | 火花塞 (铱金 / 铂金) | Bước ren, Chiều dài ren (reach), Trị số nhiệt (heat range), Khe hở điện cực. |
| **Hệ thống Phanh** | Má phanh trước | Front Brake Pads | 前刹车片 / 前制动片 | Kích thước bản đế, Có/Không rãnh cảm biến mòn, Mã WVA/FMSI. |
| **Hệ thống Phanh** | Má phanh sau | Rear Brake Pads | 后刹车片 / 后制动片 | Dạng cơ hay phanh tay điện tử (EPB), Kích thước bản đế. |
| **Hệ thống Lọc** | Lọc gió động cơ | Engine Air Filter | 空气滤清器 / 空滤芯 | Kích thước (Dài × Rộng × Cao), Hình chữ nhật hay hình trụ. |
| **Hệ thống Lọc** | Lọc dầu nhớt | Oil Filter | 机油滤清器 / 机滤 | Bước ren đế (M20x1.5, 3/4-16), Đường kính gioăng cao su, Van một chiều. |
| **Hệ thống Cảm biến** | Cảm biến Oxy | Oxygen (O2) Sensor | 氧传感器 (前氧 / 后氧) | Vị trí Trước (Upstream) hay Sau (Downstream), Số dây (4-wire/5-wire), Kiểu giắc. |
| **Hệ thống Điện** | Máy phát điện | Alternator | 汽车发电机 | Dòng sạc định mức (Ampere), Rãnh puly (curoa 6PK/7PK), Chân điều khiển ECU. |
| **Hệ thống Điện** | Củ đề (Máy khởi động) | Starter Motor | 汽车起动机 / 马达 | Số răng nhông đề (pinion teeth), Công suất (kW), Kiểu mặt bích lắp. |

---

## 3. PIPELINE PHÂN TÍCH HÌNH ẢNH & OCR

```
+-----------------------------------------------------------------------------------+
|                        PIPELINE COMPUTER VISION & OCR                             |
|                                                                                   |
|  [Ảnh phụ tùng đã chụp / crop]                                                    |
|                │                                                                  |
|                ▼                                                                  |
|  [1. Object Detection & Localization]                                             |
|      - Phát hiện đường biên các vật thể linh kiện trong ảnh.                      |
|      - Trích xuất toạ độ Bounding Box [ymin, xmin, ymax, xmax].                   |
|      - Cho phép người dùng chạm để chọn linh kiện độc lập.                        |
|                │                                                                  |
|                ▼                                                                  |
|  [2. OCR Text & Part Number Extractor]                                            |
|      - Quét toàn bộ bề mặt tem nhãn, chữ dập kim loại, barcode hoặc QR code.      |
|      - Áp dụng biểu thức chính quy (Regex Pattern) nhận dạng mã OEM:               |
|        • Toyota: `^\d{5}-[A-Z0-9]{5}$` (Ví dụ: `85212-0D080`, `90919-02240`)      |
|        • Hyundai/Kia: `^\d{5}-[A-Z0-9]{5}$` (Ví dụ: `27301-2B010`, `58101-1RA00`)|
|        • Ford: `^[A-Z0-9]{4}-[A-Z0-9]{4,6}-[A-Z0-9]{1,3}$`                       |
|        • Bosch: `^0\s?\d{3}\s?\d{3}\s?\d{3}$` (Ví dụ: `0 221 504 470`)            |
|        • Denso: `^\d{4,6}-\d{4}$`                                                 |
|                │                                                                  |
|                ▼                                                                  |
|  [3. Multi-Lingual Term Mapping & Query Builder]                                  |
|      - Ánh xạ linh kiện sang tiếng Trung giản thể.                                |
|      - Kết hợp: [Tên Trung Giản Thể] + [Mã OEM nếu có] + [Hãng / Đời xe].         |
|      - Ưu tiên cao nhất: Tìm kiếm chính xác theo mã OEM.                          |
|                │                                                                  |
|                ▼                                                                  |
|  [4. Product Matching & Compatibility Scoring Engine]                             |
+-----------------------------------------------------------------------------------+
```

---

## 4. THUẬT TOÁN ĐÁNH GIÁ ĐỘ TƯƠNG THÍCH (COMPATIBILITY SCORING)

Mỗi sản phẩm tìm được trên Taobao hoặc 1688 được chấm điểm tương thích trên thang 100 điểm:

| Tiêu chí | Trọng số | Điều kiện đạt điểm tối đa |
|---|---|---|
| **Trùng khớp Part Number / OEM Code** | **40 điểm** | Mã OEM trong tiêu đề hoặc mô tả sản phẩm khớp chính xác với mã phụ tùng cần tìm. |
| **Trùng khớp Dòng xe & Đời xe** | **20 điểm** | Sản phẩm ghi rõ tương thích với Hãng xe, Model và Năm sản xuất của xe đang chọn. |
| **Trùng khớp Thông số kỹ thuật** | **20 điểm** | Chiều dài, điện áp, số chân giắc, kiểu đầu nối trùng khớp với thông số yêu cầu. |
| **Trùng khớp Vị trí lắp đặt** | **10 điểm** | Xác nhận đúng vị trí: Bên Lái (LH) / Bên Phụ (RH), Phía Trước / Phía Sau. |
| **Độ tương đồng hình ảnh** | **10 điểm** | Ảnh sản phẩm trên sàn có cấu tạo vật lý tương đồng với ảnh chụp thực tế. |

### Phân loại kết quả cuối cùng:
- **≥ 80 điểm**: Gắn nhãn `ĐÃ XÁC MINH TƯƠNG THÍCH` (Màu xanh lục).
- **50 – 79 điểm**: Gắn nhãn `CÓ KHẢ NĂNG TƯƠNG THÍCH` (Màu vàng cam) — Yêu cầu kiểm tra kỹ chân giắc/thông số trước khi đặt hàng.
- **< 50 điểm**: Gắn nhãn `CHƯA ĐỦ THÔNG TIN` (Màu xám) — Cần thợ kiểm tra trực tiếp.

### Phân loại nguồn gốc xuất xứ:
- **Hàng OEM / Chính hãng (Original Equipment)**: Có tem mã phụ tùng hãng xe, đóng gói chuẩn hãng.
- **Hàng Thương hiệu Aftermarket Uy tín (Tier-1 Brand)**: Bosch, Denso, Valeo, Mobis, Delphi, v.v.
- **Hàng Thay thế OEM (OEM Replacement)**: Nhà máy linh kiện sản xuất theo tiêu chuẩn thay thế tương đương.
- **Hàng Không rõ nguồn gốc**: Không có nhãn mác thương hiệu rõ ràng; cảnh báo gara cân nhắc khi bảo hành.
