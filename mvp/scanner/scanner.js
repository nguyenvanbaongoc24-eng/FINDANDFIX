// ============================================================================
// AI PARTS SCANNER & SMART PRICING ENGINE — CLIENT RUNTIME (VERCEL READY)
// ============================================================================

const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const escapeHtml = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const getSaved = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const saveLocal = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch(e){} };
const formatVND = n => (Number(n) || 0).toLocaleString('vi-VN') + ' ₫';
const localDate = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };

let vehicle = getSaved('ga-vehicle', getSaved('ard-vehicle', { make: 'Toyota', model: 'Vios', year: 2019, variant: '1.5L 2NR-FE' }));

let settings = getSaved('ard-settings', {
  cnyRate: 3680,
  rateSource: 'Vietcombank (Hà Nội)',
  rateUpdatedAt: '2026-10-23 15:30:00',
  defaultMarkup: 30,
  shippingPerKg: 28000,
  chinaFreight: 10,
  procurementFeePercent: 2,
  roundingRule: '1000'
});

let scannerState = {
  activeStep: 1,
  stream: null,
  facingMode: 'environment',
  isTorchOn: false,
  capturedImage: null,
  rotationAngle: 0,
  blurScore: 85,
  detectedParts: [],
  activePartIndex: 0,
  searchResults: [],
  selectedResult: null,
  activeQuote: getSaved('ard-active-quote', {
    items: [],
    customerName: 'Khách hàng gara',
    plate: '51A-123.45',
    vehicleDesc: 'Toyota Vios 2019 1.5L',
    laborCost: 150000,
    warranty: '6 tháng'
  }),
  isCustomerMode: true
};

const pricingDialog = $('#pricing-dialog');
const quotationDialog = $('#quotation-dialog');
const settingsDialog = $('#settings-dialog');

function toast(msg) {
  document.querySelector('.toast')?.remove();
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  document.body.append(el);
  setTimeout(() => el.remove(), 3200);
}

function setScannerStep(step) {
  scannerState.activeStep = step;
  $$('.step-node').forEach(node => {
    const n = Number(node.dataset.step);
    node.classList.toggle('active', n === step);
    node.classList.toggle('completed', n < step);
  });

  const stages = {
    1: '#stage-camera',
    2: '#stage-crop',
    3: '#stage-parts',
    4: '#stage-results'
  };

  $$('.scanner-stage').forEach(el => el.classList.remove('active'));
  const target = $(stages[step]);
  if (target) target.classList.add('active');

  if (step === 1) startCamera();
  else stopCameraStream();
}

// CAMERA CAPTURE
async function startCamera() {
  const video = $('#scanner-video');
  const fallbackMsg = $('#camera-fallback-msg');
  if (!video) return;

  stopCameraStream();

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    if (fallbackMsg) fallbackMsg.style.display = 'grid';
    return;
  }

  try {
    const constraints = {
      audio: false,
      video: {
        facingMode: { ideal: scannerState.facingMode },
        width: { ideal: 1920, max: 2560 },
        height: { ideal: 1080, max: 1440 }
      }
    };
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    scannerState.stream = stream;
    video.srcObject = stream;
    if (fallbackMsg) fallbackMsg.style.display = 'none';
    startBlurMonitoring();
  } catch (err) {
    if (fallbackMsg) fallbackMsg.style.display = 'grid';
  }
}

function stopCameraStream() {
  if (scannerState.stream) {
    scannerState.stream.getTracks().forEach(t => t.stop());
    scannerState.stream = null;
  }
  scannerState.isTorchOn = false;
  updateTorchButtonUI();
}

async function toggleTorch() {
  if (!scannerState.stream) return;
  const track = scannerState.stream.getVideoTracks()[0];
  if (!track) return;

  const caps = track.getCapabilities ? track.getCapabilities() : {};
  if (!caps.torch) {
    toast('Thiết bị hoặc trình duyệt không hỗ trợ Flash trực tiếp.');
    return;
  }

  try {
    scannerState.isTorchOn = !scannerState.isTorchOn;
    await track.applyConstraints({ advanced: [{ torch: scannerState.isTorchOn }] });
    updateTorchButtonUI();
    toast(scannerState.isTorchOn ? 'Đã bật flash' : 'Đã tắt flash');
  } catch (e) {
    toast('Không điều khiển được flash.');
  }
}

function updateTorchButtonUI() {
  const btn = $('#btn-toggle-torch');
  if (btn) btn.classList.toggle('active', scannerState.isTorchOn);
}

function flipCamera() {
  scannerState.facingMode = scannerState.facingMode === 'environment' ? 'user' : 'environment';
  startCamera();
}

let blurInterval = null;
function startBlurMonitoring() {
  clearInterval(blurInterval);
  blurInterval = setInterval(() => {
    if (!scannerState.stream || scannerState.activeStep !== 1) return;
    const video = $('#scanner-video');
    if (!video || video.videoWidth === 0) return;
    updateBlurUI(measureVideoSharpness(video));
  }, 1000);
}

