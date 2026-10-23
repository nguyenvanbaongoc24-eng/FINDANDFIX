# Nguồn dữ liệu và giấy phép

Ngày kiểm tra: 23-10-2026. `fetched_at` chính xác cho từng batch được lưu trong SQLite và catalog sinh ra.

| ID | Nguồn | URL | Giấy phép / điều kiện | Attribution | Dùng trong build |
| --- | --- | --- | --- | --- | --- |
| `nhtsa-vpic` | NHTSA vPIC | https://vpic.nhtsa.dot.gov/api/ | FAQ chính thức nói API miễn phí cho công chúng, không cần đăng ký; phải dùng lịch sự vì có traffic control. Chưa tuyên bố giấy phép SPDX cụ thể. | “NHTSA vPIC” + link API | Có: cache nhỏ các hãng/model và VIN lookup theo yêu cầu. Không bulk dump. |
| `nhtsa-recalls` | NHTSA Recalls API | https://api.nhtsa.gov/recalls/ | API công khai; giấy phép tái phân phối không được xác minh độc lập trong lần khảo sát này. | “NHTSA Recalls API” + URL request | Có: truy vấn theo make/model/year giới hạn, cache local; không phát hành dump. |
| `nhtsa-complaints` | NHTSA Complaints API | https://api.nhtsa.gov/complaints/ | API công khai; giấy phép tái phân phối chưa có SPDX xác minh. | “NHTSA Complaints API” + URL request | Có: truy vấn giới hạn, cache local; dữ liệu hiển thị theo request. |
| `mechanicdb-obd2-sample` | MechanicDB public OBD-II sample | https://github.com/MechanicDB/MechanicDB-public | ODbL 1.0. Chỉ bộ sample tại repository; phải attribution, share-alike và không áp dụng biện pháp kỹ thuật hạn chế tái sử dụng. Không dùng tier trả phí. | “MechanicDB, ODbL v1.0” + repository link | Có: 90-code developer sample, fixes và replacement parts nếu file có mặt. |
| `wikidata` | Wikidata | https://www.wikidata.org/wiki/Wikidata:Licensing | CC0 cho structured data theo chính sách Wikidata. | “Wikidata contributors” khi cần | Chưa nạp tự động; dành cho bổ sung metadata sau review. |
| `open-labor-project` | Open Labor Project | Chưa có endpoint/license đã xác minh | Chưa đủ bằng chứng cho download hàng loạt. | N/A | Không dùng; chỉ ghi registry `REVIEW_REQUIRED`. |
| Kaggle / Hugging Face automotive datasets | Nhiều publisher | Theo từng dataset | Phải có license rõ ràng và cho phép mục đích định dùng. | Theo dataset | Không dùng trong batch này. |

## Nguồn bị loại trừ

Không tải hoặc sao chép từ Carly, Auto Repair Documents, ALLDATA, Mitchell, MOTOR, TecDoc, Haynes, Autodata, diễn đàn có bản quyền, Toyota TIS, Hyundai GSW hoặc AutoZone Repair Guides. Các dịch vụ hạn chế chỉ có thể xuất hiện dưới dạng link-out nếu có quyền truy cập hợp lệ của người dùng.

## Dẫn chiếu

- NHTSA vPIC FAQ: https://vpic.nhtsa.dot.gov/api/Home/Index/FAQ
- MechanicDB LICENSE: https://github.com/MechanicDB/MechanicDB-public/blob/main/LICENSE
- ODbL 1.0: https://opendatacommons.org/licenses/odbl/1-0/
