# TÀI LIỆU ĐẶC TẢ KỸ THUẬT: AI PARTS SCANNER & SMART PRICING
**Hệ thống Find And Fix (Garage Atlas / Auto Repair Documents)**
*Phiên bản: 1.0.0 — Ngày phát hành: 2026-10-23*
*Tác giả: Senior Full-stack Engineer, AI Computer Vision & Automotive Specialist*

---

## 1. TỔNG QUAN HỆ THỐNG & MỤC TIÊU NGHIỆP VỤ

### 1.1. Bối cảnh & Đối tượng sử dụng
Trong quá trình sửa chữa ô tô tại gara, nhân viên kỹ thuật và quản lý thường xuyên đối mặt với các thách thức:
- Linh kiện ô tô bị mòn, mất tem nhãn hoặc chỉ có hình dáng thực tế; khó xác định chính xác danh pháp kỹ thuật.
- Cần tra cứu nhanh nguồn hàng phụ tùng trên các sàn sản xuất & thương mại phụ tùng gốc tại Trung Quốc (Taobao, 1688).
- Cần tính nhanh giá bán niêm yết của gara theo công thức giá vốn (CNY -> VND) cộng mức markup chuẩn (mặc định 30%) kèm chi phí mua hộ, vận chuyển và công thay thế.
- Cần tạo và gửi báo giá chuyên nghiệp cho khách hàng ngay trên điện thoại (iPhone, Android) bằng một tay trong xưởng.

### 1.2. Mục tiêu kỹ thuật
- **Tương thích Mobile Web / PWA**: Tối ưu 100% cho Safari (iOS) và Chrome (Android) qua HTTPS/localhost.
- **Không phá vỡ chức năng cũ**: Bảo toàn nguyên vẹn EWD Library, DTC Codes, Quản lý tài liệu và Supabase RLS hiện có.
- **Pipeline Computer Vision & OCR**: Phát hiện đa linh kiện, hiển thị bounding box trực quan, nhận diện Part Number / OEM code, trích xuất danh pháp đa ngữ (Việt - Anh - Trung giản thể).
- **Kiến trúc Provider Adapter**: Module hóa việc tra cứu trên Taobao, 1688 và bên thứ ba được cấp phép; xử lý minh bạch tình trạng kết nối, có chế độ Fallback URL an toàn (chống SSRF) và gắn nhãn DEMO rõ ràng nếu thiếu API key.
- **Smart Pricing Engine**: Tính toán minh bạch giá nguồn, landed cost (phí nội địa TQ, vận chuyển VN, phí mua hộ), markup 30% mặc định, làm tròn giá và bảo vệ bí mật giá vốn gara trước khách hàng.

---

## 2. KIẾN TRÚC TỔNG THỂ (SYSTEM ARCHITECTURE)

