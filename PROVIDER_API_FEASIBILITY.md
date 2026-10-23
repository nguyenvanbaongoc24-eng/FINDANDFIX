# KHẢO SÁT TÍNH KHẢ THI VÀ ĐẶC TẢ PROVIDER ADAPTER
## Nguồn tra cứu phụ tùng Taobao & 1688 cho ứng dụng Find And Fix
*Ngày khảo sát: 2026-10-23 — Trạng thái: Hoàn tất đánh giá kỹ thuật*

---

## 1. MỤC TIÊU KHẢO SÁT

Đánh giá các phương án kỹ thuật để kết nối và truy xuất dữ liệu sản phẩm, hình ảnh, đơn giá và số lượng tối thiểu (MOQ) từ hai nền tảng thương mại điện tử lớn nhất Trung Quốc:
- **Taobao (C2C / B2C)**: https://www.taobao.com/ (Tập đoàn Alibaba)
- **1688 (B2B Wholesale)**: https://www.1688.com/ (Tập đoàn Alibaba)

Mục tiêu cốt lõi: Đảm bảo giải pháp hoạt động tin cậy, hợp pháp, bảo mật, không vi phạm chính sách của nhà cung cấp, và có cơ chế xử lý lỗi/fallback thông minh cho gara sửa xe.

---

## 2. BẢNG SO SÁNH CÁC PHƯƠNG ÁN KẾT NỐI

| Tiêu chí | Phương án 1: Alibaba Official Open Platform | Phương án 2: Authorized 3rd Party (Elimapi / OneBound) | Phương án 3: Web Scraping / Reverse Engineering | Phương án 4: Manual Search & Verified URL (Khuyến nghị MVP) |
|---|---|---|---|---|
| **Cơ chế hoạt động** | Sử dụng TOP (Taobao Open Platform) & 1688 Open API chính thức. | Sử dụng REST API của các nhà cung cấp dữ liệu thương mại điện tử quốc tế được ủy quyền. | Dùng headless browser (Puppeteer, Playwright) hoặc reverse mtop token. | Kết hợp API adapter có sẵn + mở link tìm kiếm trực tiếp + dán URL sản phẩm để trích xuất & xác minh. |
| **Hỗ trợ Image Search** | Có, nhưng giới hạn cho tài khoản ISV Enterprise được duyệt đặc biệt. | Rất tốt. Cung cấp endpoint tìm kiếm bằng ảnh upload trực tiếp (base64 hoặc URL). | Cực kỳ khó khăn do cơ chế chặn bot bằng trượt xác thực (Slide Captcha / GeeTest). | Mở trang tìm kiếm ảnh trực tiếp trên trình duyệt thiết bị người dùng. |
| **Hỗ trợ Text/OEM Search** | Có API tra cứu từ khóa, SKU, chi tiết sản phẩm. | Rất tốt. Trả về JSON chuẩn hóa (giá, ảnh, tên shop, MOQ, SKU tiers). | Dễ bị chặn IP, dính WAF Sentinel của Alibaba. | Người dùng tìm từ khóa tiếng Trung đã chuẩn hóa hoặc dán link sản phẩm. |
| **Yêu cầu pháp lý & Đăng ký** | Cần pháp nhân công ty tại Trung Quốc đại lục (hoặc Hong Kong), mã số thuế, ký quỹ ISV. | Đăng ký tài khoản nhà phát triển trực tuyến, nạp credit theo gói gọi API. | Vi phạm Điều khoản dịch vụ (ToS) của Alibaba, rủi ro pháp lý cao. | 100% tuân thủ, không cần tài khoản doanh nghiệp nước ngoài. |
| **Chi phí ước tính** | Phí duy trì ISV hàng năm + tiền ký quỹ (hàng nghìn USD). | Trả phí theo lượt gọi: ~0.005$ - 0.015$ / request. Thường có free credit thử nghiệm. | Chi phí server proxy xoay vòng (residential proxy), bảo trì liên tục khi đổi layout. | 0 USD chi phí ban đầu, tích hợp sẵn sàng khi bổ sung API key. |
| **Tính khả thi giai đoạn này** | **Thấp** (Rào cản pháp lý & thủ tục doanh nghiệp Trung Quốc). | **Cao** (Có thể tích hợp ngay qua REST API server-side). | **Bị cấm** (Không an toàn, không ổn định, vi phạm yêu cầu dự án). | **Cực cao** (Đảm bảo 100% hoạt động ngay lập tức, phục vụ thực tế). |

---

## 3. ĐẶC TẢ KIẾN TRÚC PROVIDER ADAPTER

Thiết kế hệ thống theo mô hình **Provider Pattern** (Adapter Interface chung) giúp ứng dụng dễ dàng chuyển đổi hoặc kết hợp nhiều nguồn dữ liệu mà không làm thay đổi code giao diện.

```
                  +--------------------------------+
                  |    IProductSearchProvider      |
                  |           (Interface)          |
                  +--------------------------------+
                  | + searchByImage(imgBlob): List |
                  | + searchByKeyword(query): List |
                  | + getProductDetails(id): Detail|
                  | + parseUrl(productUrl): Detail |
                  +--------------------------------+
                                  ▲
        ┌─────────────────────────┼─────────────────────────┐
        │                         │                         │
+-------------------+   +--------------------+   +----------------------+
|  TaobaoProvider   |   | Alibaba1688Provider|   | ElimapiProvider      |
| (Official TOP)    |   | (Official Open API)|   | (3rd Party Gateway)  |
+-------------------+   +--------------------+   +----------------------+
        │
+----------------------------------------------------+
|            ManualProductSearchProvider             |
| - URL Validation & Parser (TaoBao / 1688)          |
| - Anti-SSRF Security Sanitizer                     |
| - Direct Web Query Generator                       |
+----------------------------------------------------+
```

