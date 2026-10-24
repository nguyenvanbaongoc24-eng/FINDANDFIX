import { VisionProviderError, createVisionProvider } from '../../lib/vision-providers.mjs';

function respond(res, status, body) {
  res.status(status).setHeader('Cache-Control', 'no-store').json(body);
}

export default async function recognizePart(req, res) {
  if (req.method !== 'POST') return respond(res, 405, { ok: false, status: 'method_not_allowed' });
  try {
    const result = await createVisionProvider().recognize({
      image: req.body?.image,
      vehicleContext: req.body?.vehicle ?? {},
    });
    return respond(res, 200, { ok: true, request_id: req.body?.request_id, ...result });
  } catch (error) {
    if (error instanceof VisionProviderError) return respond(res, error.statusCode, { ok: false, status: error.code, error: error.message });
    if (error?.name === 'ZodError' || error instanceof SyntaxError) return respond(res, 502, { ok: false, status: 'recognition_failed', error: 'Gemini trả về dữ liệu không hợp lệ.' });
    console.error('recognize-part failed', { name: error?.name, status: error?.status });
    return respond(res, 503, { ok: false, status: 'vision_unavailable', error: 'Không thể gọi Gemini.' });
  }
}
