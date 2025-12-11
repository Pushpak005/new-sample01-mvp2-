const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

/**
 * Dynamic Pricing Algorithm (Zomato-style Surge Pricing)
 * 
 * Factors considered:
 * 1. Current demand (orders in last hour)
 * 2. Available supply (online riders)
 * 3. Time of day (peak hours)
 * 4. Distance from restaurant
 * 5. Weather conditions (optional)
 * 6. Day of week
 * 7. Special events
 */

async function calculateDynamicPrice(basePrice, orderDetails) {
  const {
    area,
    distance_km,
    vendor_id,
    time = new Date()
  } = orderDetails;
  
  const currentTime = new Date(time);
  const hour = currentTime.getHours();
  const day = currentTime.getDay(); // 0 = Sunday
  
  let multipliers = {
    demand: 1.0,
    supply: 1.0,
    time: 1.0,
    distance: 1.0,
    day: 1.0,
    weather: 1.0
  };
  
  // ============================================
  // Factor 1: Demand-based Surge
  // ============================================
  const oneHourAgo = new Date(currentTime.getTime() - 60 * 60 * 1000);
  
  const { data: recentOrders } = await supabase
    .from('orders')
    .select('order_id', { count: 'exact' })
    .gte('created_at', oneHourAgo.toISOString())
    .or(`area.eq.${area},vendor_id.eq.${vendor_id}`);
  
  const orderCount = recentOrders?.length || 0;
  
  // Surge tiers
  if (orderCount >= 100) {
    multipliers.demand = 2.0;  // 100% surge - Very High Demand
  } else if (orderCount >= 50) {
    multipliers.demand = 1.5;  // 50% surge - High Demand
  } else if (orderCount >= 30) {
    multipliers.demand = 1.3;  // 30% surge - Moderate-High
  } else if (orderCount >= 15) {
    multipliers.demand = 1.15; // 15% surge - Moderate
  } else {
    multipliers.demand = 1.0;  // No surge - Normal
  }
  
  // ============================================
  // Factor 2: Supply-based (Available Riders)
  // ============================================
  const { data: onlineRiders } = await supabase
    .from('riders')
    .select('rider_id, active_orders:orders!rider_id(count)', { count: 'exact' })
    .eq('is_online', true)
    .eq('is_active', true);
  
  const availableRiders = onlineRiders?.filter(r => {
    const activeCount = r.active_orders?.[0]?.count || 0;
    return activeCount < 3; // Max 3 orders per rider
  }).length || 0;
  
  // If very few riders available, increase price
  if (availableRiders === 0) {
    multipliers.supply = 1.5;  // 50% increase - No riders
  } else if (availableRiders <= 2) {
    multipliers.supply = 1.3;  // 30% increase - Very low supply
  } else if (availableRiders <= 5) {
    multipliers.supply = 1.15; // 15% increase - Low supply
  } else {
    multipliers.supply = 1.0;  // Normal supply
  }
  
  // ============================================
  // Factor 3: Time-based (Peak Hours)
  // ============================================
  
  // Breakfast: 8-10 AM
  if (hour >= 8 && hour < 10) {
    multipliers.time = 1.1; // 10% increase
  }
  // Lunch: 12-2 PM
  else if (hour >= 12 && hour < 14) {
    multipliers.time = 1.2; // 20% increase - Peak lunch
  }
  // Evening snacks: 5-6 PM
  else if (hour >= 17 && hour < 18) {
    multipliers.time = 1.1; // 10% increase
  }
  // Dinner: 7-10 PM
  else if (hour >= 19 && hour < 22) {
    multipliers.time = 1.25; // 25% increase - Peak dinner
  }
  // Late night: 10 PM - 1 AM
  else if (hour >= 22 || hour < 1) {
    multipliers.time = 1.15; // 15% increase - Late night premium
  }
  else {
    multipliers.time = 1.0; // Normal hours
  }
  
  // ============================================
  // Factor 4: Distance-based
  // ============================================
  if (distance_km > 10) {
    multipliers.distance = 1.3;  // 30% for very long distance
  } else if (distance_km > 7) {
    multipliers.distance = 1.2;  // 20% for long distance
  } else if (distance_km > 5) {
    multipliers.distance = 1.1;  // 10% for medium distance
  } else {
    multipliers.distance = 1.0;  // Normal for nearby
  }
  
  // ============================================
  // Factor 5: Day of Week
  // ============================================
  
  // Weekend surge (Friday evening, Saturday, Sunday)
  if (day === 5 && hour >= 18) { // Friday evening
    multipliers.day = 1.15;
  } else if (day === 6 || day === 0) { // Saturday or Sunday
    multipliers.day = 1.1;
  } else {
    multipliers.day = 1.0;
  }
  
  // ============================================
  // Factor 6: Weather (Simplified - can integrate weather API)
  // ============================================
  // In production, call weather API like OpenWeatherMap (free tier)
  // For now, we'll use a simple placeholder
  multipliers.weather = 1.0; // Normal weather
  
  // If raining: multipliers.weather = 1.2;
  // If storm: multipliers.weather = 1.5;
  
  // ============================================
  // Calculate Final Price
  // ============================================
  
  const totalMultiplier = 
    multipliers.demand *
    multipliers.supply *
    multipliers.time *
    multipliers.distance *
    multipliers.day *
    multipliers.weather;
  
  const finalPrice = Math.round(basePrice * totalMultiplier);
  
  // Cap maximum surge at 2x
  const cappedPrice = Math.min(finalPrice, basePrice * 2);
  
  // Calculate delivery fee separately (can be different from food price)
  const baseDeliveryFee = 30; // ₹30 base
  const deliveryFee = Math.round(baseDeliveryFee * totalMultiplier);
  
  return {
    original_price: basePrice,
    surge_multiplier: Math.round(totalMultiplier * 100) / 100,
    final_price: cappedPrice,
    delivery_fee: deliveryFee,
    total_amount: cappedPrice + deliveryFee,
    
    breakdown: {
      demand_multiplier: multipliers.demand,
      supply_multiplier: multipliers.supply,
      time_multiplier: multipliers.time,
      distance_multiplier: multipliers.distance,
      day_multiplier: multipliers.day,
      weather_multiplier: multipliers.weather
    },
    
    surge_message: getSurgeMessage(totalMultiplier, multipliers),
    
    metadata: {
      recent_orders: recentOrders?.length || 0,
      available_riders: availableRiders,
      hour: hour,
      day_name: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][day],
      distance_km: distance_km
    }
  };
}

