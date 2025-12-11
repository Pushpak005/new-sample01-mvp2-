/**
 * Metrics API - Netlify Function
 *
 * Serverless function that queries materialized views for KPI data.
 * Uses SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to securely access database.
 *
 * MATERIALIZED VIEWS QUERIED:
 * - mv_daily_gmv: Daily gross merchandise value
 * - mv_top_skus: Top selling SKUs/dishes
 * - mv_vendor_kpis: Vendor performance metrics
 * - mv_hourly_demand: Hourly demand heatmap data
 * - mv_order_status_summary: Order status distribution
 *
 * SECURITY:
 * - SUPABASE_SERVICE_ROLE_KEY is only used server-side (never exposed to browser)
 * - Optional ADMIN_API_KEY header protection for additional security
 *
 * ENDPOINT:
 * - GET /.netlify/functions/get_metrics
 *
 * RETURNS:
 * {
 *   daily_gmv: [...],
 *   top_skus: [...],
 *   vendor_kpis: [...],
 *   hourly_demand: [...],
 *   order_status: [...]
 * }
 */

const { createClient } = require("@supabase/supabase-js");

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Optional admin API key for additional protection
const adminApiKey = process.env.ADMIN_API_KEY;

/**
 * Create Supabase client with service role key
 * This grants full access to the database, so it should only be used server-side
 */
function getSupabaseClient() {
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    console.error(
      "[get_metrics] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY"
    );
    return null;
  }

  return createClient(supabaseUrl, supabaseServiceRoleKey);
}

/**
 * Validate admin API key if configured
 * @param {Object} event - Netlify function event
 * @returns {boolean} True if authorized, false otherwise
 */
function isAuthorized(event) {
  // If no admin API key is configured, allow all requests
  if (!adminApiKey) {
    return true;
  }

  // Check for API key in headers
  const providedKey =
    event.headers["x-admin-api-key"] || event.headers["X-Admin-Api-Key"];

  return providedKey === adminApiKey;
}

/**
 * Query a materialized view safely
 * @param {Object} supabase - Supabase client
 * @param {string} viewName - Name of the materialized view
 * @returns {Promise<Array>} Query results or empty array on error
 */
async function queryMaterializedView(supabase, viewName) {
  try {
    const { data, error } = await supabase.from(viewName).select("*");

    if (error) {
      console.error(`[get_metrics] Error querying ${viewName}:`, error.message);
      return [];
    }

    return data || [];
  } catch (err) {
    console.error(`[get_metrics] Exception querying ${viewName}:`, err.message);
    return [];
  }
}

/**
 * Main handler for the get_metrics API
 */
exports.handler = async function (event, context) {
  // CORS headers
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, X-Admin-Api-Key",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Content-Type": "application/json",
  };

  // Handle OPTIONS (preflight)
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers,
      body: "",
    };
  }

  // Only allow GET requests
  if (event.httpMethod !== "GET") {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({
        error: "Method not allowed",
        message: "Use GET to retrieve metrics",
      }),
    };
  }

  // Check authorization if ADMIN_API_KEY is configured
  if (!isAuthorized(event)) {
    console.warn("[get_metrics] Unauthorized request - invalid API key");
    return {
      statusCode: 401,
      headers,
      body: JSON.stringify({
        error: "Unauthorized",
        message:
          "Invalid or missing X-Admin-Api-Key header",
      }),
    };
  }

  // Get Supabase client
  const supabase = getSupabaseClient();

  if (!supabase) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: "Configuration error",
        message:
          "Database connection not configured. Check SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables.",
      }),
    };
  }

  try {
    console.log("[get_metrics] Fetching metrics from materialized views...");

    // Query all materialized views in parallel for efficiency
    const [dailyGmv, topSkus, vendorKpis, hourlyDemand, orderStatus] =
      await Promise.all([
        queryMaterializedView(supabase, "mv_daily_gmv"),
        queryMaterializedView(supabase, "mv_top_skus"),
        queryMaterializedView(supabase, "mv_vendor_kpis"),
        queryMaterializedView(supabase, "mv_hourly_demand"),
        queryMaterializedView(supabase, "mv_order_status_summary"),
      ]);

    console.log("[get_metrics] Successfully fetched metrics:", {
      daily_gmv_count: dailyGmv.length,
      top_skus_count: topSkus.length,
      vendor_kpis_count: vendorKpis.length,
      hourly_demand_count: hourlyDemand.length,
      order_status_count: orderStatus.length,
    });

    // Return compact JSON payload
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        timestamp: new Date().toISOString(),
        daily_gmv: dailyGmv,
        top_skus: topSkus,
        vendor_kpis: vendorKpis,
        hourly_demand: hourlyDemand,
        order_status: orderStatus,
      }),
    };
  } catch (error) {
    console.error("[get_metrics] Error fetching metrics:", error);

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: "Internal server error",
        message: error.message,
      }),
    };
  }
};