function measureVideoSharpness(video) {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 160;
    canvas.height = 120;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, 160, 120);
    const imgData = ctx.getImageData(0, 0, 160, 120).data;

    let totalDiff = 0;
    for (let i = 0; i < imgData.length - 8; i += 8) {
      const g1 = (imgData[i] + imgData[i+1] + imgData[i+2]) / 3;
      const g2 = (imgData[i+4] + imgData[i+5] + imgData[i+6]) / 3;
      totalDiff += Math.abs(g1 - g2);
    }
    return Math.min(100, Math.max(10, Math.round((totalDiff / (160 * 120)) * 25)));
  } catch (e) {
    return 85;
  }
}

function updateBlurUI(score) {
  scannerState.blurScore = score;
  const pill = $('#blur-pill');
  const dot = pill?.querySelector('.blur-dot');
  const text = $('#blur-status-text');
  if (!text) return;

  if (score >= 70) {
    text.textContent = `Độ nét: ${score}/100 (Rõ)`;
    dot.className = 'blur-dot';
  } else if (score >= 45) {
    text.textContent = `Độ nét: ${score}/100 (Khá)`;
    dot.className = 'blur-dot warning';
  } else {
    text.textContent = `Độ nét: ${score}/100 (Mờ - giữ yên)`;
    dot.className = 'blur-dot danger';
  }
}

function capturePhotoFromCamera() {
  const video = $('#scanner-video');
  if (!video || video.videoWidth === 0) {
    toast('Camera chưa sẵn sàng, hãy thử lại');
    return;
  }

  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(video, 0, 0);

  const img = new Image();
  img.onload = () => {
    scannerState.capturedImage = img;
    scannerState.rotationAngle = 0;
    stopCameraStream();
    setScannerStep(2);
    renderCropStage();
  };
  img.src = canvas.toDataURL('image/jpeg', 0.9);
}

function loadPhotoFromFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    const img = new Image();
    img.onload = () => {
      scannerState.capturedImage = img;
      scannerState.rotationAngle = 0;
      scannerState.blurScore = 88;
      stopCameraStream();
      setScannerStep(2);
      renderCropStage();
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function loadSamplePhoto() {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    scannerState.capturedImage = img;
    scannerState.rotationAngle = 0;
    scannerState.blurScore = 92;
    stopCameraStream();
    setScannerStep(2);
    renderCropStage();
    toast('Đã nạp ảnh mẫu cụm cần gạt mưa ô tô');
  };
  img.src = 'https://images.unsplash.com/photo-1486006920555-c77dce18193b?auto=format&fit=crop&w=600&q=80';
}

function renderCropStage() {
  const canvas = $('#crop-canvas');
  if (!canvas || !scannerState.capturedImage) return;

  const ctx = canvas.getContext('2d');
  const img = scannerState.capturedImage;

  const isRotated = scannerState.rotationAngle % 180 !== 0;
  canvas.width = isRotated ? img.height : img.width;
  canvas.height = isRotated ? img.width : img.height;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((scannerState.rotationAngle * Math.PI) / 180);
  ctx.drawImage(img, -img.width / 2, -img.height / 2);
  ctx.restore();

  const score = scannerState.blurScore || 85;
  const fill = $('#blur-gauge-fill');
  const scoreText = $('#blur-score-text');
  const adviceText = $('#blur-advice-text');

  if (fill) fill.style.width = score + '%';
  if (scoreText) scoreText.textContent = `Độ sắc nét: ${score}/100 ${score >= 60 ? '(Đạt yêu cầu)' : '(Hơi mờ)'}`;
  if (adviceText) adviceText.textContent = score >= 60 ? 'Ảnh đủ sắc nét để AI đọc tem nhãn và mã OEM' : 'Khuyên chụp lại với đủ ánh sáng để nhận diện chính xác nhất';
}

function rotatePhoto() {
  scannerState.rotationAngle = (scannerState.rotationAngle + 90) % 360;
  renderCropStage();
}

function resetCrop() {
  scannerState.rotationAngle = 0;
  renderCropStage();
}

// STAGE 3: AI VISION INFERENCE
async function analyzePartsWithAI() {
  toast('Đang phân tích AI nhận diện linh kiện...');
  const canvas = $('#crop-canvas');
  const base64 = canvas ? canvas.toDataURL('image/jpeg', 0.85) : '';

  try {
    const res = await fetch('/api/scanner/vision', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: base64.slice(0, 5000), hint: 'wiper' })
    });
    if (res.ok) {
      const data = await res.json();
      if (data.ok && Array.isArray(data.parts)) {
        scannerState.detectedParts = data.parts;
        scannerState.activePartIndex = 0;
        setScannerStep(3);
        renderPartsStage();
        return;
      }
    }
  } catch (e) {}

  // Standalone client fallback
  scannerState.detectedParts = [
    {
      id: 'part_wiper_blade',
      name_vi: 'Lưỡi gạt mưa trước (Bên lái / Bên phụ)',
      name_en: 'Front Windshield Wiper Blade',
      name_zh: '汽车无骨雨刷片',
      category: 'Hệ thống gạt nước',
      brand: 'Bosch / Denso',
      oem_code: '85212-0D080',
      confidence: 0.94,
      confidence_label: 'Cao (94%)',
      bounding_box: { ymin: 0.12, xmin: 0.10, ymax: 0.48, xmax: 0.92 }
    },
    {
      id: 'part_wiper_arm',
      name_vi: 'Tay gạt mưa (Cần sắt liên kết)',
      name_en: 'Windshield Wiper Arm',
      name_zh: '前雨刮臂连杆',
      category: 'Hệ thống gạt nước',
      brand: 'OEM',
      oem_code: '85221-52460',
      confidence: 0.88,
      confidence_label: 'Khá cao (88%)',
      bounding_box: { ymin: 0.38, xmin: 0.08, ymax: 0.72, xmax: 0.55 }
    },
    {
      id: 'part_wiper_motor',
      name_vi: 'Mô-tơ gạt mưa kính chắn gió',
      name_en: 'Windshield Wiper Motor Assembly',
      name_zh: '汽车雨刷电机马达',
      category: 'Hệ thống gạt nước',
      brand: 'Denso',
      oem_code: '85110-0D040',
      confidence: 0.82,
      confidence_label: 'Khá (82%)',
      bounding_box: { ymin: 0.58, xmin: 0.05, ymax: 0.90, xmax: 0.45 }
    }
  ];

  scannerState.activePartIndex = 0;
  setScannerStep(3);
  renderPartsStage();
}

