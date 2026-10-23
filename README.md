# FINDANDFIX — Automotive document acquisition MVP

Mobile PWA for vehicle-scoped technical document lookup, paired with a local Python acquisition tool that only runs for explicitly approved sources.

## Run the PWA

```powershell
python -m http.server 4173
```

Open `http://localhost:4173/mvp/`.

EWD Library MVP: `http://localhost:4173/mvp/ewd/`. The viewer contains only project-created sample diagrams and metadata; reference services remain link-only until their rights are approved.

## Run verification

```powershell
cd acquisition
python -m unittest discover -s tests -v
python crawler.py --source project-samples
```

The second command must stop before making a network request: project samples are approved for admin upload, not crawl. Add an approved source only after recording terms, robots, URL allowlist, storage rights and redistribution rights in `mvp/data/source-registry.json` and the Supabase registry.

## Supabase

Run migrations in lexical order from `mvp/supabase/migrations/`. The publishable client may read published records under RLS; it cannot create schema, upload files or approve sources.

## EWD design records

- `EWD_SOURCE_ASSESSMENT.md` — source-rights decision table.
- `EWD_SYSTEM_ARCHITECTURE.md` — metadata, viewer and RLS architecture.
- `EWD_IMPLEMENTATION_PLAN.md` — staged rollout and approval gates.
