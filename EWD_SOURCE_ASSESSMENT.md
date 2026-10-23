# EWD Library — đánh giá nguồn dữ liệu

Ngày đánh giá: 23-10-2026. Đánh giá này phân biệt rõ **metadata và liên kết nguồn** với quyền sao chép, lưu trữ, chuyển đổi hoặc phát hành nội dung.

| Nguồn tham khảo | Cấu trúc có thể lập chỉ mục | Định dạng quan sát/khả dĩ | Điều kiện sử dụng đã xác minh | Trạng thái registry | Quyết định cho EWD Library |
| --- | --- | --- | --- | --- | --- |
| Operation CHARM | Chưa có catalog hoặc chủ sở hữu/phạm vi cấp phép chính thức để xác minh | Chưa xác minh | Không tìm được điều khoản chính thức đủ để chứng minh quyền thu thập | `REJECTED` | Không crawl, không lưu metadata tài liệu như một nguồn vận hành. Chỉ mở lại khi có URL chính thức, robots và giấy phép từ chủ sở hữu. |
| AutoZone Repair Guides | Hãng → xe → năm → hệ thống → repair guide/diagram | HTML; có thể có ảnh/PDF phụ thuộc từng trang | Repair Guides được truy cập qua tài khoản AutoZone Rewards; điều khoản bảo hộ nội dung và compilation của AutoZone | `RESTRICTED` | Lưu nguồn và URL điều khoản; có thể liên kết ngoài sau kiểm duyệt. Không tự đăng nhập, crawl, sao chép, lưu file hoặc chuyển đổi. |
| Toyota Technical Information System (TIS) | Toyota/Lexus → model → năm/platform → engine/option → manual/EWD → hệ thống/trang | Cổng HTML; nội dung tài liệu có thể là PDF/ảnh/đồ họa trong trình xem | Nội dung dành cho người dùng được cấp quyền; tài liệu tải về chỉ dùng cho lợi ích nội bộ, không được sửa đổi/bán/tạo phái sinh | `RESTRICTED` | Metadata link-only do admin nhập và liên kết đến TIS. Không crawl hoặc cache nội dung; chỉ có thể tích hợp file khi có hợp đồng/OEM permission ghi rõ phạm vi. |
| Hyundai Global Service Way (GSW) | Hãng → model → model year → engine/trim → workshop manual/EWD → electrical system | Cổng HTML; tài liệu/trình xem định dạng do dịch vụ quyết định | Điều khoản GSW xác định nội dung là tài sản trí tuệ Hyundai và cấm sao chép, phân phối, công bố hoặc cung cấp cho bên thứ ba nếu không có chấp thuận | `RESTRICTED` | Chỉ link-out đến nguồn gốc cho người đã có quyền. Không lưu, OCR, render lại hay phân phối nội dung. |
| Admin upload có giấy phép | Toàn bộ taxonomy EWD của ứng dụng | PDF, SVG, PNG/JPG, HTML snapshot đã được cấp quyền | Admin đính kèm giấy phép, phạm vi lưu trữ/tái phân phối và provenance | `APPROVED` khi hồ sơ được duyệt | Có thể upload private storage, tạo preview, text extraction/OCR, index và hiển thị trong app. |
| OEM/đối tác có thỏa thuận | Theo catalog hoặc API được thỏa thuận | Theo hợp đồng/API | Phải có văn bản cho phép, phạm vi URL/domain và quyền lưu trữ/tái phân phối rõ ràng | `REVIEW_REQUIRED` → `APPROVED` | Chỉ bật ingestion allowlist sau khi admin ghi nhận quyền và phê duyệt. |

## Quy tắc định dạng và quyền

Mỗi artifact được gán một `format`: `pdf`, `svg`, `image`, `html`, hoặc `external_link`. Đây là mô tả kỹ thuật của bản được phép truy cập, không phải suy đoán rằng nguồn có thể tải về. `external_link` luôn có `display_mode=link_only`; không tạo preview, OCR, proxy hay cache.

Các loại sơ đồ EWD dùng chung taxonomy gồm: wiring schematic, system circuit, power distribution, fuse/relay, ECU pinout, connector view, ground location, splice/junction, component location, wire-color legend và DTC diagnostic flow. Đường phân loại là:

`manufacturer → model → generation/platform → variant → engine/powertrain → year range → electrical system → diagram type → artifact/page`.

Electrical system gồm power distribution, starting/charging, engine control, transmission, body control, lighting, HVAC, chassis/ABS, SRS, network CAN/LIN, audio/telematics và hybrid/EV high-voltage. Trường không có chứng cứ phải để rỗng và chờ admin xác nhận.

## Căn cứ kiểm tra

- [Toyota TIS legal notice](https://techinfo.toyota.com/techInfoPortal/appmanager/t3/ti?_nfpb=true&_pageLabel=ti_legal) và [subscription FAQ](https://techinfo.toyota.com/techInfoPortal/appmanager/t3/ti?_nfpb=true&_pageLabel=ti_faq) nêu giới hạn người dùng được ủy quyền và sử dụng nội bộ.
- [Hyundai GSW user policy](https://gsw.hyundai.com/common/policyPop.action?kind=user) nêu quyền sở hữu nội dung và giới hạn sao chép/phân phối.
- [AutoZone terms and conditions](https://www.autozone.com/lp/termsAndConditions?intcmp=yext_footer_termsconditions&spps.s=4246) và [Repair Help](https://www.autozone.com/lp/repair-help?intcmp=Homepage:US:RepairHelp:CTA:RepairHelp) mô tả phạm vi dịch vụ và nội dung được bảo hộ.

Không có APK, tài khoản cấp quyền hay gói phần mềm nào được phân tích bằng REA trong đánh giá này. REA chỉ được dùng nếu chủ sở hữu cung cấp artifact cùng quyền phân tích rõ ràng; tuyệt đối không dùng để vượt qua xác thực, DRM, certificate pinning hoặc hạn chế thuê bao.
