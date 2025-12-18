# 🚀 Production Deployment Guide - Step by Step to Go Live

## Overview

This guide provides a complete roadmap to take your Healthy Food Delivery Platform from prototype to production. Follow each step in order, and mark them as "DONE" before proceeding to the next.

---

## Current Status Assessment

✅ **What's Working:**
- User app (browse, order, track)
- Vendor dashboard (order management)
- Admin dashboard (full control)
- Rider dashboard (delivery management)
- Orders API (in-memory storage)
- Nutrition service
- Netlify deployment setup

❌ **What's Missing for Production:**
- Persistent database
- Real authentication
- Payment gateway
- Mobile apps (optional but recommended)
- Production security
- Monitoring & analytics
- SMS/Email notifications

---

## 📋 STEP 1: Database Setup (Week 1)

### Why: Currently using in-memory storage - data is lost on restart

### Option A: Supabase (Recommended - Free tier available)

#### 1.1 Create Supabase Account
```bash
# Go to https://supabase.com
# Click "Start your project"
# Sign up with GitHub
# Create new project: "acl025-prod"
# Choose region closest to users (e.g., Mumbai for India)
# Wait ~2 minutes for provisioning
```

#### 1.2 Create Database Tables

**Run this SQL in Supabase SQL Editor:**

```sql
-- Orders table
CREATE TABLE orders (
  id BIGSERIAL PRIMARY KEY,
  order_id VARCHAR(50) UNIQUE NOT NULL,
  user_id VARCHAR(50) NOT NULL,
  vendor_id VARCHAR(100) NOT NULL,
  vendor_name VARCHAR(200) NOT NULL,
  dish_id VARCHAR(100) NOT NULL,
  dish_title VARCHAR(200) NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  price DECIMAL(10,2) NOT NULL,
  address TEXT NOT NULL,
  phone VARCHAR(20) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'placed',
  rider_id VARCHAR(50),
  payment_status VARCHAR(30) DEFAULT 'pending',
  payment_id VARCHAR(100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for better performance
CREATE INDEX idx_orders_user ON orders(user_id);
CREATE INDEX idx_orders_vendor ON orders(vendor_id);
CREATE INDEX idx_orders_rider ON orders(rider_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created ON orders(created_at DESC);

-- Users table
CREATE TABLE users (
  id BIGSERIAL PRIMARY KEY,
  user_id VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(200),
  email VARCHAR(200) UNIQUE,
  phone VARCHAR(20),
  address TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_login TIMESTAMP WITH TIME ZONE
);

-- Vendors table
CREATE TABLE vendors (
  id BIGSERIAL PRIMARY KEY,
  vendor_id VARCHAR(100) UNIQUE NOT NULL,
  name VARCHAR(200) NOT NULL,
  area VARCHAR(100),
  phone VARCHAR(20),
  email VARCHAR(200),
  pin_hash VARCHAR(100), -- Store hashed PIN
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Riders table
CREATE TABLE riders (
  id BIGSERIAL PRIMARY KEY,
  rider_id VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(200) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  vehicle_type VARCHAR(50),
  pin_hash VARCHAR(100), -- Store hashed PIN
  is_active BOOLEAN DEFAULT true,
  earnings_total DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Order history/audit log
CREATE TABLE order_audit (
  id BIGSERIAL PRIMARY KEY,
  order_id VARCHAR(50) NOT NULL,
  old_status VARCHAR(30),
  new_status VARCHAR(30),
  changed_by VARCHAR(100),
  changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for orders table
CREATE TRIGGER update_orders_updated_at 
  BEFORE UPDATE ON orders 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();
```

#### 1.3 Get Supabase Credentials

```bash
# In Supabase Dashboard:
# 1. Click on Project Settings (gear icon)
# 2. Click on API
# 3. Copy these values:
#    - Project URL (e.g., https://xxxxx.supabase.co)
#    - anon/public key (safe to use in frontend)
#    - service_role key (NEVER expose in frontend - backend only)
```

#### 1.4 Update Orders API to Use Supabase

**Install Supabase client:**

Create `package.json` in root:
```json
{
  "name": "acl025-backend",
  "version": "1.0.0",
  "description": "Healthy food delivery platform",
  "dependencies": {
    "@supabase/supabase-js": "^2.38.0"
  }
}
```

Run:
```bash
npm install
```

**Update `netlify/functions/orders.js`:**

Replace the in-memory storage with Supabase:

```javascript
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY // Use service key for backend
);

// Replace Map storage with Supabase queries
// Example for creating order:
async function createOrder(orderData) {
  const { data, error } = await supabase
    .from('orders')
    .insert([orderData])
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

// Example for getting orders:
async function getOrders(filters) {
  let query = supabase.from('orders').select('*');
  
  if (filters.user_id) {
    query = query.eq('user_id', filters.user_id);
  }
  if (filters.vendor_id) {
    query = query.eq('vendor_id', filters.vendor_id);
  }
  if (filters.rider_id) {
    query = query.eq('rider_id', filters.rider_id);
  }
  
  const { data, error } = await query.order('created_at', { ascending: false });
  
  if (error) throw error;
  return data;
}
```

