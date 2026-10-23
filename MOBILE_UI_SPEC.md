# Mobile UI specification

## Breakpoints and shell

- Primary: 360–480px; tablet/desktop tăng chiều rộng nội dung tối đa 760px.
- CSS dùng `env(safe-area-inset-*)`; bottom navigation có 4 mục: Home, Tra cứu, Đã lưu, Quản trị.
- Light/dark theo system preference, có toggle lưu trên thiết bị.
- Tap targets tối thiểu 44×44px; focus ring luôn hiện khi dùng keyboard.

## Màn hình

| Màn hình | Nội dung và thao tác |
| --- | --- |
| Trang chủ | Chọn xe, search entry point, DTC gần đây, category shortcuts |
| Chọn xe | Bottom sheet phụ thuộc hãng → model → variant → năm |
| Kết quả | Search cố định, chips loại tài liệu/hệ thống/năm, count và empty state |
| Chi tiết | Title, coverage xe, nguồn, giấy phép, định dạng, bookmark và action View |
| Viewer | PDF page controls/text search; SVG pan/zoom/reset; không có action View nếu quyền không đủ |
| DTC | Mã lớn, tiêu chuẩn, mô tả, điều kiện áp dụng, chẩn đoán ban đầu, nguồn |
| Đã lưu | Bookmark và lịch sử cục bộ; cho biết tệp nào offline-ready |
| Admin | Sources, licenses, files và ingest job states; không hiển thị cho user thường |

## Trạng thái UX

- Loading skeleton; error có retry; offline banner; empty state gợi ý sửa từ khóa.
- Tài liệu chỉ metadata có badge **Chưa có tệp được phép xem**; không làm người dùng hiểu đó là PDF khả dụng.
- Dark mode không dùng gray-on-gray thấp tương phản; minh họa EWD ưu tiên full-width/landscape.
