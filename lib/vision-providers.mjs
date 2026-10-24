import crypto from 'node:crypto';
import { GoogleGenAI } from '@google/genai';
import { z } from 'zod';

const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
const DATA_URL = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/i;
export const OBJECT_CATEGORIES = ['automotive_part', 'electronics', 'tools', 'household', 'accessories', 'mechanical_components', 'other', 'unknown'];

export class VisionProviderError extends Error {
  constructor(code, message, statusCode = 503) { super(message); this.code = code; this.statusCode = statusCode; }
}

const nullableText = z.string().trim().max(240).nullable();
const category = z.enum(OBJECT_CATEGORIES);
const box2d = z.array(z.number().int().min(0).max(1000)).length(4).nullable();
export const PartSchema = z.object({
  id: z.string().min(1).max(64), name_vi: nullableText, name_en: nullableText, name_zh: nullableText,
  category, brand: nullableText, model: nullableText, oem_code: nullableText, part_number: nullableText,
  technical_specs: z.array(z.string().trim().max(240)).max(12), visible_text: z.array(z.string().trim().max(240)).max(12),
  evidence: z.array(z.string().trim().max(320)).max(12), box_2d: box2d, requires_verification: z.boolean(),
  verification_questions: z.array(z.string().trim().max(240)).max(6),
  search_keywords: z.object({ vi: z.array(z.string().trim().max(120)).max(6), en: z.array(z.string().trim().max(120)).max(6), zh: z.array(z.string().trim().max(120)).max(6) }),
});
const RECOGNITION_STATUSES = ['success', 'object_unknown', 'multiple_objects_detected', 'needs_user_confirmation', 'no_clear_product'];
export const RecognitionSchema = z.object({ status: z.enum(RECOGNITION_STATUSES), parts: z.array(PartSchema).max(8) });
const stageAPart = PartSchema.pick({ id: true, name_vi: true, name_en: true, name_zh: true, category: true, brand: true, model: true, evidence: true, box_2d: true, requires_verification: true, verification_questions: true });
export const StageASchema = z.object({ status: z.enum(RECOGNITION_STATUSES), primary_object: stageAPart.nullable(), detected_objects: z.array(stageAPart).max(8), automotive_related: z.boolean() });

function jsonSchemaForPart(full = true) {
  const props = {
    id: { type: 'string' }, name_vi: { type: ['string', 'null'] }, name_en: { type: ['string', 'null'] }, name_zh: { type: ['string', 'null'] }, category: { type: 'string', enum: OBJECT_CATEGORIES }, brand: { type: ['string', 'null'] }, model: { type: ['string', 'null'] }, evidence: { type: 'array', items: { type: 'string' } }, box_2d: { type: ['array', 'null'], items: { type: 'integer', minimum: 0, maximum: 1000 }, minItems: 4, maxItems: 4 }, requires_verification: { type: 'boolean' }, verification_questions: { type: 'array', items: { type: 'string' } },
  };
  const required = Object.keys(props);
  if (full) {
    Object.assign(props, { oem_code: { type: ['string', 'null'] }, part_number: { type: ['string', 'null'] }, technical_specs: { type: 'array', items: { type: 'string' } }, visible_text: { type: 'array', items: { type: 'string' } }, search_keywords: { type: 'object', additionalProperties: false, required: ['vi', 'en', 'zh'], properties: { vi: { type: 'array', items: { type: 'string' } }, en: { type: 'array', items: { type: 'string' } }, zh: { type: 'array', items: { type: 'string' } } } } });
    required.push('oem_code', 'part_number', 'technical_specs', 'visible_text', 'search_keywords');
  }
  return { type: 'object', additionalProperties: false, required, properties: props };
}
const RESPONSE_SCHEMA = { type: 'object', additionalProperties: false, required: ['status', 'parts'], properties: { status: { type: 'string', enum: RECOGNITION_STATUSES }, parts: { type: 'array', items: jsonSchemaForPart(true) } } };
const STAGE_A_RESPONSE_SCHEMA = { type: 'object', additionalProperties: false, required: ['status', 'primary_object', 'detected_objects', 'automotive_related'], properties: { status: { type: 'string', enum: RECOGNITION_STATUSES }, primary_object: { anyOf: [jsonSchemaForPart(false), { type: 'null' }] }, detected_objects: { type: 'array', items: jsonSchemaForPart(false) }, automotive_related: { type: 'boolean' } } };