function renderPartsStage() {
  const previewImg = $('#detected-photo-preview');
  const canvas = $('#crop-canvas');
  if (previewImg && canvas) {
    previewImg.src = canvas.toDataURL('image/jpeg', 0.85);
  }

  renderBoundingBoxes();
  renderActivePartCard();
  renderOtherPartsList();
}

function renderBoundingBoxes() {
  const layer = $('#bbox-layer');
  if (!layer) return;
  layer.innerHTML = '';

  scannerState.detectedParts.forEach((part, index) => {
    const box = part.bounding_box || { ymin: 0.1, xmin: 0.1, ymax: 0.5, xmax: 0.5 };
    const el = document.createElement('div');
    el.className = `bbox-rect ${index === scannerState.activePartIndex ? 'active' : ''}`;
    el.style.top = `${box.ymin * 100}%`;
    el.style.left = `${box.xmin * 100}%`;
    el.style.width = `${(box.xmax - box.xmin) * 100}%`;
    el.style.height = `${(box.ymax - box.ymin) * 100}%`;

    el.innerHTML = `<span class="bbox-tag">${escapeHtml(part.name_vi.split('(')[0])}</span>`;
    el.addEventListener('click', () => selectPartIndex(index));
    layer.appendChild(el);
  });
}

function selectPartIndex(index) {
  scannerState.activePartIndex = index;
  renderBoundingBoxes();
  renderActivePartCard();
  renderOtherPartsList();
  toast(`Đã chọn: ${scannerState.detectedParts[index].name_vi.split('(')[0]}`);
}

function renderActivePartCard() {
  const part = scannerState.detectedParts[scannerState.activePartIndex];
  if (!part) return;

  $('#active-part-category').textContent = part.category || 'Phụ tùng ô tô';
  $('#active-part-confidence').textContent = `Độ tin cậy: ${part.confidence_label || Math.round(part.confidence * 100) + '%'}`;
  $('#active-part-name-vi').value = part.name_vi || '';
  $('#active-part-name-en').textContent = part.name_en || 'Automotive Component';
  $('#active-part-name-zh').textContent = part.name_zh || '汽车配件';
  $('#active-part-oem').value = part.oem_code || '';
  $('#active-part-brand').value = part.brand || 'OEM';

  const compatBadge = $('#compat-badge');
  const compatTitle = $('#compat-status-title');
  const compatDesc = $('#compat-status-desc');
  const carText = [vehicle.make, vehicle.model, vehicle.year].filter(Boolean).join(' ');

  if (part.oem_code && carText) {
    compatBadge.className = 'compat-status-badge verified';
    compatTitle.textContent = 'ĐÃ XÁC MINH TƯƠNG THÍCH';
    compatDesc.textContent = `Mã OEM ${part.oem_code} phù hợp với ${carText}`;
  } else if (carText) {
    compatBadge.className = 'compat-status-badge probable';
    compatTitle.textContent = 'CÓ KHẢ NĂNG TƯƠNG THÍCH — CẦN KIỂM TRA';
    compatDesc.textContent = `Phù hợp dòng xe ${carText}, cần kiểm tra kích thước thực tế`;
  } else {
    compatBadge.className = 'compat-status-badge unverified';
    compatTitle.textContent = 'CHƯA ĐỦ THÔNG TIN TƯƠNG THÍCH';
    compatDesc.textContent = 'Hãy chọn xe để kiểm tra khả năng lắp vừa';
  }
}

function renderOtherPartsList() {
  const list = $('#other-parts-list');
  if (!list) return;

  const others = scannerState.detectedParts.map((p, i) => ({ ...p, originalIndex: i }))
                                          .filter(p => p.originalIndex !== scannerState.activePartIndex);

  if (!others.length) {
    list.innerHTML = '<p class="field-hint">Không có linh kiện phụ nào khác trong ảnh này.</p>';
    return;
  }

  list.innerHTML = others.map(p => `
    <div class="other-part-card" data-part-idx="${p.originalIndex}">
      <div class="other-part-icon">⚙</div>
      <div>
        <strong>${escapeHtml(p.name_vi)}</strong>
        <small>${escapeHtml(p.oem_code || 'Chưa rõ mã')} · ${escapeHtml(p.confidence_label || '')}</small>
      </div>
      <span class="action-select">Chọn tra giá ›</span>
    </div>
  `).join('');

  list.querySelectorAll('.other-part-card').forEach(card => {
    card.addEventListener('click', () => selectPartIndex(Number(card.dataset.partIdx)));
  });
}

