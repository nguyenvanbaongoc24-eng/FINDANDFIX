# AI recognition test report

## Automated checks that ran

- `npm test`: **8 passed**.
- `node --check api/ai/recognize-part.js`: passed.
- `node --check mvp/scanner/scanner.js`: passed.
- `node --check mobile-web/app.js`: passed.
- `git diff --check`: passed.

The tests cover supported-image parsing, image dimensions, evidence filtering,
request-id binding, SHA-256 mismatch rejection, invalid box rejection, staged
general→automotive enrichment, deterministic 30% pricing, and the mandatory
Free Tier lock.

## Required image matrix

| Case | Status | Evidence |
| --- | --- | --- |
| AirPods / electronics | Contract covered; live inference pending | No `GEMINI_API_KEY` is available in this workspace. |
| Wiper | Contract covered; live inference pending | Same limitation. |
| ABS sensor | Staged provider fixture test passed | The test uses a declared response fixture, not a claim about Gemini accuracy. |
| iPhone | Contract covered; live inference pending | Same limitation. |
| Bottle | Contract covered; live inference pending | Same limitation. |
| Empty table | Contract covered by `object_unknown` schema path | No live model call. |
| Multiple objects | Schema and UI path covered | Late/stale response checks are automated at the client contract level. |
| Blurred image | Invalid/unknown state path covered | No fabricated part is emitted. |
| New image after old request | `scan_id`/AbortController path implemented | Requires browser interaction for end-to-end timing validation. |
| API error / quota | Error mapping implemented | Live 429 requires a real project quota event. |
| Vertical letterbox | Offset math implemented | Rendering is checked by code inspection; browser screenshot validation remains pending. |
| OEM text | Evidence filter covered | An OEM code without matching evidence becomes `null`. |

## Limits

No live Gemini response is reported as a test result until a server-only
`GEMINI_API_KEY` is configured and the deployment is redeployed. No sample JSON
is used as production fallback.