### 3.1. Cấu trúc dữ liệu chuẩn hóa (Normalized Product Result)
Mọi adapter bắt buộc phải chuẩn hóa dữ liệu trả về theo schema sau:

```typescript
interface NormalizedProduct {
  id: string;                      // ID duy nhất trên sàn
  provider: 'taobao' | '1688' | 'third_party' | 'manual';
  sourceName: 'Taobao' | '1688 Wholesale';
  titleVi: string;                 // Tiêu đề dịch tiếng Việt sơ bộ
  titleOriginal: string;           // Tiêu đề gốc tiếng Trung
  imageUrl: string;                // Ảnh đại diện sản phẩm
  detailUrl: string;               // Link gốc xem sản phẩm (đã làm sạch affiliate/tracking)
  priceCny: number;                // Đơn giá bán lẻ/đơn lẻ thực tế (CNY)
  priceVnd: number;                // Giá quy đổi VND theo tỷ giá hiện hành
  shopName: string;                // Tên cửa hàng
  shopLocation?: string;           // Tỉnh/thành phố (ví dụ: Quảng Đông, Chiết Giang)
  moq: number;                     // Minimum Order Quantity (Bắt buộc >= 1)
  tierPrices?: Array<{             // Bảng giá theo số lượng của 1688
    minQuantity: number;
    priceCny: number;
  }>;
  partCategory: string;            // Nhóm phụ tùng (Gạt mưa, Má phanh, v.v.)
  isOemCandidate: boolean;         // Có dấu hiệu là hàng OEM/nhà máy không
  compatibilityStatus: 'verified' | 'probable' | 'unverified';
  updatedAt: string;               // Thời điểm lấy giá (ISO 8601)
  isDemoData?: boolean;            // Cờ bắt buộc nếu chạy ở chế độ Mẫu thử nghiệm
}
```

---

## 4. CHI TIẾT CÁC PROVIDER

### 4.1. ElimapiProvider (Authorized Third-Party Gateway)
- **Tài liệu tham khảo**: https://elimapi.com/
- **Endpoint hình ảnh**: `POST /api/taobao/item_search_img` hoặc `POST /api/1688/item_search_img`
- **Endpoint từ khóa**: `GET /api/taobao/item_search?q={query}`
- **Authentication**: `Authorization: Bearer <ELIMAPI_SECRET_KEY>` (chỉ lưu tại backend server).
- **Cơ chế xử lý**: Server nhận ảnh từ client, chuyển tiếp tới Elimapi, nhận payload JSON, trích xuất 3–5 kết quả khớp nhất và trả về client.

### 4.2. Alibaba1688Provider & Quy tắc tính giá theo MOQ
- **Đặc thù của 1688**: 1688 là sàn bán sỉ sản xuất. Một sản phẩm thường có các mức giá:
  - Mua 2–9 sản phẩm: 45.00 CNY / chiếc.
  - Mua 10–99 sản phẩm: 38.00 CNY / chiếc.
  - Mua ≥ 100 sản phẩm: 30.00 CNY / chiếc.
- **Quy tắc bắt buộc**: 
  - KHÔNG BAO GIỜ lấy đơn giá của mức mua 1.000 chiếc để áp cho thợ sửa xe mua 1 hoặc 2 chiếc thay cho khách.
  - Luôn lấy đơn giá của bậc số lượng thấp nhất (bậc 1) làm giá cơ sở, đồng thời hiển thị rõ MOQ (ví dụ: "MOQ: 2 chiếc").

### 4.3. ManualProductSearchProvider & Chống SSRF (Server-Side Request Forgery)
Khi gara chưa cấu hình API key trả phí hoặc khi cần kiểm tra khẩn cấp:
- Hệ thống tự động sinh liên kết tìm kiếm trực tiếp chứa từ khóa tiếng Trung đã chuẩn hóa:
  - Taobao: `https://s.taobao.com/search?q={encoded_chinese_keyword}`
  - 1688: `https://air.1688.com/search/index.htm?keywords={encoded_chinese_keyword}`
- Người dùng có thể tìm trên trình duyệt và dán URL sản phẩm vào Find And Fix.
- **Quy tắc kiểm tra an toàn URL (Anti-SSRF Validator)**:
  - Giao thức bắt buộc: `https:`.
  - Hostname hợp lệ: Chỉ cho phép kết thúc bằng `.taobao.com`, `.tmall.com`, `.1688.com` (ví dụ: `item.taobao.com`, `detail.1688.com`, `detail.tmall.com`).
  - Chặn hoàn toàn: `localhost`, `127.0.0.1`, IP private (10.x.x.x, 192.168.x.x, 172.16-31.x.x), tên miền lạ hoặc ký tự chuyển hướng.
  - Regex kiểm tra Item ID: Taobao (`[?&]id=(\d+)`), 1688 (`/offer/(\d+)\.html`).

---

## 5. MINH BẠCH DỮ LIỆU & QUY ĐỊNH DEMO
Theo Acceptance Criteria 15 của dự án:
- Nếu hệ thống chạy mà chưa có API key thương mại hoạt động, toàn bộ kết quả giả lập hoặc dữ liệu kiểm thử bắt buộc phải hiển thị nhãn:
  `[DEMO - DỮ LIỆU KIỂM THỬ]` với màu cảnh báo rõ ràng.
- Tuyệt đối không giả mạo kết quả trả về như thể đang kết nối trực tiếp với API thật.
- Khi người dùng dán link thật hoặc kết nối API key thật, nhãn DEMO tự động được gỡ bỏ và hiển thị thời gian xác minh thực tế.
