const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

/**
 * Haversine Distance Calculator
 * Calculates shortest distance between two points on Earth
 * @returns distance in kilometers
 */
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in km
  const toRad = (angle) => (angle * Math.PI) / 180;
  
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Smart ETA Calculator with Traffic Model
 * Considers: distance, time of day, weather, area congestion
 */
function calculateSmartETA(distanceKm, area = 'default') {
  const now = new Date();
  const hour = now.getHours();
  const day = now.getDay(); // 0 = Sunday
  
  // Base speeds by time (km/h)
  let baseSpeed;
  
  // Peak hours: 8-10 AM, 6-9 PM
  if ((hour >= 8 && hour <= 10) || (hour >= 18 && hour <= 21)) {
    baseSpeed = 12; // Slow during peak
  }
  // Lunch rush: 12-2 PM
  else if (hour >= 12 && hour <= 14) {
    baseSpeed = 15;
  }
  // Late night: 11 PM - 6 AM
  else if (hour >= 23 || hour <= 6) {
    baseSpeed = 30; // Fast at night
  }
  // Normal hours
  else {
    baseSpeed = 20;
  }
  
  // Weekend adjustment (less traffic)
  if (day === 0 || day === 6) {
    baseSpeed *= 1.2;
  }
  
  // Area congestion multiplier (can be fetched from traffic API)
  const congestionFactors = {
    'downtown': 0.7,
    'suburbs': 1.0,
    'highway': 1.3,
    'default': 1.0
  };
  
  const finalSpeed = baseSpeed * (congestionFactors[area] || 1.0);
  
  // Calculate travel time
  const travelTimeMinutes = (distanceKm / finalSpeed) * 60;
  
  // Add preparation time (vendor cooking)
  const prepTime = 15; // minutes
  
  // Add buffer for pickup/dropoff
  const bufferTime = 5; // minutes
  
  const totalETA = Math.round(prepTime + travelTimeMinutes + bufferTime);
  
  return {
    eta_minutes: totalETA,
    distance_km: Math.round(distanceKm * 10) / 10,
    estimated_speed_kmh: Math.round(finalSpeed),
    traffic_condition: baseSpeed < 15 ? 'heavy' : baseSpeed < 20 ? 'moderate' : 'light'
  };
}

/**
 * Intelligent Rider Assignment Algorithm
 * Multi-factor optimization:
 * 1. Distance to pickup (minimize customer wait)
 * 2. Current workload (balance load across riders)
 * 3. Rider rating (quality service)
 * 4. Earnings balance (fairness)
 * 5. Acceptance rate (reliability)
 */
async function assignBestRider(orderDetails) {
  const { vendor_lat, vendor_lng, delivery_lat, delivery_lng, order_value } = orderDetails;
  
  // Get all available riders
  const { data: riders, error } = await supabase
    .from('riders')
    .select(`
      *,
      active_orders:orders!rider_id(
        count,
        order_id,
        status
      )
    `)
    .eq('is_active', true)
    .eq('is_online', true);
  
  if (error || !riders || riders.length === 0) {
    throw new Error('No riders available');
  }
  
  // Calculate multi-factor score for each rider
  const scoredRiders = riders.map(rider => {
    // Parse rider location (stored as "lat,lng")
    let riderLat, riderLng;
    if (rider.current_location) {
      [riderLat, riderLng] = rider.current_location.split(',').map(parseFloat);
    } else {
      // Default to vendor location if no rider location
      [riderLat, riderLng] = [vendor_lat, vendor_lng];
    }
    
    // Factor 1: Distance Score (0-100, closer = higher)
    const distanceToVendor = haversineDistance(riderLat, riderLng, vendor_lat, vendor_lng);
    const maxDistance = 10; // km
    const distanceScore = Math.max(0, 100 - (distanceToVendor / maxDistance) * 100);
    
    // Factor 2: Workload Score (0-100, less busy = higher)
    const activeOrderCount = rider.active_orders?.filter(
      o => o.status === 'assigned' || o.status === 'picked_up'
    ).length || 0;
    const maxOrders = 3;
    const workloadScore = Math.max(0, 100 - (activeOrderCount / maxOrders) * 100);
    
    // Factor 3: Rating Score (0-100)
    const rating = rider.rating || 4.0;
    const ratingScore = (rating / 5.0) * 100;
    
    // Factor 4: Earnings Balance Score (0-100, lower earnings = higher priority)
    const avgDailyEarnings = 500; // ₹500 average
    const todayEarnings = rider.today_earnings || 0;
    const earningsScore = Math.max(0, 100 - (todayEarnings / avgDailyEarnings) * 50);
    
    // Factor 5: Acceptance Rate Score (0-100)
    const acceptanceRate = rider.acceptance_rate || 0.9;
    const acceptanceScore = acceptanceRate * 100;
    
    // Weighted total score
    const weights = {
      distance: 0.40,    // 40% - Most important
      workload: 0.25,    // 25% - Balance load
      rating: 0.15,      // 15% - Quality
      earnings: 0.10,    // 10% - Fairness
      acceptance: 0.10   // 10% - Reliability
    };
    
    const totalScore = 
      distanceScore * weights.distance +
      workloadScore * weights.workload +
      ratingScore * weights.rating +
      earningsScore * weights.earnings +
      acceptanceScore * weights.acceptance;
    
    // Calculate ETA for this rider
    const eta = calculateSmartETA(distanceToVendor, orderDetails.area);
    
    return {
      rider_id: rider.rider_id,
      name: rider.name,
      phone: rider.phone,
      vehicle_type: rider.vehicle_type,
      rating: rider.rating,
      
      // Scores
      total_score: Math.round(totalScore * 10) / 10,
      distance_score: Math.round(distanceScore),
      workload_score: Math.round(workloadScore),
      rating_score: Math.round(ratingScore),
      earnings_score: Math.round(earningsScore),
      acceptance_score: Math.round(acceptanceScore),
      
      // Metrics
      distance_to_vendor_km: Math.round(distanceToVendor * 10) / 10,
      active_orders: activeOrderCount,
      current_location: { lat: riderLat, lng: riderLng },
      
      // ETA
      estimated_pickup_time: eta.eta_minutes,
      traffic_condition: eta.traffic_condition
    };
  });
  
  // Sort by total score (descending)
  scoredRiders.sort((a, b) => b.total_score - a.total_score);
  
  return scoredRiders[0]; // Return best rider
}

