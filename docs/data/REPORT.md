# Báo cáo tích hợp dữ liệu mở

Ngày chạy: 23-10-2026.

## Đã tích hợp

| Nguồn | Kết quả batch |
| --- | --- |
| NHTSA vPIC | 11 hãng mục tiêu, 618 model; VIN test `1HGCM82633A004352` trả về Honda Accord 2003. |
| NHTSA Recalls API | 11 recall từ ba truy vấn xe kiểm thử. |
| NHTSA Complaints API | 90 complaint từ ba truy vấn xe kiểm thử. |
| MechanicDB public sample, ODbL 1.0 | 89 DTC, 326 repair fixes, 449 part mappings. |

Catalog browser có tại `/mvp/open-data/`: tra DTC, phụ tùng, recall, sources/licenses và VIN NHTSA trực tiếp với cache local 24 giờ. P0420 được kiểm tra có kết quả và hướng xử lý. Giá phụ tùng/hướng sửa từ MechanicDB dùng USD gốc, được gắn “ước tính thị trường Mỹ”.

## Kiểm thử

- `python scripts/data/pipeline.py`
- `python scripts/data/pipeline.py --offline`
- `python -m unittest scripts.data.test_pipeline -v`
- `node --check mvp/open-data/open-data.js`
- Trình duyệt local: tra P0420 và giải mã VIN mẫu thành công.

## Không tích hợp

- Dataset MechanicDB trả phí, OEM complete và heavy-duty trả phí: ngoài phạm vi license sample.
- Open Labor Project: chưa xác minh endpoint công khai và quyền download.
- Kaggle/Hugging Face automotive datasets: không có một dataset cụ thể đủ license để duyệt trong batch này.
- Nguồn thương mại/có bản quyền như Carly, ALLDATA, TecDoc, Auto Repair Documents và OEM portals: không crawl hoặc sao chép.

## Rủi ro và việc tiếp theo

- vPIC/recall/complaint được dùng qua API công khai; catalog không phát hành dump raw NHTSA. Khi cần phát hành rộng hơn, xác minh riêng điều kiện tái phân phối cho mỗi endpoint.
- 85 DTC sample chưa có bản dịch tiếng Việt được review; chúng hiển thị nguyên văn tiếng Anh với `translation_status=needs_review`.
- Chạy migration Supabase và thay loader SQLite bằng job server-side có quyền quản trị trước khi dùng production.