#### 1.5 Set Environment Variables in Netlify

```bash
# In Netlify Dashboard:
# 1. Go to Site Settings > Environment Variables
# 2. Add these variables:

SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_KEY=your_service_role_key_here
ADMIN_KEY=your_secure_admin_key_here
```

#### 1.6 Test Database Connection

```bash
# Deploy to Netlify and test:
netlify deploy --prod

# Test creating an order via API
curl -X POST https://your-site.netlify.app/api/orders \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "test_user",
    "vendor_id": "wakad-healthybee",
    "dish_id": "test-dish",
    "quantity": 1,
    "price": 100,
    "address": "Test address",
    "phone": "1234567890"
  }'

# Check Supabase dashboard to verify data is stored
```

**✅ Mark DONE when:** Orders are persisting in Supabase database

---

## 📋 STEP 2: Authentication System (Week 1-2)

### Why: Currently using hard-coded PINs - need secure authentication

### 2.1 Choose Authentication Provider

**Option A: Supabase Auth (Recommended - already using Supabase)**

#### 2.1.1 Enable Supabase Auth

```bash
# In Supabase Dashboard:
# 1. Go to Authentication > Providers
# 2. Enable Email provider
# 3. Enable Phone provider (for OTP login)
# 4. Optional: Enable Google, Facebook for social login
```

#### 2.1.2 Update Vendor Login

**Modify `vendor.html`:**

```javascript
// Replace PIN login with Supabase Auth
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'YOUR_SUPABASE_URL',
  'YOUR_SUPABASE_ANON_KEY'
)

// Email/Password login for vendors
async function vendorLogin(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email,
    password: password
  })
  
  if (error) {
    alert('Login failed: ' + error.message);
    return;
  }
  
  // Get vendor details from vendors table
  const { data: vendor } = await supabase
    .from('vendors')
    .select('*')
    .eq('email', email)
    .single();
  
  if (vendor) {
    sessionStorage.setItem('vendor', JSON.stringify(vendor));
    showDashboard();
  }
}

// OTP login for riders (more convenient)
async function riderLoginWithOTP(phone) {
  const { data, error } = await supabase.auth.signInWithOtp({
    phone: phone
  })
  
  if (error) {
    alert('Error sending OTP: ' + error.message);
    return;
  }
  
  // Show OTP input field
  showOTPInput();
}

async function verifyOTP(phone, otp) {
  const { data, error } = await supabase.auth.verifyOtp({
    phone: phone,
    token: otp,
    type: 'sms'
  })
  
  if (error) {
    alert('Invalid OTP');
    return;
  }
  
  // Get rider details
  const { data: rider } = await supabase
    .from('riders')
    .select('*')
    .eq('phone', phone)
    .single();
  
  if (rider) {
    sessionStorage.setItem('rider', JSON.stringify(rider));
    showDashboard();
  }
}
```

#### 2.1.3 Secure API Endpoints

**Update `netlify/functions/orders.js`:**

```javascript
// Verify JWT token from Supabase Auth
async function verifyAuth(request) {
  const token = request.headers.authorization?.split('Bearer ')[1];
  
  if (!token) {
    throw new Error('No authorization token');
  }
  
  const { data: { user }, error } = await supabase.auth.getUser(token);
  
  if (error || !user) {
    throw new Error('Invalid token');
  }
  
  return user;
}

// Use in handlers
exports.handler = async (event) => {
  try {
    const user = await verifyAuth(event);
    // Continue with authenticated request
  } catch (error) {
    return {
      statusCode: 401,
      body: JSON.stringify({ error: 'Unauthorized' })
    };
  }
};
```

#### 2.1.4 Create User Registration Flow

**Add to `index.html` or create `register.html`:**

```html
<!-- Registration form for new users -->
<div id="registerModal">
  <h2>Create Account</h2>
  <form id="registerForm">
    <input type="text" id="name" placeholder="Full Name" required>
    <input type="email" id="email" placeholder="Email" required>
    <input type="tel" id="phone" placeholder="Phone Number" required>
    <input type="password" id="password" placeholder="Password" required>
    <button type="submit">Sign Up</button>
  </form>
</div>

<script>
document.getElementById('registerForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const { data, error } = await supabase.auth.signUp({
    email: document.getElementById('email').value,
    password: document.getElementById('password').value,
    options: {
      data: {
        name: document.getElementById('name').value,
        phone: document.getElementById('phone').value
      }
    }
  });
  
  if (error) {
    alert('Registration failed: ' + error.message);
  } else {
    alert('Registration successful! Check your email to verify.');
  }
});
</script>
```

**✅ Mark DONE when:** Users can register and login securely with Supabase Auth

---

## 📋 STEP 3: Payment Gateway Integration (Week 2)

### Why: Cannot take real orders without payment processing

### 3.1 Choose Payment Provider for India

**Recommended: Razorpay (most popular in India)**

#### 3.1.1 Create Razorpay Account

