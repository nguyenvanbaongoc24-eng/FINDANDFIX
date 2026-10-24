import crypto from 'node:crypto';
import { GoogleGenAI } from '@google/genai';
import { z } from 'zod';

const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
const DATA_URL = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/i;

export class VisionProviderError extends Error {
  constructor(code, message, statusCode = 503) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
  }
}

const nullableText = z.string().trim().max(240).nullable();
const box2d = z.array(z.number().int().min(0).max(1000)).length(4).nullable();
export const PartSchema = z.object({
  id: z.string().min(1).max(64),
  name_vi: nullableText,
  name_en: nullableText,
  name_zh: nullableText,
  category: nullableText,
  brand: nullableText,
  model: nullableText,
  oem_code: nullableText,
  part_number: nullableText,
  technical_specs: z.array(z.string().trim().max(240)).max(12),
  visible_text: z.array(z.string().trim().max(240)).max(12),
  evidence: z.array(z.string().trim().max(320)).max(12),
  box_2d: box2d,
  requires_verification: z.boolean(),
  verification_questions: z.array(z.string().trim().max(240)).max(6),
  search_keywords: z.object({
    vi: z.array(z.string().trim().max(120)).max(6),
    en: z.array(z.string().trim().max(120)).max(6),
    zh: z.array(z.string().trim().max(120)).max(6),
  }),
});
export const RecognitionSchema = z.object({
  status: z.enum(['success', 'object_unknown', 'multiple_objects_detected', 'needs_user_confirmation']),
  parts: z.array(PartSchema).max(8),
});

const RESPONSE_SCHEMA = {
  type: 'object', additionalProperties: false, required: ['status', 'parts'],
  properties: {
    status: { type: 'string', enum: ['success', 'object_unknown', 'multiple_objects_detected', 'needs_user_confirmation'] },
    parts: {
      type: 'array', items: {
        type: 'object', additionalProperties: false,
        required: ['id', 'name_vi', 'name_en', 'name_zh', 'category', 'brand', 'model', 'oem_code', 'part_number', 'technical_specs', 'visible_text', 'evidence', 'box_2d', 'requires_verification', 'verification_questions', 'search_keywords'],
        properties: {
          id: { type: 'string' }, name_vi: { type: ['string', 'null'] }, name_en: { type: ['string', 'null'] }, name_zh: { type: ['string', 'null'] }, category: { type: ['string', 'null'] }, brand: { type: ['string', 'null'] }, model: { type: ['string', 'null'] }, oem_code: { type: ['string', 'null'] }, part_number: { type: ['string', 'null'] },
          technical_specs: { type: 'array', items: { type: 'string' } }, visible_text: { type: 'array', items: { type: 'string' } }, evidence: { type: 'array', items: { type: 'string' } },
          box_2d: { type: ['array', 'null'], items: { type: 'integer', minimum: 0, maximum: 1000 }, minItems: 4, maxItems: 4 },
          requires_verification: { type: 'boolean' }, verification_questions: { type: 'array', items: { type: 'string' } },
          search_keywords: { type: 'object', additionalProperties: false, required: ['vi', 'en', 'zh'], properties: { vi: { type: 'array', items: { type: 'string' } }, en: { type: 'array', items: { type: 'string' } }, zh: { type: 'array', items: { type: 'string' } } } },
        },
      },
    },
  },
};

const INSTRUCTIONS = `You are an evidence-first universal visual recognition service for a repair app. Analyze only pixels in the image. Do not assume the object is automotive: a computer mouse must be identified as a computer mouse. Never invent brand, model, OEM/part number, vehicle fitment, specifications, price, or calibrated probability. Brand/model/OEM may only be non-null when a visible logo, label, printed code, or a specifically described visual feature supports it; include that support in evidence. Return box_2d only if you can locate the object, normalized [ymin,xmin,ymax,xmax] from 0 to 1000; otherwise null. Use status object_unknown and parts [] when no object is identifiable. Use multiple_objects_detected for multiple distinct objects. Translate identifiable names to Vietnamese, English and Simplified Chinese. Search keywords must describe only confirmed or user-verifiable information.`;

