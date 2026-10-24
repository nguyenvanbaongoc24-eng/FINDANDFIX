# AI camera recognition root-cause audit

## Scope

The audit covers the browser camera/file picker, crop canvas, request envelope,
Vercel Node route, Gemini provider, schema validation, response rendering and
the old fallback path. It does not claim to have reverse-engineered a third
party APK or run a live Gemini request without a server key.

## Findings and fixes

| Area | Root cause | Fix |
| --- | --- | --- |
| Image state | A new capture could leave the previous detected objects in state. | `resetRecognitionForNewScan()` aborts the old request, creates a `scan_id`, clears objects, boxes and compatibility UI. |
| Payload | The earlier request sent only a data URL and a request id. The server could not prove which optimized image was analyzed. | The client hashes the exact JPEG bytes after resize/crop and sends mime, width, height, timestamp, `scan_id` and `request_id`. |
| Server integrity | A client hash alone is not trusted. | The server decodes the data URL, recomputes SHA-256 and dimensions, and rejects mismatch or a request-id mismatch before Gemini. |
| Provider bias | The first prompt described an automotive repair context and encouraged a single-domain interpretation. | Stage A is universal object detection. Stage B is selected only after the Stage A category. |
| Parsing | Model identity fields and boxes could be accepted without evidence or geometry checks. | Zod schema, evidence filtering, enum categories and box validation run before the response reaches the UI. |
| Bounding boxes | Percent coordinates were placed against the letterboxed wrapper, producing an offset on portrait images. | Renderer calculates rendered image size and `offsetX/offsetY` before mapping `[ymin,xmin,ymax,xmax]` from 0–1000. |
| Stale responses | A slower previous request could overwrite a newer capture. | AbortController plus exact `scan_id` and `request_id` checks discard late responses. |
| Mock fallback | A failed provider could previously leave a demo result visible. | Production recognition returns an explicit state (`vision_unavailable`, quota, invalid image, or unknown object); it never creates a wiper or sample part. |

## UI acceptance

Errors use `role="alert"` and a retry action. The loading message preserves the
current layout while the request is active. A box is rendered only for a valid
four-number box; an invalid or absent box leaves the image unannotated.

