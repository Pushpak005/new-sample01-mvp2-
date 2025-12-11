-- ================================================================
-- SUPABASE DATABASE SETUP SCRIPT
-- Run this script in Supabase SQL Editor to set up all tables
-- ================================================================

-- 1. ORDERS TABLE
-- Stores all order information
CREATE TABLE IF NOT EXISTS orders (
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

-- Indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_vendor ON orders(vendor_id);
CREATE INDEX IF NOT EXISTS idx_orders_rider ON orders(rider_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_payment ON orders(payment_status);

-- 2. USERS TABLE
-- Stores customer information
CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  user_id VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(200),
  email VARCHAR(200) UNIQUE,
  phone VARCHAR(20),
  address TEXT,
  preferences JSONB, -- Store dietary preferences, allergies, etc.
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_login TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);

-- 3. VENDORS TABLE
-- Stores restaurant/vendor information
CREATE TABLE IF NOT EXISTS vendors (
  id BIGSERIAL PRIMARY KEY,
  vendor_id VARCHAR(100) UNIQUE NOT NULL,
  name VARCHAR(200) NOT NULL,
  area VARCHAR(100),
  address TEXT,
  phone VARCHAR(20),
  email VARCHAR(200),
  pin_hash VARCHAR(100), -- Store hashed PIN for security
  is_active BOOLEAN DEFAULT true,
  rating DECIMAL(3,2) DEFAULT 0.00,
  total_orders INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vendors_active ON vendors(is_active);
CREATE INDEX IF NOT EXISTS idx_vendors_area ON vendors(area);

-- 4. RIDERS TABLE
-- Stores delivery partner information
CREATE TABLE IF NOT EXISTS riders (
  id BIGSERIAL PRIMARY KEY,
  rider_id VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(200) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  vehicle_type VARCHAR(50), -- bike, scooter, bicycle
  pin_hash VARCHAR(100), -- Store hashed PIN
  is_active BOOLEAN DEFAULT true,
  is_online BOOLEAN DEFAULT false,
  current_location POINT, -- Geographic location (lat, lng)
  earnings_total DECIMAL(10,2) DEFAULT 0,
  total_deliveries INTEGER DEFAULT 0,
  rating DECIMAL(3,2) DEFAULT 0.00,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_riders_active ON riders(is_active);
CREATE INDEX IF NOT EXISTS idx_riders_online ON riders(is_online);

-- 5. VENDOR MENU TABLE
-- Stores menu items for each vendor
CREATE TABLE IF NOT EXISTS vendor_menu (
  id BIGSERIAL PRIMARY KEY,
  vendor_id VARCHAR(100) NOT NULL,
  dish_id VARCHAR(100) UNIQUE NOT NULL,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL,
  category VARCHAR(100), -- salad, main, dessert, etc.
  health_tags TEXT[], -- Array of health tags
  nutrition_info JSONB, -- Store detailed nutrition information
  image_url TEXT,
  is_available BOOLEAN DEFAULT true,
  preparation_time INTEGER, -- in minutes
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  FOREIGN KEY (vendor_id) REFERENCES vendors(vendor_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_menu_vendor ON vendor_menu(vendor_id);
CREATE INDEX IF NOT EXISTS idx_menu_available ON vendor_menu(is_available);
CREATE INDEX IF NOT EXISTS idx_menu_category ON vendor_menu(category);

-- 6. ORDER AUDIT LOG
-- Tracks all status changes for auditing
CREATE TABLE IF NOT EXISTS order_audit (
  id BIGSERIAL PRIMARY KEY,
  order_id VARCHAR(50) NOT NULL,
  old_status VARCHAR(30),
  new_status VARCHAR(30),
  changed_by VARCHAR(100), -- user_id, vendor_id, rider_id, or 'system'
  changed_by_type VARCHAR(20), -- 'user', 'vendor', 'rider', 'admin', 'system'
  notes TEXT,
  changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_order ON order_audit(order_id);
CREATE INDEX IF NOT EXISTS idx_audit_time ON order_audit(changed_at DESC);

-- 7. REVIEWS TABLE
-- Customer reviews and ratings
CREATE TABLE IF NOT EXISTS reviews (
  id BIGSERIAL PRIMARY KEY,
  order_id VARCHAR(50) UNIQUE NOT NULL,
  user_id VARCHAR(50) NOT NULL,
  vendor_id VARCHAR(100) NOT NULL,
  rider_id VARCHAR(50),
  food_rating INTEGER CHECK (food_rating >= 1 AND food_rating <= 5),
  delivery_rating INTEGER CHECK (delivery_rating >= 1 AND delivery_rating <= 5),
  comment TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reviews_vendor ON reviews(vendor_id);
CREATE INDEX IF NOT EXISTS idx_reviews_rider ON reviews(rider_id);

-- 8. NOTIFICATIONS TABLE
-- Track sent notifications
CREATE TABLE IF NOT EXISTS notifications (
  id BIGSERIAL PRIMARY KEY,
  recipient_id VARCHAR(50) NOT NULL,
  recipient_type VARCHAR(20), -- 'user', 'vendor', 'rider'
  notification_type VARCHAR(50), -- 'sms', 'email', 'push'
  subject VARCHAR(200),
  message TEXT,
  status VARCHAR(20) DEFAULT 'sent', -- 'sent', 'failed', 'delivered'
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notif_recipient ON notifications(recipient_id);
CREATE INDEX IF NOT EXISTS idx_notif_sent ON notifications(sent_at DESC);

-- 9. PROMOTIONS TABLE
-- Discount codes and promotional campaigns
CREATE TABLE IF NOT EXISTS promotions (
  id BIGSERIAL PRIMARY KEY,
  code VARCHAR(50) UNIQUE NOT NULL,
  description TEXT,
  discount_type VARCHAR(20), -- 'percentage', 'fixed'
  discount_value DECIMAL(10,2),
  min_order_value DECIMAL(10,2),
  max_discount DECIMAL(10,2),
  valid_from TIMESTAMP WITH TIME ZONE,
  valid_until TIMESTAMP WITH TIME ZONE,
  usage_limit INTEGER,
  usage_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_promo_code ON promotions(code);
CREATE INDEX IF NOT EXISTS idx_promo_active ON promotions(is_active);

-- ================================================================
-- FUNCTIONS AND TRIGGERS
-- ================================================================

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for orders table
DROP TRIGGER IF EXISTS update_orders_updated_at ON orders;
CREATE TRIGGER update_orders_updated_at 
  BEFORE UPDATE ON orders 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger for vendor_menu table
DROP TRIGGER IF EXISTS update_menu_updated_at ON vendor_menu;
CREATE TRIGGER update_menu_updated_at 
  BEFORE UPDATE ON vendor_menu 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Function to log order status changes
CREATE OR REPLACE FUNCTION log_order_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO order_audit (order_id, old_status, new_status, changed_by_type)
    VALUES (NEW.order_id, OLD.status, NEW.status, 'system');
  END IF;
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to automatically log status changes
DROP TRIGGER IF EXISTS track_order_status_changes ON orders;
CREATE TRIGGER track_order_status_changes
  AFTER UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION log_order_status_change();

-- ================================================================
-- ROW LEVEL SECURITY (RLS)
-- Enable RLS for production security
-- ================================================================

-- Enable RLS on all tables
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE riders ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_menu ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own orders
CREATE POLICY users_own_orders ON orders
  FOR SELECT
  USING (auth.uid()::text = user_id);

-- Policy: Vendors can see their own orders
CREATE POLICY vendors_own_orders ON orders
  FOR SELECT
  USING (auth.uid()::text = vendor_id);

-- Policy: Riders can see assigned orders
CREATE POLICY riders_assigned_orders ON orders
  FOR SELECT
  USING (auth.uid()::text = rider_id);

-- Policy: Users can read vendor menu
CREATE POLICY public_vendor_menu ON vendor_menu
  FOR SELECT
  USING (true);

-- Policy: Vendors can manage their menu
CREATE POLICY vendors_own_menu ON vendor_menu
  FOR ALL
  USING (auth.uid()::text = vendor_id);

-- ================================================================
-- INITIAL DATA (Sample vendors and riders)
-- ================================================================

-- Insert sample vendors
INSERT INTO vendors (vendor_id, name, area, phone, email, is_active) VALUES
  ('wakad-healthybee', 'Healthybee', 'Wakad', '9876543210', 'contact@healthybee.com', true),
  ('wakad-swad', 'Swad Gomantak', 'Wakad', '9876543211', 'contact@swadgomantak.com', true),
  ('wakad-krishna', 'Shree Krishna Veg', 'Wakad', '9876543212', 'contact@krishnaveg.com', true)
ON CONFLICT (vendor_id) DO NOTHING;

-- Insert sample riders
INSERT INTO riders (rider_id, name, phone, vehicle_type, is_active) VALUES
  ('rider_raj', 'Raj Kumar', '9123456781', 'bike', true),
  ('rider_amit', 'Amit Sharma', '9123456782', 'scooter', true),
  ('rider_priya', 'Priya Singh', '9123456783', 'bike', true),
  ('rider_vikram', 'Vikram Patel', '9123456784', 'bicycle', true)
ON CONFLICT (rider_id) DO NOTHING;

-- ================================================================
-- ANALYTICS VIEWS
-- Create views for easy analytics queries
-- ================================================================

-- Daily orders summary
CREATE OR REPLACE VIEW daily_orders_summary AS
SELECT 
  DATE(created_at) as order_date,
  COUNT(*) as total_orders,
  SUM(price * quantity) as total_revenue,
  AVG(price * quantity) as avg_order_value,
  COUNT(DISTINCT user_id) as unique_customers,
  COUNT(CASE WHEN status = 'delivered' THEN 1 END) as delivered_orders,
  COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_orders
FROM orders
GROUP BY DATE(created_at)
ORDER BY order_date DESC;

-- Vendor performance
CREATE OR REPLACE VIEW vendor_performance AS
SELECT 
  v.vendor_id,
  v.name,
  COUNT(o.id) as total_orders,
  SUM(o.price * o.quantity) as total_revenue,
  AVG(o.price * o.quantity) as avg_order_value,
  AVG(r.food_rating) as avg_rating,
  COUNT(CASE WHEN o.status = 'delivered' THEN 1 END)::float / 
    NULLIF(COUNT(o.id), 0) * 100 as success_rate
FROM vendors v
LEFT JOIN orders o ON v.vendor_id = o.vendor_id
LEFT JOIN reviews r ON o.order_id = r.order_id
GROUP BY v.vendor_id, v.name;

-- Rider performance
CREATE OR REPLACE VIEW rider_performance AS
SELECT 
  r.rider_id,
  r.name,
  COUNT(o.id) as total_deliveries,
  SUM(o.price * o.quantity) * 0.10 as total_earnings, -- 10% commission
  AVG(rv.delivery_rating) as avg_rating,
  COUNT(CASE WHEN o.status = 'delivered' THEN 1 END)::float / 
    NULLIF(COUNT(o.id), 0) * 100 as success_rate
FROM riders r
LEFT JOIN orders o ON r.rider_id = o.rider_id
LEFT JOIN reviews rv ON o.order_id = rv.order_id
GROUP BY r.rider_id, r.name;

-- ================================================================
-- COMPLETION MESSAGE
-- ================================================================

DO $$ 
BEGIN 
  RAISE NOTICE '✅ Database setup complete!';
  RAISE NOTICE 'Tables created: orders, users, vendors, riders, vendor_menu, order_audit, reviews, notifications, promotions';
  RAISE NOTICE 'Views created: daily_orders_summary, vendor_performance, rider_performance';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '1. Update your Netlify environment variables with Supabase credentials';
  RAISE NOTICE '2. Update netlify/functions/orders.js to use Supabase instead of in-memory storage';
  RAISE NOTICE '3. Test the API endpoints';
END $$;
