/**
 * Orders API - Netlify Function
 * 
 * Manages order creation, retrieval, and status updates for the healthy food delivery system.
 * 
 * ENDPOINTS:
 * - POST /api/orders - Create a new order
 * - GET /api/orders - Retrieve orders (with filters: user, vendor, rider, admin)
 * - POST /api/orders/status - Update order status
 * 
 * ORDER SCHEMA:
 * {
 *   order_id: string,        // Unique order ID (e.g., "ord_1234567890_abc")
 *   user_id: string,         // User who placed the order
 *   vendor_id: string,       // Restaurant/vendor ID
 *   vendor_name: string,     // Restaurant name
 *   dish_id: string,         // Dish/item ID
 *   dish_title: string,      // Dish name
 *   quantity: number,        // Number of items ordered
 *   price: number,           // Price per item (in rupees)
 *   address: string,         // Delivery address
 *   phone: string,           // Customer phone number
 *   status: string,          // Order status (placed, accepted, preparing, ready_for_pickup, out_for_delivery, delivered, cancelled)
 *   rider_id: string|null,   // Assigned rider ID (null if not assigned)
 *   created_at: string,      // ISO timestamp when order was created
 *   updated_at: string       // ISO timestamp when order was last updated
 * }
 * 
 * STORAGE:
 * Uses Supabase (PostgreSQL) as primary persistent storage.
 * In-memory storage (Map) is kept as backup/fallback.
 */

// ============================================================================
// SUPABASE INTEGRATION
// ============================================================================

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('[supabase] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables');
  console.error('[supabase] Will fall back to in-memory storage only');
}

const supabase = supabaseUrl && supabaseServiceRoleKey 
  ? createClient(supabaseUrl, supabaseServiceRoleKey)
  : null;

if (supabase) {
  console.log('[supabase] Client initialized successfully');
}

// ============================================================================
// IN-MEMORY STORAGE (backup/fallback)
// ============================================================================

// Global storage (persists across function invocations within same container)
// NOTE: This will be lost when Netlify spins down the container
let ordersStore = new Map();
let orderCounter = 0;

// ============================================================================
// RIDER REJECTION TRACKING (prototype-level monthly limits)
// ============================================================================

/**
 * Rider rejection statistics - tracks monthly rejection counts
 * 
 * PROTOTYPE NOTE: This is an in-memory approximation of marketplace rejection limits.
 * Each rider can reject up to 3 orders per calendar month. After that, they must
 * accept orders or contact operations.
 * 
 * Structure: { riderId: { currentMonth: 'YYYY-MM', rejects: number } }
 * 
 * PRODUCTION TODO:
 * - Store in database with proper persistence
 * - Add audit trail of rejected orders
 * - Implement admin override capability
 * - Add notifications when riders approach their limit
 * - Consider dynamic limits based on rider performance/tenure
 */
let riderStats = {
  rider01: { currentMonth: null, rejects: 0 },
  rider02: { currentMonth: null, rejects: 0 },
  rider03: { currentMonth: null, rejects: 0 }
};

// ============================================================================
// DEMO RIDER CONFIGURATION
// ============================================================================

/**
 * Demo riders for prototype auto-assignment
 * 
 * PRODUCTION TODO: Replace with database-backed rider management
 * - Store riders in Supabase/DB with real-time availability status
 * - Include actual location tracking (lat/lng)
 * - Add rider shift schedules, breaks, capacity limits
 * - Implement zone-based matching with vendor locations
 */
const DEMO_RIDERS = [
  { id: 'rider01', name: 'Raj Kumar', zone: 'HSR Layout' },
  { id: 'rider02', name: 'Anita', zone: 'BTM Layout' },
  { id: 'rider03', name: 'Suresh', zone: 'Koramangala' }
];

/**
 * Maximum rejections allowed per rider per calendar month
 */
const MAX_REJECTIONS_PER_MONTH = 3;

/**
 * Get current month string in YYYY-MM format
 */
function getCurrentMonthString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

/**
 * Check if a rider can reject more orders this month
 * @param {string} riderId - Rider ID to check
 * @returns {boolean} True if rider can still reject, false if limit reached
 */
