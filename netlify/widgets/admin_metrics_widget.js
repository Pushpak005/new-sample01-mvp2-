/**
 * Admin Metrics Widget
 *
 * Minimal admin widget that fetches /.netlify/functions/get_metrics
 * and renders 3 compact KPI cards: GMV (7d), Orders (today), Top SKUs (7d).
 * Refreshes every 15 minutes.
 *
 * USAGE:
 * Include this script in admin.html just before </body>:
 * <script src="/netlify/widgets/admin_metrics_widget.js"></script>
 */

(function () {
  "use strict";

  // Configuration
  var REFRESH_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes
  var METRICS_ENDPOINT = "/.netlify/functions/get_metrics";

  /**
   * Escape HTML to prevent XSS attacks
   * @param {string} str - String to escape
   * @returns {string} - Escaped string
   */
  function escapeHtml(str) {
    var div = document.createElement("div");
    div.textContent = String(str || "");
    return div.innerHTML;
  }

  /**
   * Format currency value
   * @param {number} value - Value to format
   * @returns {string} - Formatted currency string
   */
  function formatCurrency(value) {
    if (typeof value !== "number" || isNaN(value)) {
      return "₹0";
    }
    if (value >= 100000) {
      return "₹" + (value / 100000).toFixed(1) + "L";
    } else if (value >= 1000) {
      return "₹" + (value / 1000).toFixed(1) + "K";
    }
    return "₹" + value.toFixed(0);
  }

  /**
   * Calculate GMV for last 7 days from daily_gmv data
   * @param {Array} dailyGmv - Array of daily GMV records
   * @returns {number} - Total GMV for last 7 days
   */
  function calculateGmv7d(dailyGmv) {
    if (!Array.isArray(dailyGmv) || dailyGmv.length === 0) {
      return 0;
    }

    var now = new Date();
    var sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    var total = 0;
    dailyGmv.forEach(function (record) {
      var recordDate = new Date(record.order_date || record.date);
      if (recordDate >= sevenDaysAgo) {
        total += parseFloat(record.total_gmv || record.gmv || 0);
      }
    });

    return total;
  }

  /**
   * Calculate orders placed today from order_status data
   * @param {Array} orderStatus - Array of order status records
   * @returns {number} - Total orders today
   */
  function calculateOrdersToday(orderStatus) {
    if (!Array.isArray(orderStatus) || orderStatus.length === 0) {
      return 0;
    }

    var total = 0;
    orderStatus.forEach(function (record) {
      total += parseInt(record.order_count || record.count || 0, 10);
    });

    return total;
  }

  /**
   * Get top SKUs for last 7 days
   * @param {Array} topSkus - Array of top SKU records
   * @returns {Array} - Top 5 SKUs with name and count
   */
  function getTopSkus7d(topSkus) {
    if (!Array.isArray(topSkus) || topSkus.length === 0) {
      return [];
    }

    // Sort by order count and take top 5
    var sorted = topSkus
      .slice()
      .sort(function (a, b) {
        var countA = parseInt(a.order_count || a.count || 0, 10);
        var countB = parseInt(b.order_count || b.count || 0, 10);
        return countB - countA;
      })
      .slice(0, 5);

    return sorted.map(function (sku) {
      return {
        name: sku.dish_title || sku.sku_name || sku.name || "Unknown",
        count: parseInt(sku.order_count || sku.count || 0, 10),
      };
    });
  }

  /**
   * Create the widget container and insert it into the page
   * @returns {HTMLElement} - The widget container element
   */
  function createWidgetContainer() {
    // Find the dashboard screen to insert the widget
    var dashboardScreen = document.getElementById("dashboardScreen");
    if (!dashboardScreen) {
      console.warn("[AdminMetricsWidget] Dashboard screen not found");
      return null;
    }

    // Find the main section or create insertion point
    var mainSection = dashboardScreen.querySelector("main");
    if (!mainSection) {
      console.warn("[AdminMetricsWidget] Main section not found");
      return null;
    }

    // Create widget container
    var container = document.createElement("section");
    container.id = "adminMetricsWidget";
    container.className = "panel";
    container.style.marginBottom = "16px";
    container.innerHTML =
      '<div class="row-between">' +
      "<h3>📊 Key Metrics</h3>" +
      '<div id="metricsLastUpdated" style="color: var(--muted); font-size: 12px;">Loading...</div>' +
      "</div>" +
      '<div id="metricsCards" class="metrics" style="margin-top: 12px;">' +
      '<div style="text-align: center; padding: 20px; color: var(--muted);">⏳ Loading metrics...</div>' +
      "</div>";

    // Insert at the beginning of main
    mainSection.insertBefore(container, mainSection.firstChild);

    return container;
  }

  /**
   * Render the KPI cards
   * @param {Object} data - Metrics data from API
   */
  function renderMetrics(data) {
    var cardsContainer = document.getElementById("metricsCards");
    var lastUpdatedEl = document.getElementById("metricsLastUpdated");

    if (!cardsContainer) {
      return;
    }

    // Calculate metrics
    var gmv7d = calculateGmv7d(data.daily_gmv);
    var ordersToday = calculateOrdersToday(data.order_status);
    var topSkus = getTopSkus7d(data.top_skus);

    // Format top SKUs for display
    var topSkusHtml = "";
    if (topSkus.length > 0) {
      topSkusHtml = topSkus
        .map(function (sku, index) {
          return (
            '<div style="font-size: 11px; display: flex; justify-content: space-between; padding: 2px 0;">' +
            '<span style="color: var(--muted);">' +
            (index + 1) +
            ". " +
            escapeHtml(sku.name) +
            "</span>" +
            '<span style="font-weight: 600;">' +
            sku.count +
            "</span>" +
            "</div>"
          );
        })
        .join("");
    } else {
      topSkusHtml =
        '<div style="font-size: 11px; color: var(--muted);">No data</div>';
    }

    // Render cards
    cardsContainer.innerHTML =
      '<div class="metric">' +
      '<div class="label">GMV (7d)</div>' +
      '<div class="value" style="color: #10b981;">' +
      escapeHtml(formatCurrency(gmv7d)) +
      "</div>" +
      "</div>" +
      '<div class="metric">' +
      '<div class="label">Orders (Today)</div>' +
      '<div class="value" style="color: #3b82f6;">' +
      escapeHtml(String(ordersToday)) +
      "</div>" +
      "</div>" +
      '<div class="metric" style="min-width: 140px;">' +
      '<div class="label">Top SKUs (7d)</div>' +
      '<div style="margin-top: 4px;">' +
      topSkusHtml +
      "</div>" +
      "</div>";

    // Update timestamp
    if (lastUpdatedEl) {
      var now = new Date();
      lastUpdatedEl.textContent =
        "Updated " +
        now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
    }
  }

  /**
   * Show error state in the widget
   * @param {string} message - Error message
   */
  function showError(message) {
    var cardsContainer = document.getElementById("metricsCards");
    var lastUpdatedEl = document.getElementById("metricsLastUpdated");

    if (cardsContainer) {
      cardsContainer.innerHTML =
        '<div style="text-align: center; padding: 20px; color: #ef4444;">' +
        "⚠️ " +
        escapeHtml(message) +
        '<br><button onclick="window.refreshAdminMetrics()" class="linklike" style="margin-top: 8px;">Retry</button>' +
        "</div>";
    }

    if (lastUpdatedEl) {
      lastUpdatedEl.textContent = "Error";
    }
  }

  /**
   * Fetch metrics from the API
   */
  function fetchMetrics() {
    fetch(METRICS_ENDPOINT)
      .then(function (response) {
        if (!response.ok) {
          throw new Error("HTTP " + response.status);
        }
        return response.json();
      })
      .then(function (data) {
        if (data.success) {
          renderMetrics(data);
        } else {
          showError(data.error || "Failed to load metrics");
        }
      })
      .catch(function (error) {
        console.error("[AdminMetricsWidget] Fetch error:", error);
        showError("Unable to load metrics");
      });
  }

  /**
   * Initialize the widget
   */
  function init() {
    // Wait for DOM to be ready
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", init);
      return;
    }

    // Create widget container
    var container = createWidgetContainer();
    if (!container) {
      console.warn(
        "[AdminMetricsWidget] Could not create widget container, retrying in 1s..."
      );
      // Retry after a short delay in case dashboard is dynamically shown
      setTimeout(init, 1000);
      return;
    }

    // Initial fetch
    fetchMetrics();

    // Set up auto-refresh
    setInterval(fetchMetrics, REFRESH_INTERVAL_MS);

    // Expose refresh function globally
    window.refreshAdminMetrics = fetchMetrics;

    console.log("[AdminMetricsWidget] Initialized successfully");
  }

  // Start initialization
  init();
})();
