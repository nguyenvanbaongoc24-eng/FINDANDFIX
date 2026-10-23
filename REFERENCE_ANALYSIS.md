# Reference analysis

## Phạm vi và quyền

Phân tích này chỉ dùng trang Google Play công khai, website công khai và artifact Auto Repair Documents đã tải trước đó cho mục đích phân tích tĩnh trong phạm vi được yêu cầu. Không khẳng định đã giải mã Carmin vì không có APK Carmin được người dùng cung cấp hoặc quyền phân tích được xác minh. Không trích xuất nội dung tài liệu, không vượt xác thực và không sao chép tài sản của ứng dụng tham chiếu.

## Tín hiệu công khai

- Google Play mô tả Carmin tra sơ đồ điện theo hãng/model, có thư viện video và tài liệu kỹ thuật; listing cũng nêu tệp SVG trong phản hồi người dùng. [Google Play — Carmin](https://play.google.com/store/apps/details?id=com.min.car)
- Google Play mô tả Auto Repair Documents có chọn hãng, model, sơ đồ điện, nhóm tham chiếu động cơ/phụ tùng và video. [Google Play — Auto Repair Documents](https://play.google.com/store/apps/details?id=vn.advn.automobile)
- Website Auto Repair Documents công khai tổ chức điều hướng theo nhóm hệ thống xe, phụ tùng, đèn, dụng cụ và sách hướng dẫn. [Website Auto Repair Documents](https://autorepairdocuments.com/)

## Information architecture đề xuất

```text
Trang chủ
├── Chọn xe
├── Tra cứu
│   ├── Tài liệu
│   ├── EWD / SVG
│   └── DTC
├── Đã lưu
└── Admin
    ├── Tài liệu & tệp
    ├── Nguồn dữ liệu
    ├── Giấy phép
    └── Ingestion jobs
```

## Thiết kế chức năng độc lập

| Hạng mục | Quyết định cho sản phẩm mới |
| --- | --- |
| Điều hướng xe | Hãng → model → variant → năm; lưu “xe đang xem” trên thiết bị |
| Tài liệu | Metadata trước, quyền xem rõ ràng, viewer chỉ nhận signed URL của tệp được phép |
| EWD/SVG | Canvas full-width, pan/zoom, reset zoom, legend; không render SVG không được sanitize |
| PDF | Viewer theo trang, zoom, tìm văn bản khi bản text layer có sẵn; fallback download có kiểm soát quyền |
| DTC | Tìm theo mã, hệ thống, mô tả; phân biệt generic OBD-II với hãng/variant-specific |
| Mobile UX | Bottom navigation, filter sheet, tap target ≥44px, status loading/empty/error rõ ràng |

## Cải tiến so với tín hiệu tham chiếu

1. Bắt buộc chọn phạm vi xe trước khi khuyến nghị tài liệu.
2. Hiển thị nguồn, giấy phép và phiên bản tài liệu ngay tại chi tiết.
3. Cho biết tệp là PDF/SVG/ảnh/video và tình trạng text-search/OCR.
4. Có lịch sử, bookmark và offline shell thay vì giả định toàn bộ thư viện dùng offline.
5. Thiết kế accessibility và language selector ngay từ đầu.