function canRiderReject(riderId) {
  const currentMonth = getCurrentMonthString();
  const stats = riderStats[riderId];
  
  if (!stats) {
    // Initialize stats for unknown rider
    riderStats[riderId] = { currentMonth, rejects: 0 };
    return true;
  }
  
  // Reset counter if it's a new month
  if (stats.currentMonth !== currentMonth) {
    stats.currentMonth = currentMonth;
    stats.rejects = 0;
    return true;
  }
  
  return stats.rejects < MAX_REJECTIONS_PER_MONTH;
}

/**
 * Record a rejection by a rider
 * @param {string} riderId - Rider ID who rejected
 */
function recordRejection(riderId) {
  const currentMonth = getCurrentMonthString();
  
  if (!riderStats[riderId]) {
    riderStats[riderId] = { currentMonth, rejects: 1 };
  } else {
    if (riderStats[riderId].currentMonth !== currentMonth) {
      riderStats[riderId].currentMonth = currentMonth;
      riderStats[riderId].rejects = 1;
    } else {
      riderStats[riderId].rejects++;
    }
  }
  
  console.log(`[REJECTION] Rider ${riderId} rejection count: ${riderStats[riderId].rejects}/${MAX_REJECTIONS_PER_MONTH} for ${currentMonth}`);
}

/**
 * Choose the next suitable rider for an order
 * 
 * ALGORITHM:
 * - Excludes riders already in the order's candidate_riders list (previously offered/rejected)
 * - Excludes riders who have reached their monthly rejection limit
 * - Among remaining riders, selects the one with the lowest active order load
 * 
 * @param {Object} order - The order to assign
 * @param {Array} allOrders - All orders in the system (for load calculation)
 * @returns {Object|null} Selected rider {id, name, zone} or null if none available
 */
function chooseNextRider(order, allOrders) {
  console.log(`[CHOOSE-RIDER] Finding next rider for order ${order.order_id}`);
  
  if (DEMO_RIDERS.length === 0) {
    console.log('[CHOOSE-RIDER] No riders available in demo configuration');
    return null;
  }
  
  // Get list of riders to exclude
  const excludedRiders = new Set(order.candidate_riders || []);
  
  // Filter available riders
  const availableRiders = DEMO_RIDERS.filter(rider => {
    // Skip if already tried
    if (excludedRiders.has(rider.id)) {
      console.log(`[CHOOSE-RIDER] Excluding ${rider.id} (${rider.name}): already offered`);
      return false;
    }
    
    // Skip if rider has reached rejection limit
    if (!canRiderReject(rider.id)) {
      console.log(`[CHOOSE-RIDER] Excluding ${rider.id} (${rider.name}): rejection limit reached`);
      return false;
    }
    
    return true;
  });
  
  if (availableRiders.length === 0) {
    console.log('[CHOOSE-RIDER] No available riders after filtering');
    return null;
  }
  
  // Count active orders per available rider
  const activeStatuses = ['placed', 'accepted', 'preparing', 'ready_for_pickup', 'reached_vendor', 'out_for_delivery', 'near_destination'];
  const riderLoads = {};
  
  // Initialize load counter for available riders
  availableRiders.forEach(rider => {
    riderLoads[rider.id] = 0;
  });
  
  // Count active orders assigned to each rider
  allOrders.forEach(o => {
    if (o.assigned_rider_id && activeStatuses.includes(o.status)) {
      if (riderLoads[o.assigned_rider_id] !== undefined) {
        riderLoads[o.assigned_rider_id]++;
      }
    }
  });
  
  // Find rider with minimum load
  let selectedRider = null;
  let minLoad = Infinity;
  
  availableRiders.forEach(rider => {
    const load = riderLoads[rider.id];
    console.log(`[CHOOSE-RIDER] Rider ${rider.id} (${rider.name}): ${load} active orders`);
    
    if (load < minLoad) {
      minLoad = load;
      selectedRider = rider;
    }
  });
  
  if (selectedRider) {
    console.log(`[CHOOSE-RIDER] Selected rider ${selectedRider.id} (${selectedRider.name}) with ${minLoad} active orders`);
  }
  
  return selectedRider;
}

/**
 * Generate a unique order ID
 */
