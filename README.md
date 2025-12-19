# new-sample01-mvp2-

Short description
A prototype/demo project that provides a small frontend (Netlify-hosted), serverless APIs, automation scripts, and local model artifacts used for development and testing.

Repository layout
- web/                — frontend HTML/CSS/JS (Netlify publish directory)
- netlify/functions/  — serverless endpoints (Netlify Functions)
- scripts/            — automation scripts and utilities (upload, seeds, downloads)
- data/               — tracked small CSVs and sample data
- models/             — local model artifacts (kept out of git; see docs for how to download)
- docs/               — repository documentation (this folder)
- practice/           — practice/test code (pytest examples)
- infra/              — Dockerfile and infra-related files
- tools/              — operational helper scripts

Quick start (development)
1. Clone the repo:
   git clone git@github.com:Pushpak005/new-sample01-mvp2-.git
   cd new-sample01-mvp2-

2. (Optional) Create a Python virtual environment:
   python3 -m venv .venv
   source .venv/bin/activate

3. Install practice/test deps:
   pip install -r practice/requirements.txt

4. Run practice tests:
   pytest -q practice/tests

Netlify / frontend
- The frontend is located in `web/`. Netlify publish directory should be set to `web`.
- If you use `netlify.toml`, ensure `[build] publish = "web"` is set, or configure the publish dir in the Netlify site settings.

Models & large artifacts
- Model artifacts (e.g., `*.joblib`) are stored locally in `models/` for development. They are ignored by git.
- For production and CI, artifacts should be stored in a blob store (Supabase Storage or Azure Blob). See docs/SUPABASE_SETUP.md for download instructions.

Environment variables (examples)
- SUPABASE_URL — e.g. `https://<project>.supabase.co/` (placeholder)
- SUPABASE_SERVICE_KEY — service role key used server-side to sign URLs and manage storage
- (Other service keys as needed) TWILIO_API_KEY, JIRA_API_TOKEN, etc.

Where to look next
- docs/SUPABASE_SETUP.md — how to generate signed URLs, list objects, and download artifacts
- docs/PRODUCTION_DEPLOYMENT_GUIDE.md — deployment steps, Netlify, env vars
- docs/GO_LIVE_CHECKLIST.md — pre-launch checklist
- docs/IMPLEMENTATION_SUMMARY.md — short summary of major flows (uploads, downloads, tests)

Contributing
- Please open PRs against `main` (or your primary branch). Keep model artifacts out of git; use storage and the scripts in `scripts/` to fetch them.

Contact
- Repository owner: Pushpak005