const STAGE_A_INSTRUCTIONS = 'You are a general-purpose visual object identification system. Analyze ONLY the actual provided image. Identify what is visibly present without assuming any particular industry or product category. Do not assume that an object is an automotive component. Describe the primary visible object first. Detect additional objects only if visibly present. Do not invent brands, model names, serial numbers, compatibility, measurements, or specifications. If uncertain, use UNKNOWN. Return structured JSON only.';
const AUTOMOTIVE_STAGE_B = 'You are an automotive visual enrichment system. Use the supplied image and Stage A evidence. Return only visible or verifiable automotive details. OEM/part numbers require readable text or explicit visual evidence. Vehicle fitment is never proven from an image: leave it null and require verification. Do not add unrelated parts.';
const ELECTRONICS_STAGE_B = 'You are an electronics visual enrichment system. Use the supplied image and Stage A evidence. Provide product type and visible features. Brand/model require a visible logo, label, or uniquely stated visual evidence. Do not output automotive OEM codes, part numbers, or vehicle fitment.';

function magicMime(bytes) {
  if (bytes.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) return 'image/jpeg';
  if (bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WEBP') return 'image/webp';
  return null;
}
function imageDimensions(bytes, mimeType) {
  if (mimeType === 'image/png' && bytes.length >= 24) return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
  if (mimeType === 'image/jpeg') {
    for (let offset = 2; offset + 9 < bytes.length;) { if (bytes[offset] !== 0xff) { offset++; continue; } const marker = bytes[offset + 1]; const length = bytes.readUInt16BE(offset + 2); if (marker >= 0xc0 && marker <= 0xc3 && length >= 7) return { width: bytes.readUInt16BE(offset + 7), height: bytes.readUInt16BE(offset + 5) }; offset += 2 + length; }
  }
  if (mimeType === 'image/webp' && bytes.length >= 30) {
    const kind = bytes.subarray(12, 16).toString();
    if (kind === 'VP8X') return { width: 1 + bytes.readUIntLE(24, 3), height: 1 + bytes.readUIntLE(27, 3) };
    if (kind === 'VP8 ' && bytes[23] === 0x9d && bytes[24] === 0x01 && bytes[25] === 0x2a) return { width: bytes.readUInt16LE(26) & 0x3fff, height: bytes.readUInt16LE(28) & 0x3fff };
    if (kind === 'VP8L') { const bits = bytes.readUInt32LE(21); return { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 }; }
  }
  throw new VisionProviderError('image_invalid', 'Không thể đọc kích thước ảnh.', 400);
}
export function parseImageDataUrl(dataUrl) {
  if (typeof dataUrl !== 'string') throw new VisionProviderError('image_invalid', 'Ảnh gửi lên không hợp lệ.', 400);
  const match = dataUrl.match(DATA_URL); if (!match) throw new VisionProviderError('image_invalid', 'Chỉ nhận ảnh JPEG, PNG hoặc WebP.', 400);
  const mimeType = match[1].toLowerCase(); const bytes = Buffer.from(match[2], 'base64');
  if (!bytes.length || bytes.length > MAX_IMAGE_BYTES || !ALLOWED_MIME_TYPES.has(mimeType) || magicMime(bytes) !== mimeType) throw new VisionProviderError('image_invalid', 'Nội dung ảnh không hợp lệ hoặc vượt 3 MB sau tối ưu.', 400);
  const dimensions = imageDimensions(bytes, mimeType);
  if (!dimensions.width || !dimensions.height || dimensions.width > 12000 || dimensions.height > 12000) throw new VisionProviderError('image_invalid', 'Kích thước ảnh không hợp lệ.', 400);
  return { mimeType, bytes, dimensions, imageHash: crypto.createHash('sha256').update(bytes).digest('hex') };
}
export function verifyImageIntegrity(image, integrity) {
  const parsed = parseImageDataUrl(image);
  const schema = z.object({ scan_id: z.string().uuid(), request_id: z.string().uuid(), image_sha256: z.string().regex(/^[a-f0-9]{64}$/), image_width: z.number().int().positive(), image_height: z.number().int().positive(), image_mime_type: z.enum(['image/jpeg', 'image/png', 'image/webp']), capture_timestamp: z.string().datetime() });
  const input = schema.safeParse(integrity);
  if (!input.success) throw new VisionProviderError('image_integrity_invalid', 'Siêu dữ liệu ảnh không hợp lệ.', 400);
  const same = input.data.image_sha256 === parsed.imageHash && input.data.image_width === parsed.dimensions.width && input.data.image_height === parsed.dimensions.height && input.data.image_mime_type === parsed.mimeType;
  if (!same) throw new VisionProviderError('image_integrity_mismatch', 'Ảnh nhận được không khớp với thông tin toàn vẹn từ thiết bị.', 400);
  return { ...parsed, integrity: input.data };
}
export function assertRequestIntegrity(requestId, integrity) {
  if (typeof requestId !== 'string' || requestId !== integrity?.request_id) {
    throw new VisionProviderError('image_integrity_invalid', 'request_id không khớp với metadata ảnh.', 400);
  }
}
function evidenceSupports(value, support) { return !value || support.some(item => item.toLocaleLowerCase().includes(value.toLocaleLowerCase())); }
export function validateRecognition(value) {
  const parsed = RecognitionSchema.parse(value);
  const parts = parsed.parts.map((part, index) => {
    const support = [...part.evidence, ...part.visible_text]; const safe = { ...part, id: 'part_' + (index + 1) };
    for (const field of ['brand', 'model', 'oem_code', 'part_number']) if (!evidenceSupports(safe[field], support)) safe[field] = null;
    if (safe.category !== 'automotive_part') { safe.oem_code = null; safe.part_number = null; }
    if (safe.box_2d && (safe.box_2d[2] <= safe.box_2d[0] || safe.box_2d[3] <= safe.box_2d[1])) safe.box_2d = null;
    return safe;
  });
  return parts.length ? { status: parts.length > 1 ? 'multiple_objects_detected' : parsed.status, parts } : { status: parsed.status === 'no_clear_product' ? 'no_clear_product' : 'object_unknown', parts: [] };
}
function stageAPartToRecognition(part) { return { ...part, oem_code: null, part_number: null, technical_specs: [], visible_text: [], search_keywords: { vi: [], en: [], zh: [] } }; }

export class GeminiVisionProvider {
  constructor({ apiKey = process.env.GEMINI_API_KEY, model = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite', client } = {}) {
    if (process.env.AI_FREE_TIER_ONLY !== 'true') throw new VisionProviderError('free_tier_required', 'AI_FREE_TIER_ONLY phải được đặt là true.', 503);
    if (!apiKey) throw new VisionProviderError('vision_unavailable', 'Gemini chưa được cấu hình trên máy chủ.', 503);
    this.model = model; this.client = client || new GoogleGenAI({ apiKey });
  }
  async invoke(instructions, bytes, mimeType, schema) {
    const response = await this.client.interactions.create({ model: this.model, input: [{ type: 'text', text: instructions }, { type: 'image', data: bytes.toString('base64'), mime_type: mimeType }], response_format: { type: 'text', mime_type: 'application/json', schema } });
    return JSON.parse(response.output_text);
  }
  async recognize({ image, integrity }) {
    const verified = verifyImageIntegrity(image, integrity); const { mimeType, bytes, imageHash, integrity: verifiedIntegrity } = verified;
    try {
      const stageA = StageASchema.parse(await this.invoke(STAGE_A_INSTRUCTIONS, bytes, mimeType, STAGE_A_RESPONSE_SCHEMA));
      const candidates = stageA.detected_objects.length ? stageA.detected_objects : stageA.primary_object ? [stageA.primary_object] : [];
      if (!candidates.length || stageA.status === 'object_unknown') return { status: 'object_unknown', parts: [], image_sha256: imageHash, integrity: verifiedIntegrity, provider: 'gemini', model: this.model, analysis_stages: ['general'] };
      const needsEnrichment = candidates.some(part => part.category === 'automotive_part' || part.category === 'electronics');
      const instructions = candidates.some(part => part.category === 'automotive_part') ? AUTOMOTIVE_STAGE_B : ELECTRONICS_STAGE_B;
      const result = needsEnrichment ? validateRecognition(await this.invoke(instructions + '\nStage A findings: ' + JSON.stringify(stageA) + '\nDo not fabricate fields missing from Stage A evidence.', bytes, mimeType, RESPONSE_SCHEMA)) : validateRecognition({ status: stageA.status, parts: candidates.map(stageAPartToRecognition) });
      return { ...result, image_sha256: imageHash, integrity: verifiedIntegrity, provider: 'gemini', model: this.model, analysis_stages: needsEnrichment ? ['general', 'category'] : ['general'] };
    } catch (error) {
      if (error instanceof VisionProviderError || error instanceof z.ZodError || error instanceof SyntaxError) throw error;
      const status = error?.status || error?.statusCode;
      if (status === 429) throw new VisionProviderError('free_tier_quota_exhausted', 'Đã đạt giới hạn AI miễn phí. Hãy thử lại sau.', 429);
      throw new VisionProviderError('vision_unavailable', 'Gemini không thể xử lý ảnh ở thời điểm này.', 503);
    }
  }
}
export class OllamaVisionProvider { constructor({ baseUrl = process.env.OLLAMA_BASE_URL } = {}) { if (!baseUrl) throw new VisionProviderError('vision_unavailable', 'Ollama chưa được admin cấu hình.', 503); } async recognize() { throw new VisionProviderError('vision_unavailable', 'Ollama Vision chưa được triển khai cho môi trường này.', 503); } }
export function createVisionProvider(options = {}) { const provider = process.env.AI_PROVIDER || 'gemini'; if (provider === 'gemini') return new GeminiVisionProvider(options); if (provider === 'ollama') return new OllamaVisionProvider(options); throw new VisionProviderError('vision_unavailable', 'AI_PROVIDER không hợp lệ.', 503); }