function generateOrderId() {
  orderCounter++;
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 9);
  return `ord_${timestamp}_${random}`;
}

/**
 * Sync order to Supabase
 * Helper function to upsert order data to Supabase database
 */
async function syncOrderToSupabase(order) {
  if (!supabase) {
    console.log('[supabase] Client not initialized, skipping sync');
    return { success: false, error: 'Supabase not configured' };
  }
  
  try {
    // Map order object to Supabase table schema
    const supabaseOrder = {
      id: order.order_id,
      user_phone: order.phone,
      user_name: order.user_id, // Using user_id as user_name for now
      vendor_id: order.vendor_id,
      vendor_name: order.vendor_name || order.vendor_id, // Store vendor name
      dish_name: order.dish_title,
      quantity: order.quantity,
      amount: order.price * order.quantity,
      status: order.status,
      allocation_status: order.allocation_status || 'unassigned',
      assigned_rider_id: order.assigned_rider_id || null,
      current_candidate_rider_id: order.current_candidate_rider_id || null,
      candidate_riders: order.candidate_riders || [],
      address: order.address,
      created_at: order.created_at,
      updated_at: order.updated_at
    };
    
    const { data, error } = await supabase
      .from('orders')
      .upsert(supabaseOrder, { onConflict: 'id' })
      .select();
    
    if (error) {
      console.error('[supabase] Error syncing order:', error.message);
      return { success: false, error: error.message };
    }
    
    console.log('[supabase] Order synced successfully:', order.order_id);
    return { success: true, data };
  } catch (err) {
    console.error('[supabase] Exception while syncing order:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Create a new order
 */
async function createOrder(orderData) {
  const orderId = generateOrderId();
  const now = new Date().toISOString();
  
  const order = {
    order_id: orderId,
    user_id: orderData.user_id,
    vendor_id: orderData.vendor_id,
    vendor_name: orderData.vendor_name,
    vendor_area: orderData.vendor_area || null,
    vendor_city: orderData.vendor_city || null,
    dish_id: orderData.dish_id,
    dish_title: orderData.dish_title,
    quantity: orderData.quantity,
    price: orderData.price,
    address: orderData.address,
    phone: orderData.phone,
    status: 'placed',
    // Rider allocation fields (new for accept/reject flow)
    allocation_status: 'unassigned', // unassigned | pending_rider | assigned
    assigned_rider_id: null,
    assigned_rider_name: null,
    current_candidate_rider_id: null, // Rider currently seeing the request
    candidate_riders: [], // Array of rider IDs who have been offered/rejected
    created_at: now,
    updated_at: now
  };
  
  // Store in memory
  ordersStore.set(orderId, order);
  
  // Sync to Supabase - WAIT for confirmation before returning success
  // This ensures order is persisted before we tell the user it succeeded
  const syncResult = await syncOrderToSupabase(order);
  if (!syncResult.success) {
    // If Supabase sync fails, remove from in-memory store and throw error
    ordersStore.delete(orderId);
    console.error('[supabase] Failed to persist order to database:', syncResult.error);
    throw new Error(`Failed to save order to database: ${syncResult.error}`);
  }
  
  console.log('[supabase] Order successfully created and persisted:', orderId);
  return order;
}

/**
 * Get orders with optional filters
 */
async function getOrders(filters = {}) {
  // Try to get orders from Supabase first
  if (supabase) {
    try {
      let query = supabase
        .from('orders')
        .select('*');
      
      // Apply filters
      if (filters.user) {
        query = query.eq('user_name', filters.user);
      }
      
      if (filters.vendor) {
        query = query.eq('vendor_id', filters.vendor);
      }
      
      if (filters.status) {
        query = query.eq('status', filters.status);
      }
      
      // Rider filter is more complex - needs OR logic
      if (filters.rider) {
        const riderId = filters.rider;
        // We need to fetch all and filter client-side for complex OR conditions
        const { data, error } = await query;
        
        if (error) {
          console.error('[supabase] Error fetching orders:', error.message);
          throw error;
        }
        
        // Filter for rider: pending offers OR assigned orders
        const riderOrders = (data || []).filter(o => {
          const isPendingForMe = 
            o.allocation_status === 'pending_rider' && 
            o.current_candidate_rider_id === riderId;
          
          const isAssignedToMe = 
            o.allocation_status === 'assigned' && 
            o.assigned_rider_id === riderId;
          
          return isPendingForMe || isAssignedToMe;
        });
        
        // Map Supabase schema back to order object format
        return riderOrders.map(mapSupabaseToOrder);
      }
      
      // Execute query for non-rider filters
      const { data, error } = await query;
      
      if (error) {
        console.error('[supabase] Error fetching orders:', error.message);
        throw error;
      }
      
      console.log(`[supabase] Fetched ${data?.length || 0} orders from database`);
      
      // Map Supabase schema back to order object format
      return (data || []).map(mapSupabaseToOrder);
      
    } catch (err) {
      console.error('[supabase] Exception while fetching orders, falling back to in-memory:', err.message);
      // Fall through to in-memory fallback
    }
  }
  
  // Fallback to in-memory storage
  console.log('[supabase] Using in-memory storage for order retrieval');
  let orders = Array.from(ordersStore.values());
  
  // Filter by user
  if (filters.user) {
    orders = orders.filter(o => o.user_id === filters.user);
  }
  
  // Filter by vendor
  if (filters.vendor) {
    orders = orders.filter(o => o.vendor_id === filters.vendor);
  }
  
  // Filter by rider - include both pending offers and assigned orders
  if (filters.rider) {
    const riderId = filters.rider;
    orders = orders.filter(o => {
      // New Requests - orders offered to this rider (pending their accept/reject)
      const isPendingForMe = 
        o.allocation_status === 'pending_rider' && 
        o.current_candidate_rider_id === riderId;
      
      // Active Deliveries - orders fully assigned to this rider
      const isAssignedToMe = 
        o.allocation_status === 'assigned' && 
        o.assigned_rider_id === riderId;
      
      return isPendingForMe || isAssignedToMe;
    });
  }
  
  // Filter by status
  if (filters.status) {
    orders = orders.filter(o => o.status === filters.status);
  }
  
  return orders;
}

/**
 * Map Supabase order record to application order format
 */
function mapSupabaseToOrder(supabaseOrder) {
  return {
    order_id: supabaseOrder.id,
    user_id: supabaseOrder.user_name, // Using user_name as user_id
    vendor_id: supabaseOrder.vendor_id,
    vendor_name: supabaseOrder.vendor_name || supabaseOrder.vendor_id, // Use stored vendor_name
    vendor_area: null, // Not stored in Supabase schema
    vendor_city: null, // Not stored in Supabase schema
    dish_id: null, // Not stored in Supabase schema
    dish_title: supabaseOrder.dish_name,
    quantity: supabaseOrder.quantity,
    price: supabaseOrder.amount / supabaseOrder.quantity, // Calculate unit price
    address: supabaseOrder.address,
    phone: supabaseOrder.user_phone,
    status: supabaseOrder.status,
    allocation_status: supabaseOrder.allocation_status || 'unassigned',
    assigned_rider_id: supabaseOrder.assigned_rider_id,
    assigned_rider_name: supabaseOrder.assigned_rider_id ? 
      (DEMO_RIDERS.find(r => r.id === supabaseOrder.assigned_rider_id)?.name || supabaseOrder.assigned_rider_id) : null,
    current_candidate_rider_id: supabaseOrder.current_candidate_rider_id,
    candidate_riders: supabaseOrder.candidate_riders || [],
    created_at: supabaseOrder.created_at,
    updated_at: supabaseOrder.updated_at
  };
}

/**
 * Auto-assign rider to an order using simple load-balancing
 * NOW UPDATED: Offers order to rider instead of instantly assigning
 * 
 * PROTOTYPE ALGORITHM:
 * - Counts active orders per rider (statuses: placed, accepted, preparing, ready_for_pickup, out_for_delivery)
 * - Offers to rider with lowest active load
 * - Sets allocation_status to 'pending_rider' and current_candidate_rider_id
 * - Returns selected rider object or null if none available
 * 
 * PRODUCTION ENHANCEMENTS:
 * - Geo-based matching: Calculate distance from rider location to vendor
 * - Zone matching: Match rider.zone with vendor_area/vendor_city
 * - Real-time availability: Check rider online status, shift times
 * - Capacity limits: Max concurrent orders per rider
 * - Skills matching: Vehicle type (bike/scooter), food handling certification
 * - Performance metrics: Consider rider rating, acceptance rate, avg delivery time
 * - Traffic-aware routing: Use Google Maps/Mapbox for realistic ETAs
 * 
 * @param {Object} order - The order to assign
 * @param {Array} allOrders - All orders in the system (for load calculation)
 * @returns {Object|null} Selected rider {id, name, zone} or null
 */
function autoAssignRider(order, allOrders) {
  console.log(`[AUTO-ASSIGN] Attempting auto-offer for order ${order.order_id}`);
  
  // Use the new chooseNextRider function which handles exclusions and limits
  const selectedRider = chooseNextRider(order, allOrders);
  
  if (selectedRider) {
    console.log(`[AUTO-ASSIGN] Offering to rider ${selectedRider.id} (${selectedRider.name})`);
  } else {
    console.log('[AUTO-ASSIGN] No suitable rider found for offer');
  }
  
  return selectedRider;
}

/**
 * Update order status and handle rider assignment
 */
async function updateOrderStatus(orderId, newStatus, riderId = null) {
  const order = ordersStore.get(orderId);
  if (!order) {
    return null;
  }
  
  const oldStatus = order.status;
  
  // Update status if provided
  if (newStatus) {
    order.status = newStatus;
  }
  
  order.updated_at = new Date().toISOString();
  
  // Update rider if explicitly provided (manual assignment by admin)
  if (riderId !== null && riderId !== undefined) {
    order.assigned_rider_id = riderId || null;
    
    // Update allocation status when manually assigning
    if (riderId) {
      order.allocation_status = 'assigned';
      order.current_candidate_rider_id = null; // Clear any pending offer
      
      // Also store rider name for display purposes
      const rider = DEMO_RIDERS.find(r => r.id === riderId);
      if (rider) {
        order.assigned_rider_name = rider.name;
      }
    } else {
      // Unassigning rider
      order.allocation_status = 'unassigned';
      order.assigned_rider_name = null;
      order.current_candidate_rider_id = null;
    }
  }
  
  // Update in-memory store
  ordersStore.set(orderId, order);
  
  // Sync to Supabase - WAIT for confirmation
  const syncResult = await syncOrderToSupabase(order);
  if (!syncResult.success) {
    console.error('[supabase] Failed to sync order update:', syncResult.error);
    // For updates, we don't throw error - just log it
    // The in-memory state is updated, so the operation can continue
  }
  
  return order;
}

// ============================================================================
// HTTP HANDLERS
// ============================================================================

/**
 * Main handler for the orders API
 */
exports.handler = async function(event, context) {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json'
  };
  
  // Handle OPTIONS (preflight)
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }
  
  try {
    // Route based on path and method
    const path = event.path.replace('/.netlify/functions/orders', '').replace('/api/orders', '');
    const method = event.httpMethod;
    
    // POST /api/orders - Create new order
    if (method === 'POST' && !path) {
      const orderData = JSON.parse(event.body || '{}');
      
      // Validate required fields
      const requiredFields = ['user_id', 'vendor_id', 'dish_title', 'quantity', 'price', 'address', 'phone'];
      const missing = requiredFields.filter(field => !orderData[field]);
      
      if (missing.length > 0) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            error: 'Missing required fields',
            missing: missing
          })
        };
      }
      
      // Create order (now async)
      const order = await createOrder(orderData);
      
      return {
        statusCode: 201,
        headers,
        body: JSON.stringify({
          success: true,
          order_id: order.order_id,
          order: order
        })
      };
    }
    
    // GET /api/orders - Retrieve orders
    if (method === 'GET' && !path) {
      const params = event.queryStringParameters || {};
      
      // Check for admin access (simple key-based auth for prototype)
      const isAdmin = params.admin_key === (process.env.ADMIN_KEY || 'demo_admin_key_123');
      
      // If not admin, require at least one filter
      if (!isAdmin && !params.user && !params.vendor && !params.rider) {
        return {
          statusCode: 403,
          headers,
          body: JSON.stringify({
            error: 'Forbidden: Please provide user, vendor, or rider filter, or use admin_key'
          })
        };
      }
      
      // Get orders with filters (now async)
      const filters = {
        user: params.user,
        vendor: params.vendor,
        rider: params.rider,
        status: params.status
      };
      
      const orders = await getOrders(filters);
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          count: orders.length,
          orders: orders
        })
      };
    }
    
    // POST /api/orders/status - Update order status and/or assign rider
    if (method === 'POST' && path === '/status') {
      const data = JSON.parse(event.body || '{}');
      
      console.log('[STATUS UPDATE] Request:', JSON.stringify({
        order_id: data.order_id,
        status: data.status,
        rider_id: data.rider_id
      }));
      
      // Validate order_id is present
      if (!data.order_id) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            success: false,
            error: 'Missing required field: order_id'
          })
        };
      }
      
      // At least one of status or rider_id must be provided
      if (!data.status && data.rider_id === undefined) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            success: false,
            error: 'Must provide either status or rider_id to update'
          })
        };
      }
      
      // Validate status if provided
      if (data.status) {
        const validStatuses = ['placed', 'accepted', 'preparing', 'ready_for_pickup', 'reached_vendor', 'out_for_delivery', 'near_destination', 'delivered', 'cancelled'];
        if (!validStatuses.includes(data.status)) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({
              success: false,
              error: 'Invalid status',
              validStatuses: validStatuses
            })
          };
        }
      }
      
      // Get current order state before update
      const currentOrder = ordersStore.get(data.order_id);
      if (!currentOrder) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({
            success: false,
            error: 'Order not found'
          })
        };
      }
      
      const oldStatus = currentOrder.status;
      
      // Update order with provided fields (now async)
      const order = await updateOrderStatus(data.order_id, data.status, data.rider_id);
      
      if (!order) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({
            success: false,
            error: 'Order not found'
          })
        };
      }
      
      // Auto-assign rider when transitioning to "preparing" or "ready_for_pickup" if no rider assigned
      // NOW UPDATED: Offers to rider instead of instantly assigning
      const statusChangingToPreparing = data.status === 'preparing' && oldStatus !== 'preparing';
      const statusChangingToReady = data.status === 'ready_for_pickup' && oldStatus !== 'ready_for_pickup';
      const needsRiderOffer = (statusChangingToPreparing || statusChangingToReady) && 
                               order.allocation_status === 'unassigned' && // Only if truly unassigned, not pending or assigned
                               data.rider_id === undefined; // Don't auto-offer if admin is manually setting rider
      
      if (needsRiderOffer) {
        console.log(`[AUTO-ASSIGN] Order transitioned to ${data.status} without assigned rider, attempting to offer to rider`);
        
        const allOrders = Array.from(ordersStore.values());
        const selectedRider = autoAssignRider(order, allOrders);
        
        if (selectedRider) {
          // Offer order to rider (not instant assignment)
          order.allocation_status = 'pending_rider';
          order.current_candidate_rider_id = selectedRider.id;
          // Add to candidate list
          if (!order.candidate_riders) order.candidate_riders = [];
          if (!order.candidate_riders.includes(selectedRider.id)) {
            order.candidate_riders.push(selectedRider.id);
          }
          ordersStore.set(order.order_id, order);
          
          // Sync the rider offer to Supabase
          await syncOrderToSupabase(order);
          
          console.log(`[AUTO-ASSIGN] Offered order ${order.order_id} to rider ${selectedRider.id} (${selectedRider.name})`);
        } else {
          console.log('[AUTO-ASSIGN] No rider available for offer, order remains unassigned');
          order.allocation_status = 'unassigned';
          ordersStore.set(order.order_id, order);
        }
      }
      
      console.log('[STATUS UPDATE] Success:', JSON.stringify({
        order_id: order.order_id,
        status: order.status,
        assigned_rider_id: order.assigned_rider_id,
        assigned_rider_name: order.assigned_rider_name
      }));
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          order: order
        })
      };
    }
    
    // POST /api/orders/rider-response - Handle rider accept/reject decisions
    if (method === 'POST' && path === '/rider-response') {
      const data = JSON.parse(event.body || '{}');
      
      console.log('[RIDER-RESPONSE] Request:', JSON.stringify({
        order_id: data.order_id,
        rider_id: data.rider_id,
        decision: data.decision
      }));
      
      // Validate required fields
      if (!data.order_id || !data.rider_id || !data.decision) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            success: false,
            error: 'Missing required fields: order_id, rider_id, decision'
          })
        };
      }
      
      // Validate decision
      if (!['accept', 'reject'].includes(data.decision)) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            success: false,
            error: 'Invalid decision. Must be "accept" or "reject"'
          })
        };
      }
      
      // Get the order
      const order = ordersStore.get(data.order_id);
      if (!order) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({
            success: false,
            error: 'Order not found'
          })
        };
      }
      
      // Verify this rider is the current candidate
      if (order.current_candidate_rider_id !== data.rider_id) {
        return {
          statusCode: 403,
          headers,
          body: JSON.stringify({
            success: false,
            error: 'This order is not currently offered to you'
          })
        };
      }
      
      // Handle ACCEPT
      if (data.decision === 'accept') {
        console.log(`[RIDER-RESPONSE] Rider ${data.rider_id} ACCEPTED order ${data.order_id}`);
        
        // Find rider details
        const rider = DEMO_RIDERS.find(r => r.id === data.rider_id);
        
        // Assign the order
        order.allocation_status = 'assigned';
        order.assigned_rider_id = data.rider_id;
        order.assigned_rider_name = rider ? rider.name : data.rider_id;
        order.current_candidate_rider_id = null; // Clear candidate
        order.updated_at = new Date().toISOString();
        
        ordersStore.set(data.order_id, order);
        
        // Sync to Supabase
        await syncOrderToSupabase(order);
        
        console.log(`[RIDER-RESPONSE] Order ${data.order_id} assigned to rider ${data.rider_id}`);
        
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            message: 'Order accepted successfully',
            order: order
          })
        };
      }
      
      // Handle REJECT
      if (data.decision === 'reject') {
        console.log(`[RIDER-RESPONSE] Rider ${data.rider_id} REJECTED order ${data.order_id}`);
        
        // Check rejection limit
        if (!canRiderReject(data.rider_id)) {
          console.log(`[RIDER-RESPONSE] Rider ${data.rider_id} has reached monthly rejection limit`);
          return {
            statusCode: 403,
            headers,
            body: JSON.stringify({
              success: false,
              error: 'Monthly rejection limit reached. Please contact operations.',
              limit_reached: true
            })
          };
        }
        
        // Record the rejection
        recordRejection(data.rider_id);
        
        // Clear current candidate
        order.current_candidate_rider_id = null;
        order.updated_at = new Date().toISOString();
        
        // Try to find next rider
        const allOrders = Array.from(ordersStore.values());
        const nextRider = chooseNextRider(order, allOrders);
        
        if (nextRider) {
          // Offer to next rider
          order.allocation_status = 'pending_rider';
          order.current_candidate_rider_id = nextRider.id;
          // Add to candidate list if not already there
          if (!order.candidate_riders.includes(nextRider.id)) {
            order.candidate_riders.push(nextRider.id);
          }
          
          console.log(`[RIDER-RESPONSE] Order ${data.order_id} offered to next rider ${nextRider.id} (${nextRider.name})`);
        } else {
          // No more riders available
          order.allocation_status = 'unassigned';
          console.log(`[RIDER-RESPONSE] No more riders available for order ${data.order_id}, marked as unassigned`);
        }
        
        ordersStore.set(data.order_id, order);
        
        // Sync to Supabase
        await syncOrderToSupabase(order);
        
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            message: 'Order rejected. Looking for another rider.',
            order: order,
            next_rider: nextRider ? nextRider.id : null
          })
        };
      }
    }
    
    // Unknown route
    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({
        error: 'Not found',
        message: 'Invalid API endpoint. Use POST /api/orders, GET /api/orders, or POST /api/orders/status'
      })
    };
    
  } catch (error) {
    console.error('Orders API error:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Internal server error',
        message: error.message
      })
    };
  }
};
