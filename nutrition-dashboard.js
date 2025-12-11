// nutrition-dashboard.js
// Nutrition Dashboard Logic

// Get personalized goals based on user profile and wearable data
function getPersonalizedGoals() {
  const prefs = JSON.parse(localStorage.getItem('prefs') || '{}');
  const wearable = JSON.parse(localStorage.getItem('lastWearable') || '{}');
  
  // Base values (average adult)
  let goals = {
    calories: 2000,
    protein_g: 50,
    carbs_g: 250,
    fat_g: 65,
    fiber_g: 25,
    sodium_mg: 2300,
    // Micronutrients (daily values)
    iron_mg: 18,
    calcium_mg: 1000,
    vitamin_a_mcg: 900,
    vitamin_c_mg: 90,
    vitamin_d_mcg: 20,
    vitamin_b12_mcg: 2.4
  };
  
  // Adjust calories based on activity level
  if (wearable.caloriesBurned) {
    const activityBonus = Math.min(wearable.caloriesBurned, 800); // Cap at 800
    goals.calories += activityBonus;
  }
  
  // Adjust protein for high activity
  if (wearable.caloriesBurned && wearable.caloriesBurned > 400) {
    goals.protein_g = Math.round(goals.protein_g * 1.3); // 30% increase for active days
  }
  
  // Adjust sodium for high BP
  if (wearable.bpSystolic && wearable.bpSystolic >= 130) {
    goals.sodium_mg = 1500; // Lower limit for hypertension
  }
  
  // Adjust iron for vegetarians (need more due to lower bioavailability)
  if (prefs.diet === 'veg') {
    goals.iron_mg = Math.round(goals.iron_mg * 1.8);
  }
  
  return goals;
}

// Daily recommended values (personalized)
const DAILY_GOALS = getPersonalizedGoals();

// Load state from localStorage
function loadState() {
  const today = new Date().toISOString().split('T')[0];
  const stored = localStorage.getItem('nutritionData');
  
  if (!stored) {
    return { date: today, meals: [], totals: {} };
  }
  
  const data = JSON.parse(stored);
  
  // Reset if it's a new day
  if (data.date !== today) {
    return { date: today, meals: [], totals: {} };
  }
  
  return data;
}

// Save state to localStorage
function saveState(state) {
  localStorage.setItem('nutritionData', JSON.stringify(state));
}

// Calculate totals from meals
function calculateTotals(meals) {
  const totals = {
    calories: 0,
    protein_g: 0,
    carbs_g: 0,
    fat_g: 0,
    fiber_g: 0,
    sodium_mg: 0,
    iron_mg: 0,
    calcium_mg: 0,
    vitamin_a_mcg: 0,
    vitamin_c_mg: 0,
    vitamin_d_mcg: 0,
    vitamin_b12_mcg: 0
  };
  
  meals.forEach(meal => {
    if (meal.macros) {
      totals.calories += meal.macros.kcal || 0;
      totals.protein_g += meal.macros.protein_g || 0;
      totals.carbs_g += meal.macros.carbs_g || 0;
      totals.fat_g += meal.macros.fat_g || 0;
      totals.fiber_g += meal.macros.fiber_g || 0;
      totals.sodium_mg += meal.macros.sodium_mg || 0;
    }
    if (meal.micros) {
      totals.iron_mg += meal.micros.iron_mg || 0;
      totals.calcium_mg += meal.micros.calcium_mg || 0;
      totals.vitamin_a_mcg += meal.micros.vitamin_a_mcg || 0;
      totals.vitamin_c_mg += meal.micros.vitamin_c_mg || 0;
      totals.vitamin_d_mcg += meal.micros.vitamin_d_mcg || 0;
      totals.vitamin_b12_mcg += meal.micros.vitamin_b12_mcg || 0;
    }
  });
  
  return totals;
}

// Update UI with current data
function updateDashboard() {
  const state = loadState();
  state.totals = calculateTotals(state.meals);
  saveState(state);
  
  // Update macros
  updateMacroStat('calories', state.totals.calories, DAILY_GOALS.calories, 'kcal');
  updateMacroStat('protein', state.totals.protein_g, DAILY_GOALS.protein_g, 'g');
  updateMacroStat('carbs', state.totals.carbs_g, DAILY_GOALS.carbs_g, 'g');
  updateMacroStat('fat', state.totals.fat_g, DAILY_GOALS.fat_g, 'g');
  
  // Update micros
  updateMicronutrient('iron', state.totals.iron_mg, DAILY_GOALS.iron_mg);
  updateMicronutrient('calcium', state.totals.calcium_mg, DAILY_GOALS.calcium_mg);
  updateMicronutrient('vitaminA', state.totals.vitamin_a_mcg, DAILY_GOALS.vitamin_a_mcg);
  updateMicronutrient('vitaminC', state.totals.vitamin_c_mg, DAILY_GOALS.vitamin_c_mg);
  updateMicronutrient('vitaminD', state.totals.vitamin_d_mcg, DAILY_GOALS.vitamin_d_mcg);
  updateMicronutrient('vitaminB12', state.totals.vitamin_b12_mcg, DAILY_GOALS.vitamin_b12_mcg);
  
  // Update meals timeline
  renderMeals(state.meals);
  
  // Generate insights
  generateInsights(state.totals);
}

