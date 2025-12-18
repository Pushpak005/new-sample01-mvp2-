# Dashboard Integration Guide

This document describes how to set up and configure the metrics API and frontend dashboard integration for the healthy food delivery platform.

## Overview

The dashboard integration consists of:
1. **Metrics API** (`/.netlify/functions/get_metrics`) - Server-side function that queries materialized views
2. **Frontend Integration** (`nutrition-dashboard.js`) - Client-side code that fetches and renders metrics
3. **Scheduled Refresh** - pg_cron job or Supabase Scheduled Function to refresh materialized views

## Required Environment Variables

Set these environment variables in your Netlify dashboard (Site settings > Environment variables):

### Required

| Variable | Description | Example |
|----------|-------------|---------|
| `SUPABASE_URL` | Your Supabase project URL | `https://xxxxx.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (server-side only) | `eyJhbGciOiJ...` |

### Optional

| Variable | Description | Example |
|----------|-------------|---------|
| `ADMIN_API_KEY` | Optional API key for protecting the metrics endpoint | `your-secret-key-here` |

### Security Notes

⚠️ **IMPORTANT**: 
- `SUPABASE_SERVICE_ROLE_KEY` must **never** be exposed to the browser. It is only used in Netlify Functions (server-side).
- If you set `ADMIN_API_KEY`, clients must include the `X-Admin-Api-Key` header when calling the metrics endpoint.
- Store all secrets in Netlify environment variables, never in code.

## API Endpoints

### GET /.netlify/functions/get_metrics

Returns KPI data from materialized views.

**Headers (if ADMIN_API_KEY is configured)**:
```
X-Admin-Api-Key: your-secret-key-here
```

**Response**:
```json
{
  "success": true,
  "timestamp": "2024-01-15T10:30:00.000Z",
  "daily_gmv": [...],
  "top_skus": [...],
  "vendor_kpis": [...],
  "hourly_demand": [...],
  "order_status": [...]
}
```

### POST /.netlify/functions/recommend (Scaffold - Disabled)

This endpoint is a placeholder for future LLM-based recommendations. It is currently **disabled** and returns a 501 Not Implemented response.

See the code comments in `netlify/functions/recommend.js` for planned features and required environment variables.

## Materialized Views

The metrics API queries these materialized views (created in earlier database work):

| View | Description |
|------|-------------|
| `mv_daily_gmv` | Daily gross merchandise value |
| `mv_top_skus` | Top selling dishes/SKUs |
| `mv_vendor_kpis` | Vendor performance metrics |
| `mv_hourly_demand` | Hourly demand heatmap data |
| `mv_order_status_summary` | Order status distribution |

## Scheduling Materialized View Refresh

Materialized views need to be refreshed periodically to show current data. We recommend refreshing every 15 minutes.

### Option 1: pg_cron (Recommended)

If your PostgreSQL instance supports pg_cron:

1. Run the setup script in your database:
   ```sql
   -- From scripts/pgcron_schedule.sql
   CREATE EXTENSION IF NOT EXISTS pg_cron;
   
   SELECT cron.schedule(
       'refresh_advanced_kpis',
       '*/15 * * * *',
       $$ SELECT refresh_all_advanced_kpis(); $$
   );
   ```

2. Verify the job is scheduled:
   ```sql
   SELECT * FROM cron.job;
   ```

3. Check execution history:
   ```sql
   SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;
   ```

### Option 2: Supabase Scheduled Functions

If pg_cron is not available (e.g., free tier Supabase), use Supabase Edge Functions with cron triggers:

1. Create an Edge Function:
   ```bash
   supabase functions new refresh-kpis
   ```

2. Add the function code (`supabase/functions/refresh-kpis/index.ts`):
   ```typescript
   import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

   Deno.serve(async () => {
     const supabase = createClient(
       Deno.env.get('SUPABASE_URL')!,
       Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
     )

     const { error } = await supabase.rpc('refresh_all_advanced_kpis')
     
     if (error) {
       console.error('Refresh failed:', error)
       return new Response(JSON.stringify({ error: error.message }), { status: 500 })
     }

     return new Response(JSON.stringify({ success: true }), { status: 200 })
   })
   ```

3. Deploy and schedule:
   ```bash
   supabase functions deploy refresh-kpis
   ```

4. Set up a cron trigger in the Supabase dashboard or using the CLI.

### Option 3: External Cron Service

Use an external service like:
- **Cron-job.org** (free)
- **EasyCron**
- **GitHub Actions** (scheduled workflow)

Configure it to call:
```
POST https://your-project.supabase.co/rest/v1/rpc/refresh_all_advanced_kpis
Authorization: Bearer YOUR_SERVICE_ROLE_KEY
```

## Frontend Integration

The `nutrition-dashboard.js` file includes a `loadMetrics()` function that:

1. Fetches data from `/.netlify/functions/get_metrics`
2. Calls render helper functions to display the data:
   - `renderGmvChart(dailyGmv)`
   - `renderTopSkus(topSkus)`
   - `renderVendorKpis(vendorKpis)`
   - `renderHourlyHeatmap(hourlyDemand)`
   - `renderOrderStatusSummary(orderStatus)`

If these helper functions don't exist in your codebase, the script will log warnings but won't crash.

### Customization

If your render helper function names differ, update the `loadMetrics()` function in `nutrition-dashboard.js`:

```javascript
// Example: If your function is named differently
// renderGmvChart(data.daily_gmv);  // Original
// displayGMVChart(data.daily_gmv); // Your version
```

## Testing & Validation

### Local Development

1. Install Netlify CLI:
   ```bash
   npm install -g netlify-cli
   ```

2. Create a `.env` file (never commit this):
   ```
   SUPABASE_URL=https://xxxxx.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJ...
   ADMIN_API_KEY=optional-key
   ```

3. Run local dev server:
   ```bash
   netlify dev
   ```

4. Test the endpoint:
   ```bash
   # Without API key protection
   curl http://localhost:8888/.netlify/functions/get_metrics
   
   # With API key protection
   curl -H "X-Admin-Api-Key: your-key" http://localhost:8888/.netlify/functions/get_metrics
   ```

### Production Deployment

1. Set environment variables in Netlify dashboard
2. Deploy: Netlify will automatically build and deploy functions
3. Test the endpoint:
   ```bash
   curl https://your-site.netlify.app/.netlify/functions/get_metrics
   ```
4. Open `nutrition-dashboard.html` and verify metrics load correctly

## Troubleshooting

### "Configuration error" response

- Check that `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set in Netlify environment variables
- Redeploy after adding environment variables

### "Unauthorized" response

- If `ADMIN_API_KEY` is set, include the `X-Admin-Api-Key` header in your request
- Verify the key matches exactly (case-sensitive)

### Empty data arrays

- Verify the materialized views exist in your database
- Run `SELECT * FROM mv_daily_gmv LIMIT 1;` to check
- Ensure `refresh_all_advanced_kpis()` has been called at least once

### Frontend not loading metrics

- Check browser console for errors
- Verify the fetch URL is correct
- If using ADMIN_API_KEY, update the frontend code to include the header

## Notes

- **LLM Integration**: The `recommend.js` endpoint is a scaffold placeholder. LLM integration is **not enabled** in this version.
- **Database Work**: The materialized views, refresh helpers, and related database objects were created in earlier work and are assumed to exist.
- **This PR focuses on**: API + frontend integration + scheduler instructions only.
