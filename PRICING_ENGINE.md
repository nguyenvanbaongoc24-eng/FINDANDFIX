# TÀI LIỆU ĐẶC TẢ SMART PRICING ENGINE & BÁO GIÁ GARA
## Công thức tính giá vốn, Markup 30% và Hệ thống báo giá cho khách hàng
*Find And Fix Automotive SaaS — Phiên bản 1.0.0 — Ngày: 2026-10-23*

---

## 1. CÔNG THỨC TOÁN HỌC & CẤU TRÚC GIÁ

Hệ thống phân tách rạch ròi giữa hai khái niệm: **Giá nguồn (Source / Cost Price)** và **Giá bán đề xuất của gara (Garage Suggested Price)**.

```
                      +-----------------------------+
                      |   Đơn giá sản phẩm (CNY)    |
                      +-----------------------------+
                                     │
                 × Tỷ giá CNY/VND (kèm nguồn & giờ)
                                     │
                                     ▼
                      +-----------------------------+
                      |   Giá sản phẩm quy đổi (VND)|
                      +-----------------------------+
                                     │
     + Phí vận chuyển nội địa Trung Quốc (nếu có)
     + Cước vận chuyển TQ về VN (theo trọng lượng kg)
     + Phí dịch vụ mua hộ (mặc định 2% - 3%)
                                     │
                                     ▼
                      +-----------------------------+
                      |  TỔNG GIÁ VỐN NHẬP VỀ (VND) |  ◄── (Landed Cost - Dữ liệu NỘI BỘ gara)
                      +-----------------------------+
                                     │
                                     ▼
                   [ Nút "LẤY GIÁ NIÊM YẾT" (+30%) ]
                                     │
                  Công thức: Giá vốn × (1 + Markup / 100)
                  Làm tròn: đến 1.000đ hoặc 5.000đ gần nhất
                                     │
                                     ▼
                      +-----------------------------+
                      | GIÁ BÁN ĐỀ XUẤT CỦA GARA    |  ◄── (Giá hiển thị cho KHÁCH HÀNG)
                      +-----------------------------+
                                     │
     + Tiền công kiểm tra & lắp đặt (Labor cost)
     + Thời gian bảo hành (3 tháng / 6 tháng / 12 tháng)
                                     │
                                     ▼
                      +-----------------------------+
                      |     BẢN BÁO GIÁ HOÀN CHỈNH  |
                      | (Gửi Zalo / In phiếu PDF)   |
                      +-----------------------------+
```

---

## 2. CHI TIẾT CÁC THÀNH PHẦN TÍNH TOÁN

### 2.1. Tỷ giá hối đoái CNY / VND
- **Tỷ giá trực tuyến**: Lấy từ nguồn Ngân hàng Thương mại Cổ phần Ngoại thương Việt Nam (Vietcombank) hoặc API tỷ giá công khai.
- **Minh bạch**: Mọi màn hình hiển thị giá quy đổi đều phải ghi rõ:
  `Tỷ giá: 1 CNY = 3.680 VND · Nguồn: Vietcombank · Cập nhật: 2026-10-23 15:30:00`
- **Fallback quản trị viên**: Nếu mất kết nối mạng hoặc nguồn API không phản hồi, quản trị viên có thể nhập tỷ giá thủ công trong màn hình Cài đặt, hệ thống sẽ gắn nhãn: `Tỷ giá: Thủ công (Admin)`.

### 2.2. Tổng giá vốn nhập về (Total Landed Cost)
$$LandedCost = (Price_{CNY} \times Rate_{CNY/VND}) + Freight_{CN} + (Weight_{kg} \times Rate_{shipping/kg}) + Fee_{procurement}$$

Trong đó:
- $Price_{CNY}$: Giá sản phẩm trên Taobao / 1688 theo MOQ thực tế.
- $Rate_{CNY/VND}$: Tỷ giá quy đổi tại thời điểm tính toán.
- $Freight_{CN}$: Phí ship nội địa từ xưởng sản xuất về kho Quảng Châu/Đông Hưng (thường từ 0 – 15 CNY).
- $Weight_{kg} \times Rate_{shipping/kg}$: Cước vận chuyển quốc tế về Việt Nam (mặc định cấu hình: 28.000 VND/kg).
- $Fee_{procurement}$: Phí thanh toán hộ/kiểm đếm (mặc định 2% giá trị đơn).

