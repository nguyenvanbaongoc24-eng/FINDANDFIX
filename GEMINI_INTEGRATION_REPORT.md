# Gemini Free-Tier Integration Report

## Delivered

- The production recognition endpoint is `POST /api/ai/recognize-part`.
- `lib/vision-providers.mjs` provides a `VisionProvider` boundary with:
  - `GeminiVisionProvider` as the default, using the official `@google/genai`
    SDK and `gemini-3.5-flash-lite`.
  - `OllamaVisionProvider` as a configuration-only future option. It never
    assumes that a Vercel Function can reach a personal computer's localhost.
- Gemini receives the full optimized image, not a hint or a sample result. Its
  output is constrained by JSON Schema and checked again with Zod.
- The provider removes brand, model, OEM and part number if they do not appear
  in `visible_text` or `evidence`. Vehicle context is explicitly not proof of
  fitment. A box is rendered only when Gemini returns a valid normalized box.
- `AI_FREE_TIER_ONLY=true` is mandatory. No OpenAI fallback and no paid-model
  fallback exists. HTTP 429 maps to `free_tier_quota_exhausted`.
- Product price search remains unavailable until an authorized provider API is
  configured; the application does not manufacture products or prices.

## Required Vercel environment variables

```text
AI_PROVIDER=gemini
AI_FREE_TIER_ONLY=true
GEMINI_API_KEY=server-only-key
GEMINI_MODEL=gemini-3.5-flash-lite
PARTS_MARKUP_PERCENT=30
```

No key is present in this workspace or client bundle. `GEMINI_API_KEY` must be
added only in Vercel Project Settings, then the deployment must be redeployed.

## Verification

- `npm test` passes four tests: image validation, evidence filtering,
  free-tier lock, and deterministic 30% markup calculation.
- `npm audit --omit=dev --json` reports zero vulnerabilities after updating
  Zod to 4.6.7.
- Node syntax checks pass for the API route, provider module and scanner UI.
- A live Gemini request was not run because no API key was supplied. The
  configuration test confirms the endpoint returns `vision_unavailable` instead
  of emitting a fake identification while the key is absent.

## Live validation still required after the key is set

Run the camera matrix using a mouse, wiper, headlight, OEM-labelled part,
multiple objects, blurred image and a non-product scene. Confirm the response
contains only visible evidence, that the 429 state is displayed if the Free
Tier quota is reached, and that no price is shown without a source URL and
currency.