```bash
# Go to https://razorpay.com
# Click "Sign Up"
# Complete KYC verification
# Get API keys from Dashboard > Settings > API Keys
```

#### 3.1.2 Install Razorpay

**Update `package.json`:**
```json
{
  "dependencies": {
    "@supabase/supabase-js": "^2.38.0",
    "razorpay": "^2.9.2"
  }
}
```

Run:
```bash
npm install
```

#### 3.1.3 Create Payment Netlify Function

**Create `netlify/functions/create-payment.js`:**

```javascript
const Razorpay = require('razorpay');

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }
  
  try {
    const { amount, orderId } = JSON.parse(event.body);
    
    // Create Razorpay order
    const options = {
      amount: amount * 100, // Amount in paise
      currency: 'INR',
      receipt: orderId,
      payment_capture: 1 // Auto capture
    };
    
    const razorpayOrder = await razorpay.orders.create(options);
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        orderId: razorpayOrder.id,
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency
      })
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};
```

**Create `netlify/functions/verify-payment.js`:**

```javascript
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }
  
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      order_id
    } = JSON.parse(event.body);
    
    // Verify signature
    const body = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest('hex');
    
    if (expectedSignature !== razorpay_signature) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Invalid signature' })
      };
    }
    
    // Update order payment status
    const { data, error } = await supabase
      .from('orders')
      .update({
        payment_status: 'completed',
        payment_id: razorpay_payment_id
      })
      .eq('order_id', order_id);
    
    if (error) throw error;
    
    return {
      statusCode: 200,
      body: JSON.stringify({ success: true })
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};
```

#### 3.1.4 Update Frontend to Handle Payments

**Modify `app.js` - Add Razorpay checkout:**

```javascript
// Add Razorpay script to index.html
// <script src="https://checkout.razorpay.com/v1/checkout.js"></script>

async function processPayment(orderData) {
  // Create payment order
  const response = await fetch('/api/create-payment', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      amount: orderData.price * orderData.quantity,
      orderId: orderData.order_id
    })
  });
  
  const { orderId, amount, currency } = await response.json();
  
  // Open Razorpay checkout
  const options = {
    key: 'YOUR_RAZORPAY_KEY_ID', // Use public key
    amount: amount,
    currency: currency,
    order_id: orderId,
    name: 'Healthy Food Delivery',
    description: orderData.dish_title,
    handler: async function (response) {
      // Payment successful - verify on backend
      const verifyResponse = await fetch('/api/verify-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          razorpay_order_id: response.razorpay_order_id,
          razorpay_payment_id: response.razorpay_payment_id,
          razorpay_signature: response.razorpay_signature,
          order_id: orderData.order_id
        })
      });
      
      const result = await verifyResponse.json();
      
      if (result.success) {
        alert('Payment successful! Order confirmed.');
        window.location.href = '/orders.html';
      } else {
        alert('Payment verification failed');
      }
    },
    prefill: {
      name: orderData.userName,
      contact: orderData.phone
    },
    theme: {
      color: '#4CAF50'
    }
  };
  
  const razorpay = new Razorpay(options);
  razorpay.open();
}

// Update order submission flow
async function submitOrder(orderData) {
  try {
    // Create order in database (status: pending_payment)
    const response = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...orderData, status: 'pending_payment' })
    });
    
    const order = await response.json();
    
    // Process payment
    await processPayment(order);
  } catch (error) {
    console.error('Order failed:', error);
    alert('Failed to process order');
  }
}
```

#### 3.1.5 Set Razorpay Environment Variables

```bash
# In Netlify Dashboard > Site Settings > Environment Variables
RAZORPAY_KEY_ID=rzp_test_xxxxx
RAZORPAY_KEY_SECRET=xxxxx
```

#### 3.1.6 Test Payment Flow

```bash
# Use Razorpay test mode
# Test cards: https://razorpay.com/docs/payments/payments/test-card-details/
# Card: 4111 1111 1111 1111
# CVV: Any 3 digits
# Expiry: Any future date
```

**✅ Mark DONE when:** Test payments complete successfully and update order status

---

## 📋 STEP 4: Rider Mobile App (Week 3)

### Why: Riders need a mobile-first experience for deliveries

### Option A: Progressive Web App (PWA) - Fastest to deploy

#### 4.1 Convert Rider Dashboard to PWA

**Create `manifest.json` in root:**

```json
{
  "name": "Healthy Food Delivery - Rider",
  "short_name": "Rider App",
  "description": "Delivery partner app",
  "start_url": "/rider.html",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#4CAF50",
  "orientation": "portrait",
  "icons": [
    {
      "src": "/icons/icon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/icons/icon-512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}
```

**Create `service-worker.js` in root:**