### 2.3. Mức Markup Mặc Định 30% & Phân biệt Biên lợi nhuận
Khi người dùng nhấn nút **"Lấy giá niêm yết"**, hệ thống tự động áp dụng mức markup chuẩn:

$$Price_{suggested} = BaseCost \times \left(1 + \frac{Markup\%}{100}\right)$$

> [!IMPORTANT]
> **Lưu ý tài chính bắt buộc**: 
> - **Markup 30% KHÔNG PHẢI là biên lợi nhuận (Profit Margin) 30%!**
> - Biên lợi nhuận thực tế:
>   $$ProfitMargin = \frac{Price_{suggested} - BaseCost}{Price_{suggested}} = \frac{130 - 100}{130} \approx 23.08\%$$
> - Hệ thống không được đánh tráo hai khái niệm này trong báo cáo tài chính của xưởng.

### 2.4. Quy tắc làm tròn số (Rounding Rules)
Tránh tạo ra các con số lẻ gây khó khăn khi thu tiền mặt tại xưởng (ví dụ: `286.924 VND`).
Hệ thống hỗ trợ 3 tùy chọn làm tròn cấu hình được:
1. **Làm tròn đến 1.000 VND gần nhất** (Mặc định):
   `286.924 VND` $\rightarrow$ `287.000 VND`.
2. **Làm tròn đến 5.000 VND**:
   `286.924 VND` $\rightarrow$ `285.000 VND` hoặc `290.000 VND`.
3. **Làm tròn đến 10.000 VND**:
   `286.924 VND` $\rightarrow$ `290.000 VND`.

---

## 3. NGUYÊN TẮC BẢO VỆ DỮ LIỆU NỘI BỘ TRONG BÁO GIÁ

Báo giá gửi cho khách hàng phải bảo đảm tính chuyên nghiệp, minh bạch về mặt dịch vụ nhưng tuyệt đối bảo mật biên lợi nhuận của xưởng:

| Hạng mục dữ liệu | Chế độ xem Nội bộ (Gara) | Chế độ gửi Khách hàng (Quotation) |
|---|---|---|
| Tên phụ tùng & Mã OEM | Hiển thị | Hiển thị |
| Ảnh sản phẩm | Hiển thị | Hiển thị |
| Tình trạng xác minh lắp vừa | Hiển thị | Hiển thị rõ ràng |
| **Giá gốc sàn (CNY)** | **Hiển thị** | **ẨN HOÀN TOÀN** |
| **Tên sàn (Taobao / 1688)** | **Hiển thị** | **ẨN HOÀN TOÀN** |
| **Phí ship TQ & Phí mua hộ** | **Hiển thị** | **ẨN HOÀN TOÀN** |
| **Phần trăm Markup (% lãi)**| **Hiển thị** | **ẨN HOÀN TOÀN** |
| Đơn giá bán của Gara | Hiển thị | Hiển thị |
| Tiền công thay thế/lắp đặt | Hiển thị | Hiển thị riêng rẽ |
| Thời hạn bảo hành | Hiển thị | Hiển thị (Cam kết uy tín) |
| Tổng tiền thanh toán | Hiển thị | Hiển thị |

### Định danh văn phong:
- Gọi là **"Giá bán đề xuất của gara"** hoặc **"Đơn giá gara"**.
- Tuyệt đối không dùng thuật ngữ *"Giá niêm yết chính hãng"* cho đơn giá do gara tự tính toán từ nguồn hàng aftermarket hoặc nhập khẩu.

---

## 4. CÁC HÌNH THỨC XUẤT BÁO GIÁ

1. **Sao chép văn bản (Copy Text)**: Tự động format đoạn tin nhắn hoàn chỉnh, lịch sự để thợ dán thẳng vào Zalo hoặc tin nhắn SMS gửi chủ xe.
2. **Chia sẻ nhanh (Web Share API)**: Kích hoạt menu chia sẻ của điện thoại (iOS / Android) gửi trực tiếp tới Zalo, Messenger, Email.
3. **In phiếu / Xuất PDF**: Tạo mẫu phiếu báo giá chuẩn khổ A4/A5 với tiêu đề xưởng, số báo giá, ngày giờ, thông tin xe, danh sách phụ tùng, tiền công và chữ ký xác nhận của chủ xe.
