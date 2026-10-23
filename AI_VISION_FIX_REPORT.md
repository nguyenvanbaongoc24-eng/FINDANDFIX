# AI Vision Recognition P0 Fix Report

## Root cause

The scanner did not send the actual image to a Vision model. Both browser
implementations truncated the data URL (`base64.slice(0, 5000)`) and forced the
request hint to `wiper` / `wiper windshield`. The local API then used that hint
to manufacture a wiper blade, arm, motor, OEM codes, brands, confidence scores
and normalized bounding boxes. If the request failed, the browser manufactured
the same wiper results again. Its product-search fallback also manufactured
Taobao/1688 listings and prices.

This behavior explains why a mouse could be displayed as three automotive
parts. It was deterministic mock/fallback behavior, not a Vision result.

## Implemented pipeline

`image input -> browser validation and resize -> request ID / cancellation ->
server MIME and magic-byte validation -> Vision -> evidence normalization ->
user confirmation -> authorized price source`

- `vision_pipeline.py` sends the complete optimized image as `input_image` to
  the Responses API. It supplies a universal-object prompt and strict JSON
  schema; it never tells the model that the subject is automotive.
- Only JPEG, PNG and WebP are accepted. The client permits input files up to
  8 MB, then resizes to a 1600-pixel edge and sends an encoded image below the
  server body limit. The server verifies MIME and file signatures again.
- Every recognition has a unique `request_id`. Selecting/capturing a new image
  aborts an outstanding recognition; a response whose ID is no longer current
  is ignored.
- `normalize_recognition` removes brand, model and part number unless the
  returned visible text/evidence contains that value. It never invents a
  confidence score or bounding box. The current provider configuration is
  classification-only, so the UI shows no box.
- `local_server.py` now calls the same pipeline. Its scanner search endpoint
  returns `search_unavailable` until an authorized provider adapter exists,
  rather than fabricated listings or prices.
- The mobile result screen has explicit states for `image_invalid`,
  `vision_unavailable`, `recognition_failed`, `object_unknown`,
  `multiple_objects_detected`, `needs_user_confirmation`,
  `search_unavailable`, and `price_not_found`. It begins blank and does not
  claim vehicle compatibility.

## Production configuration

`api/scanner/vision.py` is a Vercel Python Function. Set the server-only
`OPENAI_API_KEY` environment variable in Vercel and redeploy. `.env.example`
documents the setting; it does not contain a credential. `OPENAI_VISION_MODEL`
defaults to `gpt-4.1-mini` and may be overridden with a vision-capable model.

## Verification performed

1. `python -m unittest tests/test_vision_pipeline.py -v` — 4 tests pass:
   full image data survives validation, malformed image bytes are rejected,
   unevidenced UGREEN/model/OEM fields are removed, and no configured key
   returns an honest `vision_unavailable` state.
2. `node --check mobile-web/app.js` and `node --check mvp/scanner/scanner.js`
   pass.
3. `python -m py_compile vision_pipeline.py api/scanner/vision.py local_server.py`
   passes.
4. Local HTTP verification of `POST /api/scanner/vision` using request ID
   `mouse-e2e-no-key` returned HTTP 503 with `status: vision_unavailable`; it
   did not return a wiper, OEM code, confidence, box, or price.
5. Both local scanner documents load with blank initial product values and no
   default `85212-0D080` value.

## Remaining live-image validation

No `OPENAI_API_KEY` is configured in this environment, so a real pixel test of
the supplied UGREEN mouse cannot be truthfully claimed. Once the server-only
key is configured, test the matrix in the issue prompt (mouse, wiper,
headlight, phone, keyboard, brakes, multiple objects, blur, no product, and
repeat captures). The pipeline now fails closed until that service is present.