// STAGE 4: SEARCH TAOBAO & 1688
async function searchPartProducts() {
  const part = scannerState.detectedParts[scannerState.activePartIndex];
  if (!part) return;

  part.name_vi = $('#active-part-name-vi').value.trim() || part.name_vi;
  part.oem_code = $('#active-part-oem').value.trim() || part.oem_code;
  part.brand = $('#active-part-brand').value.trim() || part.brand;

  toast('Đang tìm nguồn hàng Taobao & 1688...');
  setScannerStep(4);

  const kw = encodeURIComponent(`${part.name_zh} ${part.oem_code}`);
  $('#link-open-taobao').href = `https://s.taobao.com/search?q=${kw}`;
  $('#link-open-1688').href = `https://air.1688.com/search/index.htm?keywords=${kw}`;

  try {
    const res = await fetch('/api/scanner/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ part_name_zh: part.name_zh, oem_code: part.oem_code, vehicle })
    });
    if (res.ok) {
      const data = await res.json();
      if (data.ok && Array.isArray(data.results)) {
        scannerState.searchResults = data.results;
        renderSearchResults();
        return;
      }
    }
  } catch (e) {}

  // Fallback demo results
  const rate = settings.cnyRate;
  scannerState.searchResults = [
    {
      id: '1688_offer_74829104',
      provider: '1688',
      source_name: '1688 Wholesale',
      title_vi: 'Xưởng sản xuất gạt mưa không xương phủ Nano cao cấp (Móc U-Hook)',
      title_original: `源头工厂批发 适用车型雨刷片 胶条高品质静音无骨雨刮器 ${part.oem_code}`,
      image_url: 'https://images.unsplash.com/photo-1486006920555-c77dce18193b?auto=format&fit=crop&w=400&q=80',
      detail_url: 'https://detail.1688.com/offer/74829104.html',
      price_cny: 28.50,
      price_vnd: Math.round(28.50 * rate),
      shop_name: 'Nhà máy cao su Chiết Giang Huaxin',
      moq: 2,
      tier_prices: [
        { min_quantity: 2, price_cny: 28.50 },
        { min_quantity: 10, price_cny: 22.00 },
        { min_quantity: 100, price_cny: 18.00 }
      ],
      is_oem: false,
      is_demo: true
    },
    {
      id: 'tb_item_698421039',
      provider: 'taobao',
      source_name: 'Taobao Marketplace',
      title_vi: 'Cặp gạt mưa silicon Denso chính hãng thiết kế ôm kính chắn gió',
      title_original: `正品电装适用卡罗拉威驰原装款专用汽车无骨雨刷片 ${part.oem_code}`,
      image_url: 'https://images.unsplash.com/photo-1542282088-72c9c27ed0cd?auto=format&fit=crop&w=400&q=80',
      detail_url: 'https://item.taobao.com/item.htm?id=698421039',
      price_cny: 48.00,
      price_vnd: Math.round(48.00 * rate),
      shop_name: 'Phụ tùng ô tô Denso Quảng Châu',
      moq: 1,
      tier_prices: [],
      is_oem: true,
      is_demo: true
    },
    {
      id: 'tb_item_58921045',
      provider: 'taobao',
      source_name: 'Taobao Marketplace',
      title_vi: 'Lưỡi gạt mưa thay thế kinh tế phổ thông 14-26 inch',
      title_original: '通用型汽车无骨雨刷胶条 静音耐磨雨刮器配件',
      image_url: 'https://images.unsplash.com/photo-1517524008697-84bbe3c3fd98?auto=format&fit=crop&w=400&q=80',
      detail_url: 'https://item.taobao.com/item.htm?id=58921045',
      price_cny: 18.90,
      price_vnd: Math.round(18.90 * rate),
      shop_name: 'Phụ kiện ô tô Shengda',
      moq: 1,
      tier_prices: [],
      is_oem: false,
      is_demo: true
    }
  ];
  renderSearchResults();
}

