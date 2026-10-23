# Ingestion guard library

`ingest-lib.mjs` is a policy gate. `crawler.mjs` can fetch one allowlisted public candidate only after the source record shows approved rights and fresh terms/robots snapshots. It enforces HTTPS/same-origin path scope, a one-request-per-second default, byte budget, terminal handling of 401/403/429, MIME allowlist and SHA-256 before a future worker writes anything to Supabase Storage.

It intentionally has no source manifest with real URLs and no credentials. A production worker must add rate limiting, retry/resume, extraction/OCR sandboxing, malware scanning and database audit writes around these guards.
