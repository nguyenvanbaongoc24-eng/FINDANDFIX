import assert from 'node:assert/strict';
import test from 'node:test';
import { GeminiVisionProvider, VisionProviderError, parseImageDataUrl, validateRecognition } from '../lib/vision-providers.mjs';

const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL2cQAAAABJRU5ErkJggg==';
const image = `data:image/png;base64,${png}`;

test('accepts an intact supported image', () => {
  const result = parseImageDataUrl(image);
  assert.equal(result.mimeType, 'image/png');
  assert.equal(result.bytes.length > 0, true);
});

test('removes unevidenced product identity fields', () => {
  const result = validateRecognition({ status: 'success', parts: [{ id: 'x', name_vi: 'Chuột máy tính', name_en: 'Computer Mouse', name_zh: '电脑鼠标', category: 'computer_accessories', brand: 'UGREEN', model: 'MU006', oem_code: '85212-0D080', part_number: '85212-0D080', technical_specs: [], visible_text: [], evidence: [], box_2d: null, requires_verification: true, verification_questions: [], search_keywords: { vi: ['chuột máy tính'], en: ['computer mouse'], zh: ['电脑鼠标'] } }] });
  assert.equal(result.parts[0].name_en, 'Computer Mouse');
  assert.equal(result.parts[0].brand, null);
  assert.equal(result.parts[0].oem_code, null);
});

test('refuses Gemini when the free-tier lock is absent', () => {
  const before = process.env.AI_FREE_TIER_ONLY;
  delete process.env.AI_FREE_TIER_ONLY;
  assert.throws(() => new GeminiVisionProvider({ apiKey: 'not-used' }), VisionProviderError);
  if (before) process.env.AI_FREE_TIER_ONLY = before;
});
