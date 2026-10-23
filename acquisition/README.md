# Local acquisition crawler

```powershell
python crawler.py --source project-samples
```

The command intentionally stops because `project-samples` is approved for admin-upload material only and has no crawl endpoint. A source must be explicitly `APPROVED`, with `crawl_enabled`, storage and redistribution rights, robots/terms URLs, and an HTTPS path allowlist before any request is made.

State is saved in `state.sqlite3`. Use `--resume` after interruption or pass `--pause-file STOP` to pause cleanly. Downloads and state are local artifacts and ignored by Git.