```
+-----------------------------------------------------------------------------------+
|                        MOBILE CLIENT (PWA / RESPONSIVE WEB)                       |
|                                                                                   |
|  +--------------------+  +--------------------+  +-----------------------------+  |
|  | Camera & Stream    |  | Interactive Crop   |  | Multi-Object Selection      |  |
|  | - getUserMedia back|  | - Canvas zoom/pan  |  | - Bounding boxes [x,y,w,h]  |  |
|  | - Torch / Flash    |  | - Rotate 90 deg    |  | - Manual box adjustment     |  |
|  | - Blur detector    |  | - Compression EXIF |  | - Tap to isolate part       |  |
|  +--------------------+  +--------------------+  +-----------------------------+  |
|                                     |                                             |
|  +--------------------+  +--------------------+  +-----------------------------+  |
|  | Part Metadata Card |  | Search Results UI  |  | Customer Quotation Drawer   |  |
|  | - VN/EN/ZH names   |  | - Taobao & 1688    |  | - Garage price (+30% markup)|  |
|  | - OEM code & OCR   |  | - MOQ & Tier price |  | - Labor & Warranty          |  |
|  | - Compatibility    |  | - Live exchange rate| | - Share Zalo / Print PDF    |  |
|  +--------------------+  +--------------------+  +-----------------------------+  |
+-----------------------------------------------------------------------------------+
                                      |
                           (HTTPS REST / Local Proxy)
                                      |
+-----------------------------------------------------------------------------------+
|                     APPLICATION & PROXY BACKEND LAYER                             |
|                                                                                   |
|  +--------------------------------+  +-----------------------------------------+  |
|  | Vision & OCR Pipeline Engine   |  | Exchange Rate Service                   |  |
|  | - Automotive model inference   |  | - CNY/VND feed (Vietcombank / Bank API) |  |
|  | - OCR text & barcode parser    |  | - Timestamp & Source attribution        |  |
|  | - Automotive dictionary lookup |  | - Admin override cache                  |  |
|  +--------------------------------+  +-----------------------------------------+  |
|                                     |                                             |
|  +-----------------------------------------------------------------------------+  |
|  | Provider Adapter Manager                                                    |  |
|  |  +------------------+  +------------------+  +----------------------------+  |  |
|  |  | TaobaoProvider   |  | Alibaba1688Provider| | ElimapiProvider (3rd party)|  |  |
|  |  | (Image/Keyword)  |  | (MOQ/Tier Price) |  | (Authorized Gateway)       |  |  |
|  |  +------------------+  +------------------+  +----------------------------+  |  |
|  |  +------------------------------------------------------------------------+  |  |
|  |  | ManualProductSearchProvider (Anti-SSRF, URL Verification, Direct Search)|  |  |
|  |  +------------------------------------------------------------------------+  |  |
|  +-----------------------------------------------------------------------------+  |
|                                     |                                             |
|  +-----------------------------------------------------------------------------+  |
|  | Smart Pricing & Matching Engine                                             |  |
|  | - Compatibility Scoring (OEM / Specs / Position / Fitment)                  |  |
|  | - Landed Cost (Item + CN Freight + VN Weight Rate + Service Fee)            |  |
|  | - Garage Markup (Default 30%, 0-100%, Category Rules, Rounding 1k/5k)       |  |
|  +-----------------------------------------------------------------------------+  |
+-----------------------------------------------------------------------------------+
                                      |
+-----------------------------------------------------------------------------------+
|                        DATABASE & PERSISTENCE (SUPABASE)                          |
|  - part_scan_sessions      - product_search_results    - pricing_calculations     |
|  - detected_parts          - external_product_sources  - customer_quotes          |
|  - part_search_queries     - exchange_rates            - quote_items              |
|                            - pricing_rules             (Row Level Security / Gara)|
+-----------------------------------------------------------------------------------+
```

---

## 3. MÔ TẢ CHI TIẾT 10 MÀN HÌNH / WORKFLOW

| STT | Màn hình / Phân hệ | Mục tiêu nghiệp vụ | Các thành phần UI chính |
|---|---|---|---|
| 1 | **Scanner Home** | Điểm bắt đầu tra cứu nhanh, xem thống kê & lịch sử quét | Hero Banner, nút "Quét phụ tùng" nổi bật, thẻ chọn xe hiện tại, danh sách lần quét gần đây. |
| 2 | **Camera Viewfinder** | Chụp ảnh phụ tùng bằng camera sau với chất lượng tối ưu | Video viewport tỷ lệ 4:3/16:9, nút Shutter tròn lớn, công tắc Bật/Tắt Flash, đổi Camera, nút chọn từ thư viện ảnh, thước ngắm định tâm, cảnh báo mờ ảnh. |
| 3 | **Crop & Object Selection** | Chỉnh sửa khung hình và chọn đối tượng cần tra | Canvas crop tương tác, xoay 90 độ, hiển thị bounding boxes tự động của AI, công tắc vẽ vùng thủ công (Manual Box Selector). |
| 4 | **Part Identification** | Xác nhận danh tính linh kiện, đọc mã OCR | Thẻ chi tiết phụ tùng: Tên VN, Tên EN, Tên Trung Giản Thể (dùng search), mã OEM/Part No nhận diện được, mức độ tin cậy (Cao/Trung bình/Thấp), nút chỉnh sửa thông tin. |
| 5 | **Vehicle Compatibility** | Bổ sung thông số xe và xác nhận khả năng lắp vừa | Form chọn/nhập Hãng, Model, Năm, Động cơ, VIN, Vị trí (Trước/Sau, Trái/Phải). Huy hiệu tương thích 3 mức: Đã xác minh / Có khả năng / Chưa đủ thông tin. |
| 6 | **Product Search Results** | Hiển thị kết quả phụ tùng từ Taobao & 1688 | Bộ lọc (Taobao, 1688, Giá thấp, Phù hợp nhất), thẻ sản phẩm kèm ảnh, giá gốc CNY, giá quy đổi VND, MOQ (số lượng tối thiểu), tên shop, nút "Xem nguồn". |
| 7 | **Product Details Sheet** | Xem chi tiết sản phẩm, bảng giá bậc thang 1688 | Bottom sheet hiển thị mô tả, thuộc tính kích thước, bảng giá theo số lượng mua (Tier pricing), liên kết kiểm tra nguồn gốc. |
| 8 | **Smart Pricing & Markup** | Tính giá niêm yết bán ra của gara | Bảng phân tích chi phí: Giá sản phẩm VND + Vận chuyển TQ + Cước về VN + Phí mua hộ. Nút "Lấy giá niêm yết" (+30%), thanh trượt chỉnh 0-100%, tùy chọn làm tròn. |
| 9 | **Customer Quotation** | Tạo báo giá chuyên nghiệp gửi cho khách | Form nhập thông tin khách, biển số, tiền công thợ, hạn bảo hành. Chế độ xem khách (ẩn giá vốn), nút Sao chép nội dung Zalo, nút Chia sẻ, nút Xuất PDF. |
| 10 | **Scan History & Settings** | Quản lý lịch sử và cấu hình gara | Lịch sử các lần quét, cấu hình tỷ giá CNY/VND, nguồn tỷ giá, mức markup mặc định, đơn giá cước vận chuyển/kg. |

