# Go-Live Checklist

Before switching traffic to production, run this checklist:

Environment & Secrets
- [ ] All required environment variables configured in production (Netlify/Azure)
- [ ] Service keys (SUPABASE_SERVICE_KEY, TWILIO, JIRA) are present and correct
- [ ] Secrets are stored securely (Netlify env, GitHub secrets, or Azure Key Vault)

Build & Deploy
- [ ] Frontend built successfully and static assets served from `web/`
- [ ] Serverless functions deployed and returning expected responses
- [ ] CI tests (unit/integration) pass on main branch

Data & Artifacts
- [ ] Model artifacts uploaded to production storage
- [ ] Signed URLs are generated successfully for artifacts used in production
- [ ] Data migrations (if any) completed and verified

Smoke Tests
- [ ] Call key API endpoints and assert 200+ valid responses
- [ ] Run sample end-to-end user flows (place order, feedback, report generation)
- [ ] Verify logs for errors during first hour after deploy

Monitoring
- [ ] Logging & alerting configured (Slack or PagerDuty)
- [ ] Dashboards show expected metrics and baseline thresholds
- [ ] Runbooks available for common failures

Post-launch
- [ ] Monitor for 24 hours for errors, spikes in latency, or other anomalies
- [ ] Collect feedback from ops/users and plan follow-up fixes