```javascript
const CACHE_NAME = 'rider-app-v1';
const urlsToCache = [
  '/rider.html',
  '/styles.css',
  '/offline.html'
];

// Install service worker
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

// Fetch with cache fallback
self.addEventListener('fetch', event => {
  event.respondWith(
    fetch(event.request)
      .catch(() => caches.match(event.request))
  );
});

// Enable push notifications
self.addEventListener('push', event => {
  const data = event.data.json();
  
  self.registration.showNotification(data.title, {
    body: data.body,
    icon: '/icons/icon-192.png',
    badge: '/icons/badge.png',
    vibrate: [200, 100, 200],
    data: {
      url: data.url
    }
  });
});
```

**Update `rider.html` to register service worker:**

```html
<head>
  <!-- ... existing head content ... -->
  <link rel="manifest" href="/manifest.json">
  <meta name="theme-color" content="#4CAF50">
  <meta name="mobile-web-app-capable" content="yes">
</head>

<script>
// Register service worker
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/service-worker.js')
    .then(reg => console.log('Service worker registered'))
    .catch(err => console.log('Service worker registration failed'));
}

// Request notification permission
if ('Notification' in window && Notification.permission === 'default') {
  Notification.requestPermission();
}
</script>
```

#### 4.2 Add Location Tracking

**Update `rider.html`:**

```javascript
// Get rider's current location
function trackLocation() {
  if ('geolocation' in navigator) {
    navigator.geolocation.watchPosition(
      position => {
        const location = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy
        };
        
        // Update location in database
        updateRiderLocation(location);
      },
      error => console.error('Location error:', error),
      {
        enableHighAccuracy: true,
        timeout: 5000,
        maximumAge: 0
      }
    );
  }
}

async function updateRiderLocation(location) {
  const rider = JSON.parse(sessionStorage.getItem('rider'));
  
  await fetch('/api/update-rider-location', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      rider_id: rider.rider_id,
      location: location
    })
  });
}
```

#### 4.3 Add Push Notifications

**Create `netlify/functions/send-notification.js`:**

```javascript
const webpush = require('web-push');

// Set VAPID keys (generate with: npx web-push generate-vapid-keys)
webpush.setVapidDetails(
  'mailto:your-email@example.com',
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

exports.handler = async (event) => {
  const { subscription, notification } = JSON.parse(event.body);
  
  try {
    await webpush.sendNotification(subscription, JSON.stringify(notification));
    return {
      statusCode: 200,
      body: JSON.stringify({ success: true })
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};
```

**✅ Mark DONE when:** Riders can install PWA and receive notifications

### Option B: Native Mobile App (React Native) - Better UX

#### 4.4 Set Up React Native Project (If choosing native app)

```bash
# Install React Native CLI
npm install -g react-native-cli

# Create new project
npx react-native init RiderApp

cd RiderApp

# Install dependencies
npm install @react-navigation/native @react-navigation/stack
npm install @supabase/supabase-js
npm install react-native-maps
npm install @react-native-firebase/messaging
```

**Note:** Native app development is more complex. Consider PWA first for faster deployment.

**✅ Mark DONE when:** Rider app is functional on mobile devices

---

## 📋 STEP 5: Operations Dashboard Enhancement (Week 3)

### Why: Need real-time monitoring and analytics for operations team

#### 5.1 Add Real-Time Order Monitoring