---

## 4. QUY TRÌNH BẢO VỆ DỮ LIỆU & AN TOÀN HỆ THỐNG

1. **Bảo vệ khóa bí mật (API Keys)**:
   - Toàn bộ API keys kết nối dịch vụ ngoài (Elimapi, Taobao TOP, 1688, Open Exchange) được lưu trữ tại biến môi trường phía server. Không bao giờ xuất hiện trên frontend JavaScript.
2. **Chống tấn công SSRF (Server-Side Request Forgery)**:
   - Đối với tính năng dán link thủ công của người dùng, server chỉ chấp nhận domain nằm trong allowlist: `*.taobao.com`, `*.tmall.com`, `*.1688.com`. Mọi IP nội bộ, domain lạ hoặc protocol không phải `https:` đều bị từ chối.
3. **Quyền riêng tư hình ảnh người dùng**:
   - Ảnh chụp chỉ được xử lý tạm thời trên bộ nhớ RAM hoặc canvas cục bộ; tự động loại bỏ metadata EXIF (GPS, thông tin thiết bị). Không tự động lưu ảnh cá nhân lên storage vĩnh viễn nếu người dùng chưa lưu phiên quét.
4. **Bảo mật giá vốn của gara**:
   - Dữ liệu giá gốc CNY, tỷ giá áp dụng, chi phí mua hộ và phần trăm markup chỉ lưu ở cấp quản trị gara và session nội bộ. Bản báo giá in ấn hoặc chia sẻ cho khách hàng được render độc lập, tuyệt đối không chứa dữ liệu giá vốn.

---

## 5. KẾ HOẠCH TRIỂN KHAI THEO PHASES

- **Phase 1**: Audit codebase, thiết kế tài liệu đặc tả, kiểm tra tính khả thi của các API nhà cung cấp.
- **Phase 2**: Xây dựng camera scanner, canvas crop, bộ phát hiện mờ ảnh, pipeline nhận diện phụ tùng đa đối tượng & OCR.
- **Phase 3**: Xây dựng kiến trúc Provider Adapter (Taobao, 1688, Elimapi, Manual Search với anti-SSRF).
- **Phase 4**: Hoàn thiện UI kết quả tra cứu, hệ thống quy đổi tỷ giá CNY/VND và đánh giá độ tương thích xe.
- **Phase 5**: Xây dựng Smart Pricing Engine (+30% markup, landed costs) và hệ thống tạo báo giá khách hàng.
- **Phase 6**: Supabase migration (10 bảng), lưu trữ lịch sử IndexedDB/Cloud và tối ưu hóa trải nghiệm mobile 1 tay.
- **Phase 7**: Kiểm thử toàn diện trên Safari iOS, Chrome Android, Desktop và lập báo cáo nghiệm thu.