// Update macro stat card
function updateMacroStat(name, consumed, goal, unit) {
  const percent = Math.min(Math.round((consumed / goal) * 100), 100);
  const remaining = Math.max(goal - consumed, 0);
  
  document.getElementById(`${name}-consumed`).textContent = Math.round(consumed);
  document.getElementById(`${name}-bar`).style.width = percent + '%';
  document.getElementById(`${name}-remaining`).textContent = Math.round(remaining) + unit + ' remaining';
  document.getElementById(`${name}-percent`).textContent = percent + '%';
}

// Update micronutrient bar
function updateMicronutrient(name, consumed, goal) {
  const percent = Math.min(Math.round((consumed / goal) * 100), 150); // Cap at 150%
  const barEl = document.getElementById(`${name}-bar`);
  const valueEl = document.getElementById(`${name}-value`);
  
  barEl.style.width = percent + '%';
  valueEl.textContent = percent + '%';
  
  // Color coding
  if (percent < 50) {
    valueEl.className = 'micro-value micro-deficient';
  } else if (percent >= 50 && percent <= 120) {
    valueEl.className = 'micro-value micro-good';
  } else {
    valueEl.className = 'micro-value micro-excess';
  }
}

// Render meals timeline
function renderMeals(meals) {
  const container = document.getElementById('meals-container');
  
  if (meals.length === 0) {
    container.innerHTML = '<p class="muted">No meals logged yet. <a href="#" onclick="logMeal(); return false;">Log your first meal</a></p>';
    return;
  }
  
  const html = meals.map(meal => `
    <div class="timeline-item">
      <div class="timeline-time">${meal.time}</div>
      <div class="timeline-meal">
        <strong>${meal.name}</strong>
        <div class="muted small">${meal.description || ''}</div>
      </div>
      <div class="timeline-calories">${Math.round(meal.macros?.kcal || 0)} kcal</div>
    </div>
  `).join('');
  
  container.innerHTML = html;
}

// Generate AI-powered insights
function generateInsights(totals) {
  const container = document.getElementById('insights-container');
  const insights = [];
  
  // Protein insight
  const proteinPercent = (totals.protein_g / DAILY_GOALS.protein_g) * 100;
  if (proteinPercent < 50) {
    insights.push({
      icon: '🥩',
      text: `You're at ${Math.round(proteinPercent)}% of your protein goal. Add protein-rich foods like paneer, chicken, or dal to your next meal.`,
      type: 'warning'
    });
  } else if (proteinPercent >= 80) {
    insights.push({
      icon: '✅',
      text: `Great job! You've met ${Math.round(proteinPercent)}% of your protein goal.`,
      type: 'success'
    });
  }
  
  // Iron insight (especially important for women)
  const ironPercent = (totals.iron_mg / DAILY_GOALS.iron_mg) * 100;
  if (ironPercent < 40) {
    insights.push({
      icon: '🩸',
      text: `Your iron intake is low (${Math.round(ironPercent)}%). Consider adding spinach, rajma, or fortified foods.`,
      type: 'warning'
    });
  }
  
  // Sodium insight
  const sodiumPercent = (totals.sodium_mg / DAILY_GOALS.sodium_mg) * 100;
  if (sodiumPercent > 80) {
    insights.push({
      icon: '🧂',
      text: `Sodium intake is high (${Math.round(sodiumPercent)}%). Your wearable shows elevated BP - try low-sodium options.`,
      type: 'alert'
    });
  }
  
  // Vitamin D insight
  const vitDPercent = (totals.vitamin_d_mcg / DAILY_GOALS.vitamin_d_mcg) * 100;
  if (vitDPercent < 30) {
    insights.push({
      icon: '☀️',
      text: `Vitamin D is low. Get 15 minutes of sunlight or add fortified foods, eggs, or mushrooms.`,
      type: 'info'
    });
  }
  
  // Balanced meal insight
  const macroBalance = {
    protein: (totals.protein_g * 4 / totals.calories) * 100,
    carbs: (totals.carbs_g * 4 / totals.calories) * 100,
    fat: (totals.fat_g * 9 / totals.calories) * 100
  };
  
  if (macroBalance.protein < 15) {
    insights.push({
      icon: '⚖️',
      text: `Your meals are low in protein (${Math.round(macroBalance.protein)}% of calories). Aim for 15-30% for better satiety.`,
      type: 'info'
    });
  }
  
  // Fiber insight
  const fiberPercent = (totals.fiber_g / DAILY_GOALS.fiber_g) * 100;
  if (fiberPercent < 40) {
    insights.push({
      icon: '🌾',
      text: `Boost your fiber intake with whole grains, fruits, and vegetables for better digestion.`,
      type: 'info'
    });
  }
  
  // If no insights, show positive message
  if (insights.length === 0) {
    insights.push({
      icon: '🎉',
      text: 'Excellent nutrition balance today! Keep up the great work.',
      type: 'success'
    });
  }
  
  const html = insights.map(insight => `
    <div class="insight-item">
      <span class="insight-icon">${insight.icon}</span>
      <span>${insight.text}</span>
    </div>
  `).join('');
  
  container.innerHTML = html;
}

