import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';
import { GeminiVisionProvider, VisionProviderError, assertRequestIntegrity, parseImageDataUrl, validateRecognition, verifyImageIntegrity } from '../lib/vision-providers.mjs';

const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL2cQAAAABJRU5ErkJggg==';
const image = `data:image/png;base64,${png}`;

test('accepts an intact supported image', () => {
  const result = parseImageDataUrl(image);
  assert.equal(result.mimeType, 'image/png');
  assert.equal(result.bytes.length > 0, true);
  assert.deepEqual(result.dimensions, { width: 1, height: 1 });
});

test('removes unevidenced and non-automotive identity fields', () => {
  const result = validateRecognition({ status: 'success', parts: [{ id: 'x', name_vi: 'Chuột máy tính', name_en: 'Computer Mouse', name_zh: '电脑鼠标', category: 'electronics', brand: 'UGREEN', model: 'MU006', oem_code: '85212-0D080', part_number: '85212-0D080', technical_specs: [], visible_text: [], evidence: [], box_2d: null, requires_verification: true, verification_questions: [], search_keywords: { vi: ['chuột máy tính'], en: ['computer mouse'], zh: ['电脑鼠标'] } }] });
  assert.equal(result.parts[0].name_en, 'Computer Mouse');
  assert.equal(result.parts[0].brand, null);
  assert.equal(result.parts[0].oem_code, null);
});

test('rejects an integrity hash that does not describe the supplied image', () => {
  assert.throws(() => verifyImageIntegrity(image, {
    scan_id: '11111111-1111-4111-8111-111111111111',
    request_id: '22222222-2222-4222-8222-222222222222',
    image_sha256: '0'.repeat(64),
    image_width: 1,
    image_height: 1,
    image_mime_type: 'image/png',
    capture_timestamp: '2026-10-24T00:00:00.000Z',
  }), VisionProviderError);
});

test('requires the request id to match the image integrity envelope', () => {
  assert.throws(() => assertRequestIntegrity('11111111-1111-4111-8111-111111111111', { request_id: '22222222-2222-4222-8222-222222222222' }), VisionProviderError);
});

test('runs general detection before category enrichment without inventing vehicle fitment', async () => {
  const parsed = parseImageDataUrl(image);
  const integrity = {
    scan_id: '11111111-1111-4111-8111-111111111111', request_id: '22222222-2222-4222-8222-222222222222',
    image_sha256: crypto.createHash('sha256').update(parsed.bytes).digest('hex'), image_width: 1, image_height: 1,
    image_mime_type: 'image/png', capture_timestamp: '2026-10-24T00:00:00.000Z',
  };
  const responses = [
    { output_text: JSON.stringify({ status: 'success', primary_object: { id: 'x', name_vi: 'Cảm biến ABS', name_en: 'ABS sensor', name_zh: null, category: 'automotive_part', brand: null, model: null, evidence: ['Thân cảm biến và giắc điện nhìn thấy'], box_2d: [100, 200, 700, 800], requires_verification: true, verification_questions: ['Xác nhận đời xe'] }, detected_objects: [], automotive_related: true }) },
    { output_text: JSON.stringify({ status: 'success', parts: [{ id: 'x', name_vi: 'Cảm biến ABS', name_en: 'ABS sensor', name_zh: null, category: 'automotive_part', brand: null, model: null, oem_code: null, part_number: null, technical_specs: ['Giắc điện 2 chân'], visible_text: [], evidence: ['Thân cảm biến và giắc điện nhìn thấy'], box_2d: [100, 200, 700, 800], requires_verification: true, verification_questions: ['Xác nhận đời xe'], search_keywords: { vi: ['cảm biến ABS'], en: ['ABS sensor'], zh: [] } }] }) },
  ];
  const before = process.env.AI_FREE_TIER_ONLY; process.env.AI_FREE_TIER_ONLY = 'true';
  const provider = new GeminiVisionProvider({ apiKey: 'test-key', client: { interactions: { create: async () => responses.shift() } } });
  const result = await provider.recognize({ image, integrity });
  assert.deepEqual(result.analysis_stages, ['general', 'category']);
  assert.equal(result.parts[0].category, 'automotive_part');
  assert.equal(result.parts[0].oem_code, null);
  if (before === undefined) delete process.env.AI_FREE_TIER_ONLY; else process.env.AI_FREE_TIER_ONLY = before;
});

test('rejects an invalid bounding box rather than rendering it', () => {
  const result = validateRecognition({ status: 'success', parts: [{ id: 'x', name_vi: 'Tai nghe không dây', name_en: 'Wireless earbuds', name_zh: null, category: 'electronics', brand: null, model: null, oem_code: null, part_number: null, technical_specs: [], visible_text: [], evidence: ['Tai nghe và hộp sạc nhìn thấy trong ảnh'], box_2d: [900, 100, 200, 800], requires_verification: true, verification_questions: [], search_keywords: { vi: [], en: [], zh: [] } }] });
  assert.equal(result.parts[0].box_2d, null);
});

test('refuses Gemini when the free-tier lock is absent', () => {
  const before = process.env.AI_FREE_TIER_ONLY;
  delete process.env.AI_FREE_TIER_ONLY;
  assert.throws(() => new GeminiVisionProvider({ apiKey: 'not-used' }), VisionProviderError);
  if (before) process.env.AI_FREE_TIER_ONLY = before;
});
