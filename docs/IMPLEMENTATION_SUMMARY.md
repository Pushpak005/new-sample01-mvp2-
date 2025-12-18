# Implementation Summary

This document provides a concise overview of major flows implemented in the project.

1) Artifact upload / download
- Uploads: `scripts/upload_artifacts_supabase.py` uploads model and data artifacts to Supabase Storage.
- Downloads: Serverless functions or scripts generate signed URLs via the Supabase Storage sign API and use them for secure, time-limited downloads.

2) Frontend & Serverless endpoints
- Frontend lives in `web/`. It calls serverless endpoints under `/.netlify/functions/` (auth flow or data read/write).
- Netlify Functions source in `netlify/functions/` and are deployed by Netlify.

3) Testing & Automation
- Unit and small integration tests live in `practice/` and use `pytest`.
- CI should run the pytest suite on PRs and nightly as configured.

4) Data & Models
- Small sample data stored in `data/`. Large or production model artifacts stored in dedicated blob storage (Supabase or Azure).
- Model artifacts are listed in `tmp/reports/models_moved_list.txt` (if present) and can be downloaded using a script (to be added).

5) Recommended next tasks
- Add `scripts/download_models.sh` to pull models from storage for local dev.
- Add a GitHub Action to run `pytest` and optionally to fetch models before test run.
- Update all docs in `docs/` with production values and operational runbooks.

(End of summary)
