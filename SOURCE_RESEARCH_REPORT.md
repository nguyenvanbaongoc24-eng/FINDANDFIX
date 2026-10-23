# Automotive document source research

## Reference products

| Product | Publicly described capabilities | Acquisition decision |
| --- | --- | --- |
| Carmin (`com.min.car`) | Google Play describes wiring diagrams by popular make/model plus video and technical document libraries; public review content mentions SVG display. | `RESTRICTED`. Research public listing only; no APK/document ingestion without verified permission. |
| Auto Repair Documents (`vn.advn.automobile`) | Google Play describes make/model selection, electrical diagrams, engine/accessory folders, part-code and ECU information, and videos. | `RESTRICTED`. Research public listing only; no document crawling or redistribution without written authorization. |

The public claims are product descriptions, not evidence of an API license, document ownership or a right to copy files. Neither product is in the crawler allowlist.

## Candidate sources

| Source | Material | Rights decision | Use in MVP |
| --- | --- | --- | --- |
| Project-created sample files | SVG/PDF-like sample, DTC descriptions | `APPROVED` | Stored and displayed |
| Admin upload with written license | PDF, SVG, PNG, JPG | `APPROVED` only after admin records storage/re-distribution rights | Upload workflow |
| NHTSA APIs/datasets | Vehicle safety metadata, recalls, investigations, manufacturer communications indices | `REVIEW_REQUIRED` | Metadata research only; do not ingest OEM TSB PDFs by default |
| OEM partner feed | Contract-defined document files | `REVIEW_REQUIRED` until agreement recorded | Future connector |
| Any login, CAPTCHA, subscription or DRM source | Varies | `RESTRICTED` | Link or user-authorized viewer only |

NHTSA exposes datasets/APIs and says manufacturer communications can be found in vehicle search results. The submitter of a communication may still own the underlying material, so a public filing is not treated as a redistribution grant. [NHTSA datasets and APIs](https://www.nhtsa.gov/nhtsa-datasets-and-apis), [NHTSA investigation/recall resources](https://www.nhtsa.gov/resources-investigations-recalls)

## Supported acquisition formats

PDF, SVG, PNG and JPG are supported after magic-byte/MIME validation. PDF page count is collected only when a parser can determine it; otherwise the field stays null. SVG must be sanitized before browser rendering. Document type, manufacturer, model and year remain unset when the source title/text lacks evidence; admin review is required.

## Source approval checklist

1. Capture terms URL, robots URL and retrieval timestamp.
2. Record license holder, storage permission and redistribution permission separately.
3. Limit crawler to approved HTTPS domains and path prefixes.
4. Reject credentials, CAPTCHA, DRM, subscription gates and ambiguous terms.
5. Retain source URL, SHA-256, acquisition date and reviewer decision with every document.