// Log a new meal (simplified - would open a modal in full implementation)
function logMeal() {
  alert('Meal logging feature coming soon! For now, meals are logged automatically from "Today\'s Picks".');
}

// Refresh data
function refreshData() {
  updateDashboard();
}

// Export data as JSON
function exportData() {
  const state = loadState();
  const dataStr = JSON.stringify(state, null, 2);
  const dataBlob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(dataBlob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `nutrition-data-${state.date}.json`;
  link.click();
}

// ============================================================================
// METRICS API INTEGRATION
// ============================================================================

/**
 * Load metrics from the Netlify function endpoint
 * 
 * Fetches KPI data from materialized views via /.netlify/functions/get_metrics
 * and calls render helper functions to display the data.
 * 
 * If render helper functions don't exist, warnings are logged but the app won't crash.
 * 
 * @param {Object} options - Optional configuration
 * @param {string} options.apiKey - Admin API key if ADMIN_API_KEY is configured
 */
async function loadMetrics(options = {}) {
  const metricsUrl = '/.netlify/functions/get_metrics';
  
  try {
    console.log('[loadMetrics] Fetching metrics from:', metricsUrl);
    
    // Build headers
    const headers = {
      'Content-Type': 'application/json'
    };
    
    // Add admin API key if provided
    if (options.apiKey) {
      headers['X-Admin-Api-Key'] = options.apiKey;
    }
    
    const response = await fetch(metricsUrl, {
      method: 'GET',
      headers
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.message || 'Unknown error fetching metrics');
    }
    
    console.log('[loadMetrics] Successfully fetched metrics:', {
      timestamp: data.timestamp,
      daily_gmv_count: data.daily_gmv?.length || 0,
      top_skus_count: data.top_skus?.length || 0,
      vendor_kpis_count: data.vendor_kpis?.length || 0,
      hourly_demand_count: data.hourly_demand?.length || 0,
      order_status_count: data.order_status?.length || 0
    });
    
    // Call render helper functions if they exist
    // NOTE: Adapt these function names if your helpers are named differently
    
    if (typeof renderGmvChart === 'function') {
      renderGmvChart(data.daily_gmv);
    } else {
      console.warn('[loadMetrics] renderGmvChart not found - skipping daily GMV chart');
    }
    
    if (typeof renderTopSkus === 'function') {
      renderTopSkus(data.top_skus);
    } else {
      console.warn('[loadMetrics] renderTopSkus not found - skipping top SKUs render');
    }
    
    if (typeof renderVendorKpis === 'function') {
      renderVendorKpis(data.vendor_kpis);
    } else {
      console.warn('[loadMetrics] renderVendorKpis not found - skipping vendor KPIs render');
    }
    
    if (typeof renderHourlyHeatmap === 'function') {
      renderHourlyHeatmap(data.hourly_demand);
    } else {
      console.warn('[loadMetrics] renderHourlyHeatmap not found - skipping hourly heatmap');
    }
    
    if (typeof renderOrderStatusSummary === 'function') {
      renderOrderStatusSummary(data.order_status);
    } else {
      console.warn('[loadMetrics] renderOrderStatusSummary not found - skipping order status summary');
    }
    
    return data;
    
  } catch (error) {
    console.error('[loadMetrics] Error fetching metrics:', error.message);
    
    // Don't crash the app - log and return null
    // The dashboard can still function with local nutrition tracking
    return null;
  }
}

// Initialize dashboard on page load
document.addEventListener('DOMContentLoaded', () => {
  updateDashboard();
  
  // Load metrics from the API (if available)
  // This runs asynchronously and won't block the nutrition dashboard
  loadMetrics().then(data => {
    if (data) {
      console.log('[DOMContentLoaded] Metrics loaded successfully');
    } else {
      console.log('[DOMContentLoaded] Metrics not available - continuing with local data only');
    }
  });
  
  // Auto-refresh nutrition dashboard every 5 minutes
  setInterval(updateDashboard, 5 * 60 * 1000);
  
  // Refresh metrics every 15 minutes (aligned with backend materialized view refresh)
  setInterval(loadMetrics, 15 * 60 * 1000);
});
