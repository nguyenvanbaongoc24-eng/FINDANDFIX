# Product requirements — Automotive Repair Documents

## Mục tiêu sản phẩm

Xây dựng PWA mobile-first tiếng Việt cho thợ sửa xe, gara và người học kỹ thuật để chọn xe, tra DTC, tìm tài liệu được cấp phép và xem tài liệu trên điện thoại.

## Vai trò

| Vai trò | Khả năng |
| --- | --- |
| Khách | Dùng dữ liệu mẫu hợp pháp, tìm DTC, xem danh mục công khai |
| Thành viên | Lưu bookmark và lịch sử xem của chính mình |
| Biên tập viên | Tạo metadata, gắn xe/danh mục/nguồn, gửi duyệt |
| Quản trị viên | Duyệt giấy phép, upload, quản lý nguồn và ingestion job |

## Luồng chính

1. Người dùng chọn hãng → model → phiên bản → đời xe.
2. Nhập DTC hoặc từ khóa; kết quả ưu tiên xe đang chọn, sau đó kết quả dùng chung.
3. Chọn tài liệu để xem metadata, phạm vi xe, giấy phép và tệp được phép xem.
4. Xem PDF/SVG trong viewer; thêm/xóa bookmark.
5. Admin upload tài liệu có quyền hoặc khởi tạo crawl cho nguồn đã duyệt.

## Yêu cầu bắt buộc

- Không hiển thị hay phân phối tệp khi `distribution_allowed=false` hoặc license chưa duyệt.
- Mỗi document và document file phải truy vết được data source, license, checksum, người nhập và thời gian xử lý.
- Kết quả tìm kiếm phải phân biệt dữ liệu mẫu, metadata và tài liệu có thể mở.
- Giao diện dùng một tay, hỗ trợ safe area, trạng thái offline rõ ràng và keyboard navigation.
- Không có cơ chế bypass đăng nhập, DRM, thuê bao hay pinning.

## Phạm vi MVP

- Dữ liệu mẫu tự soạn: 3 hãng, 4 model, 4 variant, 6 DTC và 3 tài liệu minh họa do dự án tạo.
- Chọn xe, tìm kiếm, lọc danh mục, chi tiết tài liệu, viewer SVG/PDF mẫu, bookmark local.
- Admin dashboard mô phỏng bằng dữ liệu local; contract Supabase sẵn sàng để thay thế khi có URL/key.

## Ngoài phạm vi MVP

- VIN decoder, dữ liệu OEM có bản quyền, tài khoản trả phí, đồng bộ đa thiết bị, OCR vận hành thật và crawl tự động trên nguồn chưa được phê duyệt.
