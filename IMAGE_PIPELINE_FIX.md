# Image pipeline fix

1. Capture or select a JPEG, PNG or WebP.
2. Reset the scan state and abort any prior recognition request.
3. Draw the confirmed crop into a canvas, resize the longest side to 1600 px,
   and encode one JPEG at quality 0.82.
4. Hash those exact JPEG bytes with SHA-256 in the browser. The hash is paired
   with dimensions, mime type, timestamp, `scan_id` and `request_id`.
5. POST the data URL and integrity envelope to `/api/ai/recognize-part`.
6. The Node route parses the image, checks magic bytes, size, dimensions and
   the server-computed hash. A mismatch returns `image_integrity_mismatch` and
   never calls Gemini.
7. Stage A asks Gemini for general object detection. Stage B enriches only an
   automotive or electronics result. Unknown/other objects remain usable
   labels without invented vehicle compatibility.
8. The provider validates the structured response with Zod, strips unsupported
   identity fields, rejects invalid boxes and returns the verified image hash.
9. The client accepts the response only when its request id, scan id and image
   hash all match the active scan.

The API never logs the image data URL or `GEMINI_API_KEY`. `AI_FREE_TIER_ONLY`
must be `true`; quota errors remain visible as a 429 state and do not fall back
to a paid provider.