/**
 * Generate user-friendly surge message
 */
function getSurgeMessage(totalMultiplier, multipliers) {
  if (totalMultiplier >= 1.5) {
    const reasons = [];
    
    if (multipliers.demand >= 1.3) {
      reasons.push('very high demand');
    }
    if (multipliers.supply >= 1.2) {
      reasons.push('limited riders available');
    }
    if (multipliers.time >= 1.2) {
      reasons.push('peak hours');
    }
    
    return `High demand! ${reasons.join(', ')}. Prices are higher than usual.`;
  } else if (totalMultiplier >= 1.2) {
    return 'Moderate demand. Slightly higher prices.';
  } else {
    return 'Normal pricing';
  }
}

/**
 * Get historical surge data for analytics
 */
async function getSurgeAnalytics(area, startDate, endDate) {
  // This would calculate average surge by hour, day for the area
  // Useful for predicting future surge patterns
  
  const { data: orders } = await supabase
    .from('orders')
    .select('created_at, price, surge_multiplier')
    .eq('area', area)
    .gte('created_at', startDate)
    .lte('created_at', endDate);
  
  // Group by hour
  const hourlyStats = {};
  
  orders?.forEach(order => {
    const hour = new Date(order.created_at).getHours();
    if (!hourlyStats[hour]) {
      hourlyStats[hour] = {
        count: 0,
        total_surge: 0,
        avg_surge: 0
      };
    }
    
    hourlyStats[hour].count++;
    hourlyStats[hour].total_surge += order.surge_multiplier || 1.0;
  });
  
  // Calculate averages
  Object.keys(hourlyStats).forEach(hour => {
    hourlyStats[hour].avg_surge = 
      hourlyStats[hour].total_surge / hourlyStats[hour].count;
  });
  
  return hourlyStats;
}

/**
 * API Handler
 */
exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };
  
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }
  
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }
  
  try {
    const {
      action = 'calculate',
      base_price,
      area,
      distance_km,
      vendor_id
    } = JSON.parse(event.body || '{}');
    
    if (action === 'calculate') {
      if (!base_price || !area) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            error: 'Missing required fields: base_price, area'
          })
        };
      }
      
      const pricing = await calculateDynamicPrice(base_price, {
        area,
        distance_km: distance_km || 3,
        vendor_id: vendor_id || 'default'
      });
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(pricing)
      };
    } else if (action === 'analytics') {
      const { start_date, end_date } = JSON.parse(event.body);
      
      const analytics = await getSurgeAnalytics(
        area,
        start_date,
        end_date
      );
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          area,
          period: { start_date, end_date },
          hourly_surge: analytics
        })
      };
    } else {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: 'Invalid action. Use "calculate" or "analytics"'
        })
      };
    }
  } catch (error) {
    console.error('Pricing error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: error.message,
        details: 'Dynamic pricing calculation failed'
      })
    };
  }
};
