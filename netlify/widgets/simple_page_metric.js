/**
 * Simple Page Metric Widget
 *
 * Small per-page widget for vendor.html and rider.html to show
 * Orders (today) in a small card. Refreshes every 15 minutes.
 *
 * USAGE:
 * Include this script in vendor.html or rider.html just before </body>:
 * <script src="/netlify/widgets/simple_page_metric.js"></script>
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
   * Create the widget container and insert it into the page
   * @returns {HTMLElement|null} - The widget container element or null if not found
   */
  function createWidgetContainer() {
    // Find the dashboard screen
    var dashboardScreen = document.getElementById("dashboardScreen");
    if (!dashboardScreen) {
      return null;
    }

    // Find the main content section
    var mainSection = dashboardScreen.querySelector("main.content");
    if (!mainSection) {
      mainSection = dashboardScreen.querySelector("main");
    }
    if (!mainSection) {
      return null;
    }

    // Create widget container
    var container = document.createElement("section");
    container.id = "simpleMetricWidget";
    container.className = "panel";
    container.style.marginBottom = "12px";
    container.style.padding = "12px";
    container.innerHTML =
      '<div style="display: flex; justify-content: space-between; align-items: center;">' +
      '<div style="display: flex; align-items: center; gap: 12px;">' +
      '<span style="font-size: 24px;">📦</span>' +
      "<div>" +
      '<div style="font-size: 12px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.5px;">Orders Today</div>' +
      '<div id="ordersMetricValue" style="font-size: 28px; font-weight: 700; color: #3b82f6;">—</div>' +
      "</div>" +
      "</div>" +
      '<div id="metricLastUpdated" style="font-size: 11px; color: var(--muted);">Loading...</div>' +
      "</div>";

    // Insert at the beginning of main
    mainSection.insertBefore(container, mainSection.firstChild);

    return container;
  }

  /**
   * Render the metric value
   * @param {Object} data - Metrics data from API
   */
  function renderMetric(data) {
    var valueEl = document.getElementById("ordersMetricValue");
    var lastUpdatedEl = document.getElementById("metricLastUpdated");

    if (!valueEl) {
      return;
    }

    // Calculate orders today
    var ordersToday = calculateOrdersToday(data.order_status);

    // Update value with animation
    valueEl.textContent = escapeHtml(String(ordersToday));

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
    var valueEl = document.getElementById("ordersMetricValue");
    var lastUpdatedEl = document.getElementById("metricLastUpdated");

    if (valueEl) {
      valueEl.textContent = "—";
      valueEl.style.color = "#ef4444";
    }

    if (lastUpdatedEl) {
      lastUpdatedEl.innerHTML =
        '<span style="color: #ef4444;">⚠️ Error</span> ' +
        '<button onclick="window.refreshSimpleMetric()" class="linklike" style="font-size: 11px;">Retry</button>';
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
          renderMetric(data);
        } else {
          showError(data.error || "Failed to load metrics");
        }
      })
      .catch(function (error) {
        console.error("[SimpleMetricWidget] Fetch error:", error);
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
      // Dashboard might not be visible yet, retry after a short delay
      setTimeout(init, 1000);
      return;
    }

    // Initial fetch
    fetchMetrics();

    // Set up auto-refresh
    setInterval(fetchMetrics, REFRESH_INTERVAL_MS);

    // Expose refresh function globally
    window.refreshSimpleMetric = fetchMetrics;

    console.log("[SimpleMetricWidget] Initialized successfully");
  }

  // Start initialization
  init();
})();