**Create `operations-dashboard.html`:**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Operations Dashboard</title>
  <link rel="stylesheet" href="styles.css">
  <style>
    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 20px;
      margin-bottom: 30px;
    }
    
    .metric-card {
      background: white;
      padding: 20px;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    
    .metric-value {
      font-size: 32px;
      font-weight: bold;
      color: #4CAF50;
    }
    
    .metric-label {
      color: #666;
      margin-top: 5px;
    }
    
    .chart-container {
      background: white;
      padding: 20px;
      border-radius: 8px;
      margin-bottom: 20px;
    }
  </style>
</head>
<body>
  <div class="dashboard-container">
    <h1>🎯 Operations Dashboard</h1>
    
    <!-- Real-time metrics -->
    <div class="metrics-grid">
      <div class="metric-card">
        <div class="metric-value" id="activeOrders">0</div>
        <div class="metric-label">Active Orders</div>
      </div>
      
      <div class="metric-card">
        <div class="metric-value" id="ridersOnline">0</div>
        <div class="metric-label">Riders Online</div>
      </div>
      
      <div class="metric-card">
        <div class="metric-value" id="avgDeliveryTime">--</div>
        <div class="metric-label">Avg Delivery Time</div>
      </div>
      
      <div class="metric-card">
        <div class="metric-value" id="todayRevenue">₹0</div>
        <div class="metric-label">Today's Revenue</div>
      </div>
    </div>
    
    <!-- Orders by status chart -->
    <div class="chart-container">
      <h2>Orders by Status</h2>
      <canvas id="statusChart"></canvas>
    </div>
    
    <!-- Recent activity -->
    <div class="chart-container">
      <h2>Recent Activity</h2>
      <div id="activityFeed"></div>
    </div>
  </div>
  
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <script>
    // Real-time metrics update
    async function updateMetrics() {
      const response = await fetch('/api/operations-metrics');
      const metrics = await response.json();
      
      document.getElementById('activeOrders').textContent = metrics.activeOrders;
      document.getElementById('ridersOnline').textContent = metrics.ridersOnline;
      document.getElementById('avgDeliveryTime').textContent = metrics.avgDeliveryTime + ' min';
      document.getElementById('todayRevenue').textContent = '₹' + metrics.todayRevenue;
      
      updateStatusChart(metrics.ordersByStatus);
      updateActivityFeed(metrics.recentActivity);
    }
    
    // Status chart
    function updateStatusChart(data) {
      const ctx = document.getElementById('statusChart').getContext('2d');
      new Chart(ctx, {
        type: 'bar',
        data: {
          labels: Object.keys(data),
          datasets: [{
            label: 'Orders',
            data: Object.values(data),
            backgroundColor: [
              '#4CAF50', '#FFC107', '#2196F3', '#FF5722', '#9C27B0'
            ]
          }]
        }
      });
    }
    
    // Activity feed
    function updateActivityFeed(activities) {
      const feed = document.getElementById('activityFeed');
      feed.innerHTML = activities.map(activity => `
        <div style="padding: 10px; border-bottom: 1px solid #eee;">
          <strong>${activity.time}</strong> - ${activity.message}
        </div>
      `).join('');
    }
    
    // Auto-refresh every 10 seconds
    setInterval(updateMetrics, 10000);
    updateMetrics();
  </script>
</body>
</html>
```

#### 5.2 Create Operations Metrics API

**Create `netlify/functions/operations-metrics.js`:**

```javascript
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

exports.handler = async (event) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    
    // Get active orders
    const { data: activeOrders } = await supabase
      .from('orders')
      .select('*')
      .not('status', 'in', '(delivered,cancelled)');
    
    // Get orders by status
    const { data: allOrders } = await supabase
      .from('orders')
      .select('status')
      .gte('created_at', today);
    
    const ordersByStatus = allOrders.reduce((acc, order) => {
      acc[order.status] = (acc[order.status] || 0) + 1;
      return acc;
    }, {});
    
    // Get active riders
    const { data: riders } = await supabase
      .from('riders')
      .select('*')
      .eq('is_active', true);
    
    // Calculate average delivery time
    const { data: deliveredOrders } = await supabase
      .from('orders')
      .select('created_at, updated_at')
      .eq('status', 'delivered')
      .gte('created_at', today);
    
    let avgDeliveryTime = 0;
    if (deliveredOrders.length > 0) {
      const totalTime = deliveredOrders.reduce((sum, order) => {
        const diff = new Date(order.updated_at) - new Date(order.created_at);
        return sum + diff;
      }, 0);
      avgDeliveryTime = Math.round(totalTime / deliveredOrders.length / 60000); // in minutes
    }
    
    // Calculate today's revenue
    const { data: paidOrders } = await supabase
      .from('orders')
      .select('price, quantity')
      .eq('payment_status', 'completed')
      .gte('created_at', today);
    
    const todayRevenue = paidOrders.reduce((sum, order) => {
      return sum + (order.price * order.quantity);
    }, 0);
    
    // Get recent activity
    const { data: recentActivity } = await supabase
      .from('order_audit')
      .select('*')
      .order('changed_at', { ascending: false })
      .limit(10);
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        activeOrders: activeOrders.length,
        ridersOnline: riders.length,
        avgDeliveryTime,
        todayRevenue,
        ordersByStatus,
        recentActivity: recentActivity.map(a => ({
          time: new Date(a.changed_at).toLocaleTimeString(),
          message: `Order ${a.order_id} changed from ${a.old_status} to ${a.new_status}`
        }))
      })
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};
```

**✅ Mark DONE when:** Operations dashboard shows real-time metrics

---

## 📋 STEP 6: Vendor App Improvements (Week 4)

### Why: Vendors need better tools to manage their operations

#### 6.1 Add Menu Management

**Update `vendor.html` - Add menu section:**

```html
<div id="menuManagement" style="display: none;">
  <h2>Manage Menu</h2>
  <button onclick="showAddDishForm()">+ Add New Dish</button>
  
  <div id="dishList"></div>
  
  <!-- Add dish modal -->
  <div id="addDishModal" class="modal">
    <form id="addDishForm">
      <input type="text" id="dishName" placeholder="Dish Name" required>
      <textarea id="dishDescription" placeholder="Description"></textarea>
      <input type="number" id="dishPrice" placeholder="Price" required>
      <input type="text" id="dishCategory" placeholder="Category (e.g., Salad)">
      <input type="text" id="healthTags" placeholder="Health tags (comma separated)">
      <button type="submit">Add Dish</button>
    </form>
  </div>
</div>

<script>
async function loadVendorMenu() {
  const vendor = JSON.parse(sessionStorage.getItem('vendor'));
  
  const response = await fetch(`/api/vendor-menu?vendor_id=${vendor.vendor_id}`);
  const menu = await response.json();
  
  const dishList = document.getElementById('dishList');
  dishList.innerHTML = menu.map(dish => `
    <div class="dish-card">
      <h3>${dish.name}</h3>
      <p>${dish.description}</p>
      <p>₹${dish.price}</p>
      <label>
        <input type="checkbox" 
               ${dish.available ? 'checked' : ''} 
               onchange="toggleDishAvailability('${dish.id}', this.checked)">
        Available
      </label>
      <button onclick="editDish('${dish.id}')">Edit</button>
    </div>
  `).join('');
}