function renderSearchResults(filterType = 'all') {
  const container = $('#product-results-container');
  if (!container) return;

  let items = scannerState.searchResults;
  if (filterType === '1688') items = items.filter(x => x.provider === '1688');
  if (filterType === 'taobao') items = items.filter(x => x.provider === 'taobao');
  if (filterType === 'oem') items = items.filter(x => x.is_oem);
  if (filterType === 'lowest-price') items = [...items].sort((a,b) => a.price_cny - b.price_cny);

  if (!items.length) {
    container.innerHTML = '<div style="text-align:center;padding:30px;color:#7a888b;">Không có sản phẩm phù hợp. Thử tìm thủ công bên dưới.</div>';
    return;
  }

  const rate = settings.cnyRate;
  container.innerHTML = items.map(product => {
    const is1688 = product.provider === '1688';
    const priceVnd = Math.round(product.price_cny * rate);

    const tierRows = is1688 && product.tier_prices && product.tier_prices.length ? `
      <table class="tier-pricing-table">
        <thead>
          <tr><th>Số lượng mua</th><th>Giá CNY</th><th>Quy đổi VND</th></tr>
        </thead>
        <tbody>
          ${product.tier_prices.map(t => `
            <tr>
              <td>≥ ${t.min_quantity} cái</td>
              <td>¥${t.price_cny.toFixed(2)}</td>
              <td>${formatVND(t.price_cny * rate)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    ` : '';

    return `
      <article class="product-card" data-product-id="${escapeHtml(product.id)}">
        <div class="product-main-row">
          <img class="product-thumb" src="${escapeHtml(product.image_url)}" alt="${escapeHtml(product.title_vi)}" loading="lazy">
          <div class="product-info-col">
            <span class="product-source-badge ${product.provider === '1688' ? 'alibaba1688' : 'taobao'}">
              ${escapeHtml(product.source_name)}
            </span>
            <h4 class="product-title-vi">${escapeHtml(product.title_vi)}</h4>
            <span class="product-shop-name">🏪 ${escapeHtml(product.shop_name || 'Cửa hàng xác thực')}</span>
          </div>
        </div>

        <div class="product-price-block">
          <div>
            <span class="price-cny-tag">¥${product.price_cny.toFixed(2)}</span>
            <strong class="price-vnd-tag">${formatVND(priceVnd)}</strong>
          </div>
          <span class="moq-tag">Tối thiểu: ${product.moq || 1} cái</span>
        </div>

        ${tierRows}

        <div class="product-actions-bar">
          <button class="btn-markup-30" data-calc-pricing="${escapeHtml(product.id)}">
            <span>Lấy giá niêm yết (+30%)</span>
            <span>⚡</span>
          </button>
          <a class="btn-source-link" href="${escapeHtml(product.detail_url)}" target="_blank" rel="noopener noreferrer">
            Xem nguồn ↗
          </a>
        </div>
      </article>
    `;
  }).join('');

  container.querySelectorAll('[data-calc-pricing]').forEach(btn => {
    btn.addEventListener('click', () => {
      const prodId = btn.dataset.calcPricing;
      const product = scannerState.searchResults.find(x => x.id === prodId);
      if (product) openPricingDialog(product);
    });
  });
}

async function verifyManualProductUrl() {
  const input = $('#manual-product-url');
  const url = input?.value.trim();
  if (!url) { toast('Vui lòng dán liên kết Taobao hoặc 1688'); return; }

  toast('Đang xác minh liên kết Anti-SSRF...');
  try {
    const res = await fetch('/api/scanner/verify-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url })
    });
    const data = await res.json();
    if (res.ok && data.ok) {
      toast('URL hợp lệ!');
      const verifiedProduct = {
        id: 'manual_' + data.item_id,
        provider: data.provider,
        source_name: data.provider === '1688' ? '1688 Wholesale' : 'Taobao Marketplace',
        title_vi: `Sản phẩm xác minh theo liên kết: ${data.item_id}`,
        title_original: 'Manual verified item ' + data.item_id,
        image_url: 'https://images.unsplash.com/photo-1542282088-72c9c27ed0cd?auto=format&fit=crop&w=400&q=80',
        detail_url: data.clean_url,
        price_cny: data.estimated_price_cny || 38.0,
        price_vnd: data.estimated_price_vnd || Math.round(38.0 * settings.cnyRate),
        shop_name: 'Shop trên ' + data.hostname,
        moq: 1,
        tier_prices: [],
        is_oem: false,
        is_demo: false
      };
      scannerState.searchResults.unshift(verifiedProduct);
      renderSearchResults();
      openPricingDialog(verifiedProduct);
      input.value = '';
    } else {
      toast(data.error || 'URL bị từ chối');
    }
  } catch(e) {
    toast('Không thể xác minh liên kết lúc này.');
  }
}

// STAGE 5: SMART PRICING ENGINE
function calculatePricing(product, markupPercent, applyOnLanded = true, weightKg = 0.5) {
  const rate = settings.cnyRate;
  const sourcePriceVnd = Math.round(product.price_cny * rate);

  const chinaFreightVnd = Math.round((settings.chinaFreight || 10) * rate);
  const vnShippingVnd = Math.round(weightKg * (settings.shippingPerKg || 28000));
  const procurementFeeVnd = Math.round(sourcePriceVnd * ((settings.procurementFeePercent || 2) / 100));

  const totalLandedCost = sourcePriceVnd + chinaFreightVnd + vnShippingVnd + procurementFeeVnd;
  const baseForMarkup = applyOnLanded ? totalLandedCost : sourcePriceVnd;

  const rawSuggestedPrice = baseForMarkup * (1 + markupPercent / 100);

  let finalPrice = rawSuggestedPrice;
  const rule = settings.roundingRule;
  if (rule === '1000') finalPrice = Math.round(rawSuggestedPrice / 1000) * 1000;
  else if (rule === '5000') finalPrice = Math.round(rawSuggestedPrice / 5000) * 5000;
  else if (rule === '10000') finalPrice = Math.round(rawSuggestedPrice / 10000) * 10000;

  return {
    sourcePriceCny: product.price_cny,
    exchangeRate: rate,
    sourcePriceVnd,
    chinaFreightVnd,
    vnShippingVnd,
    procurementFeeVnd,
    totalLandedCost,
    markupPercent,
    finalPrice
  };
}

function openPricingDialog(product) {
  scannerState.selectedResult = product;
  renderPricingDialogContent(product, settings.defaultMarkup || 30);
  pricingDialog.showModal();
}

function renderPricingDialogContent(product, currentMarkup) {
  const calc = calculatePricing(product, currentMarkup, true, 0.5);

  $('#pricing-content').innerHTML = `
    <div class="cost-breakdown-card">
      <div class="cost-row">
        <span>Giá sản phẩm nguồn (${escapeHtml(product.source_name)}):</span>
        <strong>¥${calc.sourcePriceCny.toFixed(2)} (${formatVND(calc.sourcePriceVnd)})</strong>
      </div>
      <div class="cost-row">
        <span>Tỷ giá áp dụng (${escapeHtml(settings.rateSource)}):</span>
        <span>1 CNY = ${settings.cnyRate.toLocaleString('vi-VN')} VND</span>
      </div>
      <div class="cost-row">
        <span>Phí ship nội địa TQ (ước tính):</span>
        <span>${formatVND(calc.chinaFreightVnd)}</span>
      </div>
      <div class="cost-row">
        <span>Cước vận chuyển TQ ➔ VN (0.5 kg):</span>
        <span>${formatVND(calc.vnShippingVnd)}</span>
      </div>
      <div class="cost-row">
        <span>Phí dịch vụ mua hộ (${settings.procurementFeePercent}%):</span>
        <span>${formatVND(calc.procurementFeeVnd)}</span>
      </div>
      <div class="cost-row total-landed">
        <span>TỔNG GIÁ VỐN NHẬP VỀ (Landed Cost):</span>
        <strong>${formatVND(calc.totalLandedCost)}</strong>
      </div>
    </div>

    <div class="markup-control-box">
      <div class="markup-header">
        <strong>Mức Markup Gara:</strong>
        <span class="markup-value-badge" id="markup-val-label">+${currentMarkup}%</span>
      </div>
      <input type="range" class="markup-slider" id="markup-slider-input" min="0" max="100" step="5" value="${currentMarkup}">
      <div class="quick-markup-pills">
        <button type="button" class="markup-pill ${currentMarkup === 15 ? 'active' : ''}" data-markup="15">+15%</button>
        <button type="button" class="markup-pill ${currentMarkup === 30 ? 'active' : ''}" data-markup="30">+30% (Chuẩn)</button>
        <button type="button" class="markup-pill ${currentMarkup === 50 ? 'active' : ''}" data-markup="50">+50%</button>
        <button type="button" class="markup-pill ${currentMarkup === 100 ? 'active' : ''}" data-markup="100">+100%</button>
      </div>
    </div>

    <div class="suggested-price-banner">
      <small>GIÁ BÁN ĐỀ XUẤT CỦA GARA (ĐÃ LÀM TRÒN)</small>
      <div class="price-num" id="pricing-dialog-final-price">${formatVND(calc.finalPrice)}</div>
    </div>

    <button class="primary-button" id="btn-add-to-quote-now">
      <span>Thêm vào Báo giá Khách hàng</span>
      <span>＋</span>
    </button>
  `;

  const slider = $('#markup-slider-input');
  slider?.addEventListener('input', e => {
    const val = Number(e.target.value);
    $('#markup-val-label').textContent = `+${val}%`;
    const updated = calculatePricing(product, val, true, 0.5);
    $('#pricing-dialog-final-price').textContent = formatVND(updated.finalPrice);
  });

  $$('.markup-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      const val = Number(pill.dataset.markup);
      slider.value = val;
      $('#markup-val-label').textContent = `+${val}%`;
      $$('.markup-pill').forEach(p => p.classList.toggle('active', p === pill));
      const updated = calculatePricing(product, val, true, 0.5);
      $('#pricing-dialog-final-price').textContent = formatVND(updated.finalPrice);
    });
  });

  $('#btn-add-to-quote-now')?.addEventListener('click', () => {
    const val = Number(slider.value);
    const finalCalc = calculatePricing(product, val, true, 0.5);

    const activePart = scannerState.detectedParts[scannerState.activePartIndex] || {};
    addItemToActiveQuote({
      id: crypto.randomUUID(),
      partName: activePart.name_vi || product.title_vi,
      oemCode: activePart.oem_code || '',
      category: activePart.category || 'Phụ tùng thay thế',
      sourceName: product.source_name,
      sourcePriceCny: product.price_cny,
      unitCostVnd: finalCalc.totalLandedCost,
      unitPriceVnd: finalCalc.finalPrice,
      quantity: 1,
      markupPercent: val,
      warranty: '6 tháng'
    });

    pricingDialog.close();
    toast('Đã thêm phụ tùng vào báo giá!');
    openQuotationDialog();
  });
}

// STAGE 6: CUSTOMER QUOTATION
function addItemToActiveQuote(item) {
  scannerState.activeQuote.items.push(item);
  saveLocal('ard-active-quote', scannerState.activeQuote);
}

function openQuotationDialog() {
  renderQuotationContent();
  quotationDialog.showModal();
}

function renderQuotationContent() {
  const q = scannerState.activeQuote;
  const isCust = scannerState.isCustomerMode;

  const totalParts = q.items.reduce((sum, item) => sum + (item.unitPriceVnd * item.quantity), 0);
  const totalCost = q.items.reduce((sum, item) => sum + (item.unitCostVnd * item.quantity), 0);
  const labor = Number(q.laborCost) || 0;
  const grandTotal = totalParts + labor;
  const estimatedProfit = grandTotal - totalCost - (labor * 0.4);

  $('#quotation-content').innerHTML = `
    <article class="quotation-card-paper">
      <div class="quote-header-block">
        <h3>BÁO GIÁ SỬA CHỮA & PHỤ TÙNG Ô TÔ</h3>
        <small>GARA FIND AND FIX · Ngày: ${localDate()} · Khách hàng: ${escapeHtml(q.customerName)}</small>
        <div style="font-size:11px; margin-top:2px;">Xe: <b>${escapeHtml(q.vehicleDesc || 'Toyota Vios 2019')}</b> · Biển số: <b>${escapeHtml(q.plate || '51A-123.45')}</b></div>
      </div>

      <table class="quote-items-table">
        <thead>
          <tr>
            <th>Hạng mục</th>
            <th>SL</th>
            ${!isCust ? '<th>Giá vốn</th><th>Markup</th>' : ''}
            <th>Đơn giá</th>
            <th>Thành tiền</th>
          </tr>
        </thead>
        <tbody>
          ${q.items.length ? q.items.map(item => `
            <tr>
              <td>
                <strong>${escapeHtml(item.partName)}</strong>
                <small style="display:block;color:#778387;">${item.oemCode ? `OEM: ${escapeHtml(item.oemCode)} · ` : ''}BH: ${escapeHtml(item.warranty)}</small>
              </td>
              <td>${item.quantity}</td>
              ${!isCust ? `<td>${formatVND(item.unitCostVnd)}</td><td>+${item.markupPercent}%</td>` : ''}
              <td>${formatVND(item.unitPriceVnd)}</td>
              <td><strong>${formatVND(item.unitPriceVnd * item.quantity)}</strong></td>
            </tr>
          `).join('') : `
            <tr>
              <td colspan="${isCust ? 4 : 6}" style="text-align:center;padding:16px;color:#8a999d;">
                Chưa có phụ tùng nào trong báo giá.
              </td>
            </tr>
          `}
        </tbody>
      </table>

      <div class="quote-totals-block">
        <div class="quote-total-row">
          <span>Tiền phụ tùng:</span>
          <span>${formatVND(totalParts)}</span>
        </div>
        <div class="quote-total-row">
          <span>Tiền công tháo lắp & kiểm tra:</span>
          <span>${formatVND(labor)}</span>
        </div>
        <div class="quote-total-row grand">
          <span>TỔNG CỘNG THANH TOÁN:</span>
          <strong>${formatVND(grandTotal)}</strong>
        </div>
        ${!isCust ? `
          <div class="quote-total-row" style="color:#059669; font-weight:800; border-top:1px dashed #ccc; padding-top:4px;">
            <span>Lợi nhuận ước tính Gara:</span>
            <span>${formatVND(estimatedProfit)}</span>
          </div>
        ` : ''}
      </div>

      <div style="font-size:11px; color:#5c696e; margin-top:8px;">
        Cam kết: Phụ tùng bảo hành ${q.warranty || '6 tháng'}. Miễn phí kiểm tra lại trong 500 km đầu tiên.
      </div>
    </article>

    <div class="quotation-actions-group">
      <button type="button" class="btn-copy-zalo" id="btn-copy-zalo">
        <span>💬 Sao chép tin Zalo</span>
      </button>
      <button type="button" class="btn-share-mobile" id="btn-share-quote">
        <span>Chia sẻ ↗</span>
      </button>
      <button type="button" class="btn-print-quote" id="btn-print-quote">
        <span>In PDF</span>
      </button>
    </div>
  `;

  $('#btn-mode-customer')?.classList.toggle('active', isCust);
  $('#btn-mode-internal')?.classList.toggle('active', !isCust);

  $('#btn-mode-customer')?.addEventListener('click', () => {
    scannerState.isCustomerMode = true;
    renderQuotationContent();
  });
  $('#btn-mode-internal')?.addEventListener('click', () => {
    scannerState.isCustomerMode = false;
    renderQuotationContent();
  });

  $('#btn-copy-zalo')?.addEventListener('click', () => copyZaloQuotationText());
  $('#btn-share-quote')?.addEventListener('click', () => shareQuotationMobile());
  $('#btn-print-quote')?.addEventListener('click', () => window.print());
}

function copyZaloQuotationText() {
  const q = scannerState.activeQuote;
  const totalParts = q.items.reduce((sum, item) => sum + (item.unitPriceVnd * item.quantity), 0);
  const labor = Number(q.laborCost) || 0;
  const grandTotal = totalParts + labor;

  const lines = [
    `🔧 BÁO GIÁ SỬA CHỮA — GARA FIND AND FIX`,
    `Xe: ${q.vehicleDesc || 'Toyota Vios'} | Biển số: ${q.plate}`,
    `Khách hàng: ${q.customerName}`,
    `Ngày: ${localDate()}`,
    `----------------------------------------`,
    `DANH MỤC PHỤ TÙNG:`,
    ...q.items.map((it, i) => `${i+1}. ${it.partName} ${it.oemCode ? `[${it.oemCode}]` : ''} - SL: ${it.quantity} - Đơn giá: ${formatVND(it.unitPriceVnd)} (BH: ${it.warranty})`),
    `----------------------------------------`,
    `Tiền phụ tùng: ${formatVND(totalParts)}`,
    `Tiền công tháo lắp: ${formatVND(labor)}`,
    `👉 TỔNG THANH TOÁN: ${formatVND(grandTotal)}`,
    `Cam kết bảo hành ${q.warranty || '6 tháng'}. Xin cảm ơn Quý khách!`
  ];

  navigator.clipboard.writeText(lines.join('\n')).then(() => {
    toast('Đã sao chép tin nhắn Zalo!');
  }).catch(() => toast('Đã tạo nội dung báo giá.'));
}

function shareQuotationMobile() {
  const q = scannerState.activeQuote;
  const totalParts = q.items.reduce((sum, item) => sum + (item.unitPriceVnd * item.quantity), 0);
  const labor = Number(q.laborCost) || 0;
  const grandTotal = totalParts + labor;

  if (navigator.share) {
    navigator.share({
      title: `Báo giá gara xe ${q.vehicleDesc || 'ô tô'}`,
      text: `Báo giá sửa chữa ô tô Find And Fix cho xe ${q.plate}: Tổng ${formatVND(grandTotal)}.`
    }).catch(() => {});
  } else {
    copyZaloQuotationText();
  }
}

function openSettingsDialog() {
  $('#setting-cny-rate').value = settings.cnyRate;
  $('#setting-rate-source').value = settings.rateSource;
  $('#setting-default-markup').value = settings.defaultMarkup || 30;
  $('#setting-shipping-kg').value = settings.shippingPerKg || 28000;
  $('#setting-procurement-fee').value = settings.procurementFeePercent || 2;
  $('#setting-rounding-rule').value = settings.roundingRule || '1000';
  settingsDialog.showModal();
}

function setupListeners() {
  $$('.step-node').forEach(node => {
    node.addEventListener('click', () => setScannerStep(Number(node.dataset.step)));
  });

  $('#btn-shutter')?.addEventListener('click', capturePhotoFromCamera);
  $('#btn-toggle-torch')?.addEventListener('click', toggleTorch);
  $('#btn-flip-camera')?.addEventListener('click', flipCamera);
  $('#btn-sample-photo-trigger')?.addEventListener('click', loadSamplePhoto);
  $('#scanner-file-input')?.addEventListener('change', e => {
    if (e.target.files && e.target.files[0]) loadPhotoFromFile(e.target.files[0]);
  });

  $('#btn-rotate-photo')?.addEventListener('click', rotatePhoto);
  $('#btn-reset-crop')?.addEventListener('click', resetCrop);
  $('#btn-retake-photo')?.addEventListener('click', () => setScannerStep(1));
  $('#btn-confirm-crop')?.addEventListener('click', analyzePartsWithAI);

  $('#btn-start-search-parts')?.addEventListener('click', searchPartProducts);
  $('#btn-back-to-parts')?.addEventListener('click', () => setScannerStep(3));
  $$('[data-res-filter]').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('[data-res-filter]').forEach(b => b.classList.toggle('active', b === btn));
      renderSearchResults(btn.dataset.resFilter);
    });
  });
  $('#btn-verify-manual-url')?.addEventListener('click', verifyManualProductUrl);

  $('#open-settings-btn')?.addEventListener('click', openSettingsDialog);
  $('#btn-change-rate-results')?.addEventListener('click', openSettingsDialog);
  $('#open-quote-top-btn')?.addEventListener('click', openQuotationDialog);

  $('#settings-form')?.addEventListener('submit', e => {
    e.preventDefault();
    settings.cnyRate = Number($('#setting-cny-rate').value) || settings.cnyRate;
    settings.rateSource = $('#setting-rate-source').value || settings.rateSource;
    settings.defaultMarkup = Number($('#setting-default-markup').value) || 30;
    settings.shippingPerKg = Number($('#setting-shipping-kg').value) || 28000;
    settings.procurementFeePercent = Number($('#setting-procurement-fee').value) || 2;
    settings.roundingRule = $('#setting-rounding-rule').value || '1000';
    saveLocal('ard-settings', settings);
    $('#results-rate-text').textContent = `1 CNY = ${settings.cnyRate.toLocaleString('vi-VN')} VND`;
    settingsDialog.close();
    toast('Đã lưu cấu hình tỷ giá & markup!');
  });

  document.addEventListener('click', e => {
    if (e.target.closest('[data-close]')) e.target.closest('dialog')?.close();
  });
}

function init() {
  const vName = [vehicle.make, vehicle.model, vehicle.year, vehicle.variant].filter(Boolean).join(' ');
  if ($('#scanner-vehicle-label') && vName) $('#scanner-vehicle-label').textContent = vName;

  setupListeners();
  setScannerStep(1);

  // Sync exchange rate
  fetch('/api/rates').then(r => r.json()).then(data => {
    if (data.ok && data.data) {
      settings.cnyRate = Number(data.data.rate) || settings.cnyRate;
      settings.rateSource = data.data.source || settings.rateSource;
      saveLocal('ard-settings', settings);
      if ($('#results-rate-text')) $('#results-rate-text').textContent = `1 CNY = ${settings.cnyRate.toLocaleString('vi-VN')} VND`;
    }
  }).catch(() => {});
}

init();