function magicMime(bytes) {
  if (bytes.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) return 'image/jpeg';
  if (bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WEBP') return 'image/webp';
  return null;
}

export function parseImageDataUrl(dataUrl) {
  if (typeof dataUrl !== 'string') throw new VisionProviderError('image_invalid', 'Ảnh gửi lên không hợp lệ.', 400);
  const match = dataUrl.match(DATA_URL);
  if (!match) throw new VisionProviderError('image_invalid', 'Chỉ nhận ảnh JPEG, PNG hoặc WebP.', 400);
  const mimeType = match[1].toLowerCase();
  const bytes = Buffer.from(match[2], 'base64');
  if (!bytes.length || bytes.length > MAX_IMAGE_BYTES || !ALLOWED_MIME_TYPES.has(mimeType) || magicMime(bytes) !== mimeType) {
    throw new VisionProviderError('image_invalid', 'Nội dung ảnh không hợp lệ hoặc vượt 3 MB sau tối ưu.', 400);
  }
  return { mimeType, bytes, imageHash: crypto.createHash('sha256').update(bytes).digest('hex') };
}

function evidenceSupports(value, support) {
  return !value || support.some(item => item.toLocaleLowerCase().includes(value.toLocaleLowerCase()));
}

export function validateRecognition(value) {
  const parsed = RecognitionSchema.parse(value);
  const parts = parsed.parts.map((part, index) => {
    const support = [...part.evidence, ...part.visible_text];
    const safe = { ...part, id: `part_${index + 1}` };
    for (const field of ['brand', 'model', 'oem_code', 'part_number']) if (!evidenceSupports(safe[field], support)) safe[field] = null;
    if (safe.box_2d && (safe.box_2d[2] <= safe.box_2d[0] || safe.box_2d[3] <= safe.box_2d[1])) safe.box_2d = null;
    return safe;
  });
  if (!parts.length) return { status: 'object_unknown', parts: [] };
  return { status: parts.length > 1 ? 'multiple_objects_detected' : parsed.status, parts };
}

export class GeminiVisionProvider {
  constructor({ apiKey = process.env.GEMINI_API_KEY, model = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite', client } = {}) {
    if (process.env.AI_FREE_TIER_ONLY !== 'true') throw new VisionProviderError('free_tier_required', 'AI_FREE_TIER_ONLY phải được đặt là true.', 503);
    if (!apiKey) throw new VisionProviderError('vision_unavailable', 'Gemini chưa được cấu hình trên máy chủ.', 503);
    this.model = model;
    this.client = client || new GoogleGenAI({ apiKey });
  }

  async recognize({ image, vehicleContext = {} }) {
    const { mimeType, bytes, imageHash } = parseImageDataUrl(image);
    try {
      const interaction = await this.client.interactions.create({
        model: this.model,
        input: [
          { type: 'text', text: `${INSTRUCTIONS}\nVehicle context is optional and never proves fitment: ${JSON.stringify(vehicleContext)}` },
          { type: 'image', data: bytes.toString('base64'), mime_type: mimeType },
        ],
        response_format: { type: 'text', mime_type: 'application/json', schema: RESPONSE_SCHEMA },
      });
      const result = validateRecognition(JSON.parse(interaction.output_text));
      return { ...result, image_sha256: imageHash, provider: 'gemini', model: this.model };
    } catch (error) {
      if (error instanceof VisionProviderError || error instanceof z.ZodError || error instanceof SyntaxError) throw error;
      const status = error?.status || error?.statusCode;
      if (status === 429) throw new VisionProviderError('free_tier_quota_exhausted', 'Đã đạt giới hạn AI miễn phí. Hãy thử lại sau.', 429);
      throw new VisionProviderError('vision_unavailable', 'Gemini không thể xử lý ảnh ở thời điểm này.', 503);
    }
  }
}

export class OllamaVisionProvider {
  constructor({ baseUrl = process.env.OLLAMA_BASE_URL, model = 'qwen3-vl:4b' } = {}) {
    if (!baseUrl) throw new VisionProviderError('vision_unavailable', 'Ollama chưa được admin cấu hình.', 503);
    if (process.env.VERCEL && /^https?:\/\/(?:localhost|127\.0\.0\.1)/i.test(baseUrl)) throw new VisionProviderError('vision_unavailable', 'Vercel không thể gọi Ollama localhost.', 503);
    this.baseUrl = baseUrl.replace(/\/$/, ''); this.model = model;
  }
  async recognize() { throw new VisionProviderError('vision_unavailable', 'Ollama Vision chưa được triển khai cho môi trường này.', 503); }
}

export function createVisionProvider(options = {}) {
  const provider = process.env.AI_PROVIDER || 'gemini';
  if (provider === 'gemini') return new GeminiVisionProvider(options);
  if (provider === 'ollama') return new OllamaVisionProvider(options);
  throw new VisionProviderError('vision_unavailable', 'AI_PROVIDER không hợp lệ.', 503);
}