async function toggleDishAvailability(dishId, available) {
  await fetch('/api/vendor-menu/toggle', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dish_id: dishId, available })
  });
}

document.getElementById('addDishForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const vendor = JSON.parse(sessionStorage.getItem('vendor'));
  
  await fetch('/api/vendor-menu', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      vendor_id: vendor.vendor_id,
      name: document.getElementById('dishName').value,
      description: document.getElementById('dishDescription').value,
      price: parseFloat(document.getElementById('dishPrice').value),
      category: document.getElementById('dishCategory').value,
      health_tags: document.getElementById('healthTags').value.split(',')
    })
  });
  
  alert('Dish added successfully!');
  loadVendorMenu();
});
</script>
```

#### 6.2 Add Sales Analytics

**Add to `vendor.html`:**

```html
<div id="vendorAnalytics">
  <h2>📊 Sales Analytics</h2>
  
  <div class="stats-row">
    <div class="stat-box">
      <div class="stat-value" id="todayOrders">0</div>
      <div class="stat-label">Today's Orders</div>
    </div>
    
    <div class="stat-box">
      <div class="stat-value" id="todayRevenue">₹0</div>
      <div class="stat-label">Today's Revenue</div>
    </div>
    
    <div class="stat-box">
      <div class="stat-value" id="avgRating">0.0</div>
      <div class="stat-label">Average Rating</div>
    </div>
  </div>
  
  <canvas id="salesChart"></canvas>
</div>

<script>
async function loadVendorAnalytics() {
  const vendor = JSON.parse(sessionStorage.getItem('vendor'));
  
  const response = await fetch(`/api/vendor-analytics?vendor_id=${vendor.vendor_id}`);
  const analytics = await response.json();
  
  document.getElementById('todayOrders').textContent = analytics.todayOrders;
  document.getElementById('todayRevenue').textContent = '₹' + analytics.todayRevenue;
  document.getElementById('avgRating').textContent = analytics.avgRating.toFixed(1);
  
  // Sales chart
  const ctx = document.getElementById('salesChart').getContext('2d');
  new Chart(ctx, {
    type: 'line',
    data: {
      labels: analytics.last7Days.map(d => d.date),
      datasets: [{
        label: 'Revenue',
        data: analytics.last7Days.map(d => d.revenue),
        borderColor: '#4CAF50',
        backgroundColor: 'rgba(76, 175, 80, 0.1)'
      }]
    }
  });
}
</script>
```

**✅ Mark DONE when:** Vendors can manage menu and view analytics

---

## 📋 STEP 7: Notifications System (Week 4)

### Why: Users, vendors, and riders need real-time updates

#### 7.1 SMS Notifications via Twilio

**Install Twilio:**
```bash
npm install twilio
```

**Create `netlify/functions/send-sms.js`:**

```javascript
const twilio = require('twilio');

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

exports.handler = async (event) => {
  const { to, message } = JSON.parse(event.body);
  
  try {
    await client.messages.create({
      body: message,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: to
    });
    
    return {
      statusCode: 200,
      body: JSON.stringify({ success: true })
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};
```

**Update order creation to send SMS:**

```javascript
// In orders.js, after order creation
async function notifyOrderPlaced(order) {
  // Notify user
  await fetch('/api/send-sms', {
    method: 'POST',
    body: JSON.stringify({
      to: order.phone,
      message: `Your order #${order.order_id} has been placed! Track it at ${process.env.URL}/orders.html`
    })
  });
  
  // Notify vendor
  const vendor = await getVendorPhone(order.vendor_id);
  await fetch('/api/send-sms', {
    method: 'POST',
    body: JSON.stringify({
      to: vendor.phone,
      message: `New order #${order.order_id} for ${order.dish_title}`
    })
  });
}
```

#### 7.2 Email Notifications

**Install nodemailer:**
```bash
npm install nodemailer
```

**Create `netlify/functions/send-email.js`:**

```javascript
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  }
});

exports.handler = async (event) => {
  const { to, subject, html } = JSON.parse(event.body);
  
  try {
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to,
      subject,
      html
    });
    
    return {
      statusCode: 200,
      body: JSON.stringify({ success: true })
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};
```

**✅ Mark DONE when:** SMS and email notifications are working

---

## 📋 STEP 8: Testing & QA (Week 5)

### Why: Must ensure quality before going live

#### 8.1 Create Test Checklist

**User Flow Testing:**
- [ ] User registration and login
- [ ] Browse dishes
- [ ] Place order with payment
- [ ] Track order status
- [ ] Receive notifications
- [ ] View order history

**Vendor Flow Testing:**
- [ ] Vendor login
- [ ] View incoming orders
- [ ] Accept/reject orders
- [ ] Update order status
- [ ] Manage menu
- [ ] View analytics

**Rider Flow Testing:**
- [ ] Rider login
- [ ] View assigned deliveries
- [ ] Update delivery status
- [ ] View earnings
- [ ] Receive notifications

**Admin Flow Testing:**
- [ ] Admin login
- [ ] View all orders
- [ ] Assign riders
- [ ] Override order status
- [ ] View operations dashboard

#### 8.2 Performance Testing

```bash
# Install Apache Bench for load testing
sudo apt-get install apache2-utils

