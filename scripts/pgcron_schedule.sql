-- =============================================================================
-- pg_cron Schedule for Materialized View Refresh
-- =============================================================================
--
-- This script sets up pg_cron to automatically refresh all advanced KPI
-- materialized views every 15 minutes.
--
-- PREREQUISITES:
-- 1. pg_cron extension must be installed and enabled in your PostgreSQL instance
-- 2. The refresh_all_advanced_kpis() function must exist
-- 3. The executing role must have permission to use pg_cron
--
-- NOTE: pg_cron is available in:
-- - Supabase (may require project upgrade)
-- - AWS RDS PostgreSQL
-- - Azure Database for PostgreSQL
-- - Self-hosted PostgreSQL with pg_cron installed
--
-- If pg_cron is not available, see README_DASHBOARD_INTEGRATION.md for
-- alternative scheduling options using Supabase Scheduled Functions.
-- =============================================================================

-- Enable pg_cron extension
-- NOTE: This typically requires superuser or rds_superuser role.
-- In Supabase, this may need to be enabled through the dashboard.
-- The statement is idempotent (safe to run multiple times if you have permission).
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- =============================================================================
-- Schedule the refresh job to run every 15 minutes
-- =============================================================================
-- Cron expression: */15 * * * * = every 15 minutes
-- Job name: 'refresh_advanced_kpis' - used to identify/manage the job
--
-- The refresh_all_advanced_kpis() function should:
-- - Refresh mv_daily_gmv
-- - Refresh mv_top_skus
-- - Refresh mv_vendor_kpis
-- - Refresh mv_hourly_demand
-- - Refresh mv_order_status_summary
-- =============================================================================

SELECT cron.schedule(
    'refresh_advanced_kpis',    -- Job name (unique identifier)
    '*/15 * * * *',             -- Cron expression: every 15 minutes
    $$ SELECT refresh_all_advanced_kpis(); $$  -- SQL command to execute
);

-- =============================================================================
-- Useful pg_cron management commands (for reference)
-- =============================================================================

-- View all scheduled jobs:
-- SELECT * FROM cron.job;

-- View job execution history:
-- SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 20;

-- Unschedule/remove a job:
-- SELECT cron.unschedule('refresh_advanced_kpis');

-- Update job schedule (e.g., change to every 10 minutes):
-- SELECT cron.unschedule('refresh_advanced_kpis');
-- SELECT cron.schedule('refresh_advanced_kpis', '*/10 * * * *', $$ SELECT refresh_all_advanced_kpis(); $$);

-- =============================================================================
-- Alternative: Manual refresh (if pg_cron is not available)
-- =============================================================================
-- You can also trigger a refresh manually:
-- SELECT refresh_all_advanced_kpis();
--
-- Or use Supabase Scheduled Functions (Edge Functions with cron triggers)
-- See README_DASHBOARD_INTEGRATION.md for setup instructions.
-- =============================================================================
