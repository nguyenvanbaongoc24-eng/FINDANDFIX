# ĐẶC TẢ CAMERA SCANNER & TRẢI NGHIỆM MOBILE UX
## Phân hệ Quét Phụ Tùng cho Ứng Dụng Find And Fix (Auto Repair Documents)
*Ngày ban hành: 2026-10-23 — Phiên bản: 1.0.0*

---

## 1. MỤC TIÊU & NGUYÊN TẮC THIẾT KẾ

### 1.1. Thao tác một tay trong môi trường gara (One-Handed Ergonomics)
- Kỹ thuật viên ô tô thường làm việc trong xưởng với tay dính dầu mỡ, một tay cầm phụ tùng hoặc đèn pin, chỉ còn một tay để thao tác trên điện thoại.
- Toàn bộ nút hành động trọng yếu (nút chụp ảnh, đổi camera, bật flash, duyệt kết quả, nút markup 30%) được bố trí ở **nửa dưới màn hình (Thumb Zone)**, dễ dàng chạm tới bằng ngón cái mà không cần với tay.

### 1.2. Thẩm mỹ chuẩn iOS SaaS Hiện Đại
- Giao diện tối giản, thanh lịch, nền tối tương phản cao cho kính ngắm camera kết hợp tone vàng cát/amber sang trọng (`#e6a940`, `#101b22`, `#f5f6f4`).
- Không dùng hiệu ứng gradient nhựa lòe loẹt hoặc bóng đổ cồng kềnh; sử dụng viền tinh xảo (1px border), border-radius bo tròn chuẩn iOS (`16px - 24px`), Safe Area Padding cho iPhone có notch/Dynamic Island.
- Hỗ trợ đầy đủ Skeleton Loading, Empty States, Error States và hiệu ứng chuyển cảnh mượt mà 60fps.

---

## 2. KIẾN TRÚC KỸ THUẬT CAMERA WEB & PWA

```
+-----------------------------------------------------------------------------------+
|                        LUỒNG XỬ LÝ ẢNH TRÊN THIẾT BỊ DI ĐỘNG                      |
|                                                                                   |
|  [Khởi động Camera] ──► Kiểm tra navigator.mediaDevices.getUserMedia             |
|                                │                                                  |
|                   ┌────────────┴────────────┐                                     |
|                   ▼                         ▼                                     |
|           [Hỗ trợ MediaStream]       [Không hỗ trợ / Từ chối]                    |
|           - facingMode: environment  - Fallback input file:                       |
|           - 1080p / 720p stream        <input type="file"                         |
|           - Torch/Flash capability            accept="image/*"                    |
|           - Thước ngắm & lưới căn             capture="environment">              |
|                   │                                 │                             |
|                   ▼                                 ▼                             |
|          [Bấm nút Chụp ảnh] ──────────────► [Nạp ảnh vào Canvas]                  |
|                                                     │                             |
|                                                     ▼                             |
|                                      [Kiểm tra độ mờ (Blur Score)]                |
|                                       - Thuật toán Laplacian Edge Variance        |
|                                       - Nếu mờ (< 40 điểm): Cảnh báo chụp lại     |
|                                       - Nếu rõ: Tiếp tục xử lý                    |
|                                                     │                             |
|                                                     ▼                             |
|                                      [Xoay 90° & Cắt ảnh (Crop/Rotate)]           |
|                                       - Canvas transform rotation                 |
|                                       - Bounding box zoom                         |
|                                                     │                             |
|                                                     ▼                             |
|                                      [Nén ảnh & Loại bỏ EXIF]                     |
|                                       - Giới hạn Max Dimension: 1280px            |
|                                       - Format: image/jpeg, quality 0.82          |
|                                       - Stripped GPS / Thiết bị EXIF              |
|                                       - Kích thước xuất xưởng: 200KB - 600KB       |
|                                                     │                             |
|                                                     ▼                             |
|                                      [Truyền sang Pipeline AI Vision]             |
+-----------------------------------------------------------------------------------+
```

---

## 3. CÁC THÀNH PHẦN CHI TIẾT

### 3.1. Truy cập Camera Sau (`facingMode: "environment"`)
Cấu hình yêu cầu stream tối ưu cho iPhone Safari và Android Chrome:
```javascript
const constraints = {
  audio: false,
  video: {
    facingMode: { ideal: "environment" },
    width: { ideal: 1920, max: 2560 },
    height: { ideal: 1080, max: 1440 }
  }
};
```
- Khởi chạy qua HTTPS hoặc `localhost` (bắt buộc theo tiêu chuẩn bảo mật W3C WebRTC).
- Xử lý mượt mà khi người dùng đổi ứng dụng hoặc khóa màn hình bằng cách giải phóng stream (`track.stop()`) khi đóng camera.

