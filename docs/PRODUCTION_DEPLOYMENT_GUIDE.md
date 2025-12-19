# Production Deployment Guide

This document provides the minimal steps to deploy the project to production using Netlify for the frontend and Netlify Functions (or an equivalent serverless host) for backend endpoints.

Prerequisites
- Netlify site created and linked to this repository
- Environment variables configured in Netlify (Key names listed below)
- Models and artifacts uploaded to production storage (Supabase/Azure)

Required environment variables (example names — replace with your actual names)
- SUPABASE_URL
- SUPABASE_SERVICE_KEY
- TWILIO_API_KEY (if used)
- JIRA_API_TOKEN (if used)
- Any other third-party keys

Netlify configuration
- Publish directory: web
- Build command: (if you have a frontend build; otherwise leave blank)
  e.g., `npm run build` if using Node tooling
- In `netlify.toml` set:
  [build]
    publish = "web"
    command = "<your-build-command-if-any>"

Deploy steps
1. Ensure repository is up to date and branch merged into `main`.
2. Ensure Netlify environment variables are set in the site settings.
3. Push to `main` and let Netlify build/deploy automatically.
4. Test serverless endpoints:
   - Call the functions (e.g., `/.netlify/functions/feedback`) and verify expected responses (200/400 as per contract).
5. Verify front-end pages load and static assets load from the `web/` directory.

CI & Tests
- Add a GitHub Actions workflow to run tests on PRs:
  - Install Python deps (if any)
  - Run `pytest -q`
  - Optionally, run a linter

Rollback
- Use Netlify deploys UI to select a previous successful deploy and rollback.

Debugging
- Check Netlify function logs in the Netlify UI.
- Enable Application Insights or use log aggregation for long-lived debugging.
- Use signed URLs to fetch artifacts and validate model versions and data.

Notes on models
- Do not commit model artifacts to git. Store them in Supabase/Azure and use signed URLs for download at runtime or during CI deploys.
- Consider a `scripts/download_models.sh` script that fetches required models as part of a build/deploy pipeline.