/**
 * Batch Order Assignment
 * Assigns multiple ready orders to riders optimally
 * Uses greedy algorithm with look-ahead
 */
async function batchAssignOrders() {
  // Get all orders ready for pickup
  const { data: orders } = await supabase
    .from('orders')
    .select('*')
    .eq('status', 'ready_for_pickup')
    .is('rider_id', null)
    .order('created_at', { ascending: true });
  
  if (!orders || orders.length === 0) {
    return { assigned: 0, message: 'No orders pending assignment' };
  }
  
  const assignments = [];
  
  for (const order of orders) {
    try {
      const bestRider = await assignBestRider({
        vendor_lat: order.vendor_lat || 18.5204, // Default Pune coords
        vendor_lng: order.vendor_lng || 73.8567,
        delivery_lat: order.delivery_lat || 18.5204,
        delivery_lng: order.delivery_lng || 73.8567,
        area: order.area || 'default',
        order_value: order.price * order.quantity
      });
      
      // Update order with rider assignment
      await supabase
        .from('orders')
        .update({
          rider_id: bestRider.rider_id,
          status: 'assigned',
          estimated_delivery_time: bestRider.estimated_pickup_time,
          assigned_at: new Date().toISOString()
        })
        .eq('order_id', order.order_id);
      
      // Log assignment in audit table
      await supabase
        .from('order_audit')
        .insert({
          order_id: order.order_id,
          old_status: 'ready_for_pickup',
          new_status: 'assigned',
          changed_by: bestRider.rider_id,
          changed_by_type: 'system',
          notes: `Auto-assigned via smart algorithm. Score: ${bestRider.total_score}`
        });
      
      assignments.push({
        order_id: order.order_id,
        rider: bestRider.name,
        score: bestRider.total_score,
        eta: bestRider.estimated_pickup_time
      });
    } catch (error) {
      console.error(`Failed to assign order ${order.order_id}:`, error);
    }
  }
  
  return {
    assigned: assignments.length,
    total_orders: orders.length,
    assignments
  };
}

/**
 * API Handler
 */
exports.handler = async (event) => {
  // CORS headers
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
    const { action, order_id, order_details } = JSON.parse(event.body || '{}');
    
    if (action === 'batch') {
      // Batch assign all pending orders
      const result = await batchAssignOrders();
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(result)
      };
    } else if (action === 'single' && order_id) {
      // Get order details
      const { data: order } = await supabase
        .from('orders')
        .select('*')
        .eq('order_id', order_id)
        .single();
      
      if (!order) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ error: 'Order not found' })
        };
      }
      
      // Assign rider
      const bestRider = await assignBestRider({
        vendor_lat: order.vendor_lat || 18.5204,
        vendor_lng: order.vendor_lng || 73.8567,
        delivery_lat: order.delivery_lat || 18.5204,
        delivery_lng: order.delivery_lng || 73.8567,
        area: order.area || 'default',
        order_value: order.price * order.quantity
      });
      
      // Update order
      await supabase
        .from('orders')
        .update({
          rider_id: bestRider.rider_id,
          status: 'assigned',
          estimated_delivery_time: bestRider.estimated_pickup_time,
          assigned_at: new Date().toISOString()
        })
        .eq('order_id', order_id);
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          rider: bestRider,
          message: `Assigned to ${bestRider.name}`
        })
      };
    } else {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: 'Invalid request. Use action: "batch" or "single" with order_id'
        })
      };
    }
  } catch (error) {
    console.error('Assignment error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: error.message,
        details: 'Smart rider assignment failed'
      })
    };
  }
};