# Test API endpoints
ab -n 1000 -c 10 https://your-site.netlify.app/api/orders

# Test with authentication
ab -n 1000 -c 10 -H "Authorization: Bearer YOUR_TOKEN" https://your-site.netlify.app/api/orders
```

#### 8.3 Security Audit

- [ ] All API endpoints require authentication
- [ ] No sensitive data in frontend code
- [ ] Environment variables properly set
- [ ] HTTPS enforced
- [ ] Input validation on all forms
- [ ] SQL injection protection (using Supabase client)
- [ ] XSS protection (sanitize user inputs)
- [ ] Rate limiting enabled

**✅ Mark DONE when:** All tests pass and security audit complete

---

## 📋 STEP 9: Deployment & DevOps (Week 5)

### Why: Need proper deployment pipeline and monitoring

#### 9.1 Set Up Staging Environment

**In Netlify:**
1. Create new site for staging
2. Connect same GitHub repo
3. Set branch: `develop` or `staging`
4. Use separate Supabase project for staging

**Environment variables for staging:**
```
SUPABASE_URL=https://staging.supabase.co
SUPABASE_SERVICE_KEY=staging_key
RAZORPAY_KEY_ID=rzp_test_xxxxx (test mode)
```

#### 9.2 Set Up Production Environment

**In Netlify:**
1. Use main site for production
2. Set branch: `main` or `master`
3. Use production Supabase project

**Environment variables for production:**
```
SUPABASE_URL=https://prod.supabase.co
SUPABASE_SERVICE_KEY=prod_key
RAZORPAY_KEY_ID=rzp_live_xxxxx (live mode)
TWILIO_ACCOUNT_SID=live_sid
TWILIO_AUTH_TOKEN=live_token
```

#### 9.3 Set Up CI/CD Pipeline

**Create `.github/workflows/deploy.yml`:**

```yaml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v2
      
      - name: Setup Node.js
        uses: actions/setup-node@v2
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run tests
        run: npm test
      
      - name: Deploy to Netlify
        env:
          NETLIFY_AUTH_TOKEN: ${{ secrets.NETLIFY_AUTH_TOKEN }}
          NETLIFY_SITE_ID: ${{ secrets.NETLIFY_SITE_ID }}
        run: |
          npm install -g netlify-cli
          netlify deploy --prod --auth $NETLIFY_AUTH_TOKEN --site $NETLIFY_SITE_ID
```

#### 9.4 Set Up Monitoring

**Install Sentry for error tracking:**

```bash
npm install @sentry/browser
```

**Add to all HTML files:**

```html
<script src="https://browser.sentry-cdn.com/7.x.x/bundle.min.js"></script>
<script>
  Sentry.init({
    dsn: 'YOUR_SENTRY_DSN',
    environment: 'production'
  });