### 3.2. Bật / Tắt Đèn Flash (Torch Control)
- Sử dụng ImageCapture API hoặc MediaStreamTrack constraints:
```javascript
async function toggleTorch(track, enable) {
  const capabilities = track.getCapabilities?.() || {};
  if (capabilities.torch) {
    await track.applyConstraints({
      advanced: [{ torch: enable }]
    });
  }
}
```
- Nút Flash hiển thị trạng thái thực tế: nếu thiết bị không có phần cứng flash hoặc trình duyệt không hỗ trợ, nút sẽ ẩn đi hoặc hiển thị ghi chú nhẹ nhàng thay vì tạo nút giả.

### 3.3. Thuật toán phát hiện ảnh mờ (Blur Detection)
- Kỹ thuật: Trích xuất ma trận điểm ảnh xám trên Canvas (Grayscale Pixel Buffer) và tính toán độ phân tán của độ dốc tương phản (Laplacian/Sobel Variance).
- **Công thức**:
  $$Score = \frac{1}{N} \sum (\Delta I - \mu)^2$$
- Nếu điểm sắc nét `< 35`: Hiển thị cảnh báo trực quan: *"Ảnh có dấu hiệu bị mờ hoặc rung tay — Bạn nên chụp lại để AI nhận diện mã phụ tùng chính xác hơn"*.

### 3.4. Xoay ảnh, Cắt ảnh và Chọn vùng đối tượng (Crop & Manual Selection)
- Cho phép xoay ảnh từng nấc 90 độ theo chiều kim đồng hồ để đọc đúng chiều các tem phụ tùng dán dọc.
- Hỗ trợ 2 chế độ chọn đối tượng:
  1. **Tự động**: AI phát hiện các đối tượng và phủ bounding boxes màu sắc nổi bật (xanh ngọc, vàng, cam).
  2. **Thủ công (Manual Box Selector)**: Người dùng có thể kéo thả khung chữ nhật trên màn hình để khoanh vùng chính xác chi tiết muốn tra cứu (ví dụ: chỉ khoanh riêng cụm chân giắc hoặc tem nhãn dập mã).

### 3.5. Nén ảnh & Quyền riêng tư (Privacy & Optimization)
- Ảnh từ camera điện thoại hiện đại (48MP - 200MP) có dung lượng từ 5MB đến 15MB, gây chậm mạng 4G/5G và tốn phí server.
- Hệ thống tự động downscale ảnh về độ phân giải chuẩn `1280px` (chiều lớn nhất), mã hóa JPEG chất lượng 82%.
- Quá trình vẽ qua Canvas tự động xóa toàn bộ thẻ EXIF nhạy cảm (kinh độ, vĩ độ GPS, tên máy điện thoại).
- Dung lượng cuối cùng giảm 95% (chỉ còn khoảng 250KB - 500KB), sẵn sàng cho AI nhận diện và tra cứu trong vòng chưa tới 1 giây.

---

## 4. BẢNG TRẠNG THÁI GIAO DIỆN (UI STATES)

| Trạng thái | Biểu hiện giao diện | Hành động khả dụng của người dùng |
|---|---|---|
| **Sẵn sàng chụp (Idle/Streaming)** | Khung hình trực tiếp, lưới căn tâm 3x3, nút Flash, nút đổi camera, nút Shutter nổi bật. | Bấm chụp, bật flash, chọn ảnh từ máy, thoát. |
| **Đang nạp / Xin quyền (Requesting)** | Spinner nhẹ màu vàng, dòng chữ "Đang mở camera sau…". | Hủy hoặc chờ cấp quyền trình duyệt. |
| **Quyền bị từ chối (Denied Fallback)** | Thông báo thân thiện: "Không có quyền camera trực tiếp", nút chuyển sang "Chọn ảnh từ máy". | Bấm chọn tệp ảnh chụp hoặc mở Cài đặt trình duyệt. |
| **Kiểm tra ảnh (Review Mode)** | Ảnh tĩnh hiển thị toàn màn hình kèm điểm sắc nét. Nút: Chụp lại / Xoay / Cắt ảnh / Tiếp tục. | Bấm Chụp lại nếu chưa ưng ý, bấm Tiếp tục để quét AI. |
| **Đang quét AI (Analyzing)** | Hiệu ứng tia quét laser chạy dọc ảnh, Skeleton Loading các trường dữ liệu. | Chờ 1–2 giây, có thể bấm Hủy. |
| **Hiển thị Bounding Box** | Ảnh phủ các khung chữ nhật có nhãn phụ tùng. Nhấn vào khung nào thì khung đó sáng lên. | Chạm vào linh kiện muốn tra giá, hoặc bật chế độ tự chọn vùng. |