</script>
```

**Set up Google Analytics:**

```html
<!-- Add to all HTML files -->
<script async src="https://www.googletagmanager.com/gtag/js?id=GA_MEASUREMENT_ID"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'GA_MEASUREMENT_ID');
</script>
```

**✅ Mark DONE when:** Staging and production environments are set up with monitoring

---

## 📋 STEP 10: Go Live Checklist (Week 6)

### Final Pre-Launch Checklist

#### 10.1 Technical Checklist

- [ ] Database backup system configured
- [ ] All environment variables set in production
- [ ] HTTPS certificate active
- [ ] Custom domain configured (if applicable)
- [ ] CDN enabled for static assets
- [ ] Image optimization enabled
- [ ] Gzip compression enabled
- [ ] Rate limiting configured
- [ ] Error monitoring active (Sentry)
- [ ] Analytics tracking active
- [ ] All API endpoints tested in production
- [ ] Payment gateway in live mode and tested
- [ ] SMS/Email notifications working
- [ ] Mobile apps published (if applicable)

#### 10.2 Content Checklist

- [ ] All vendor menus updated
- [ ] Accurate pricing information
- [ ] High-quality food images
- [ ] Terms of service page
- [ ] Privacy policy page
- [ ] Refund policy page
- [ ] Contact information page
- [ ] FAQ page
- [ ] About us page

#### 10.3 Business Checklist

- [ ] Payment gateway KYC approved
- [ ] Business bank account linked
- [ ] GST registration complete (if in India)
- [ ] Food license obtained
- [ ] Insurance coverage active
- [ ] Vendor agreements signed
- [ ] Rider contracts signed
- [ ] Customer support system ready
- [ ] Refund process documented
- [ ] Escalation matrix defined

#### 10.4 Marketing Checklist

- [ ] Social media accounts created
- [ ] Google My Business listing
- [ ] Launch announcement prepared
- [ ] Promotional campaign ready
- [ ] Referral program configured
- [ ] First-order discount codes
- [ ] Email marketing system set up
- [ ] WhatsApp Business account

#### 10.5 Launch Day Checklist

**Morning (9 AM):**
- [ ] Final smoke test of all features
- [ ] Check all vendor statuses
- [ ] Confirm rider availability
- [ ] Verify payment gateway
- [ ] Test notifications end-to-end

**Launch (12 PM):**
- [ ] Switch DNS to production (if using custom domain)
- [ ] Enable Razorpay live mode
- [ ] Send launch announcement
- [ ] Post on social media
- [ ] Monitor error logs
- [ ] Watch operations dashboard

**Evening (6 PM):**
- [ ] Review first day metrics
- [ ] Check for any issues
- [ ] Gather initial feedback
- [ ] Plan next day operations

**✅ Mark DONE when:** Successfully processing real orders in production

---

## 📋 Post-Launch (Week 7+)

### 11.1 Daily Operations

**Every Morning:**
1. Check operations dashboard
2. Review previous day's orders
3. Resolve any payment issues
4. Check vendor/rider availability
5. Review customer feedback

**Every Evening:**
1. Reconcile payments
2. Process refunds if any
3. Calculate rider payouts
4. Review analytics
5. Plan next day capacity

### 11.2 Weekly Tasks

**Every Monday:**
- Review weekly metrics
- Plan marketing campaigns
- Onboard new vendors
- Recruit riders if needed
- Update menu items

### 11.3 Continuous Improvement

**Month 1:**
- [ ] Gather user feedback
- [ ] Fix critical bugs
- [ ] Optimize delivery routes
- [ ] Improve UI based on usage data

**Month 2:**
- [ ] Add customer reviews and ratings
- [ ] Implement loyalty program
- [ ] Add scheduled orders
- [ ] Improve recommendation algorithm

**Month 3:**
- [ ] Expand to new areas
- [ ] Add more vendors
- [ ] Launch mobile apps (if not done)
- [ ] Add live order tracking
- [ ] Implement surge pricing

---

## 🛠️ Troubleshooting Guide

### Common Issues

**Orders showing "success" but not appearing in database:**
- **Symptom**: Order confirmation shows success message and order ID, but orders don't appear in My Orders, Vendor, or Rider views
- **Root Cause**: Supabase environment variables not configured or database connection failing
- **Solution**:
  1. Verify `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set in Netlify environment variables
  2. Check Netlify function logs for `[supabase]` error messages
  3. Verify the `orders` table exists in Supabase with correct schema (see SUPABASE_SETUP.md)
  4. Ensure the `vendor_name` column exists in the orders table (run migration SQL if needed)
  5. Test Supabase connection directly using SQL editor
  6. If errors persist, check that service role key has write permissions
- **Prevention**: Always check Netlify function logs after placing test orders

**Orders not appearing in vendor dashboard:**
- Check vendor_id matches exactly
- Verify API endpoint is being called
- Check browser console for errors
- Verify Supabase connection

**Payment failures:**
- Verify Razorpay keys are correct
- Check if using test/live mode correctly
- Verify webhook is configured
- Check payment gateway dashboard

**Notifications not sending:**
- Verify Twilio credentials
- Check phone number format (+91...)
- Verify email SMTP settings
- Check notification logs

**Slow performance:**
- Enable database indexes
- Optimize API queries
- Enable CDN for static assets
- Add caching layer

---

## 📞 Support Resources

**Supabase:**
- Docs: https://supabase.com/docs
- Discord: https://discord.supabase.com

**Razorpay:**
- Docs: https://razorpay.com/docs
- Support: support@razorpay.com

**Netlify:**
- Docs: https://docs.netlify.com
- Support: support@netlify.com

**Twilio:**
- Docs: https://www.twilio.com/docs
- Support: https://support.twilio.com

---

## 🎯 Success Metrics

Track these KPIs after launch:

**Business Metrics:**
- Daily orders
- Average order value
- Customer retention rate
- Vendor ratings
- Delivery success rate

**Technical Metrics:**
- API response time
- Error rate
- Uptime percentage
- Payment success rate
- Notification delivery rate

**User Metrics:**
- Active users
- New registrations
- App downloads (if mobile)
- Session duration
- Conversion rate

---

## 📝 Summary

This guide provides a complete roadmap from prototype to production. Follow each step sequentially, marking them as DONE as you complete them.

**Estimated Timeline:** 6 weeks to launch
**Estimated Cost:** 
- Supabase: Free tier (upgrade as needed)
- Netlify: Free tier (upgrade as needed)
- Razorpay: 2% per transaction
- Twilio: ~₹0.50 per SMS
- Domain: ~₹1000/year (optional)

**Total Initial Investment:** ~₹10,000-20,000 (without marketing)

---

**Good luck with your launch! 🚀**

When you say "DONE" to each step, I'll provide detailed guidance for the next one.
