# Supabase Setup Guide for Orders API

This document explains how to set up Supabase as the persistent storage backend for the orders API.

## Prerequisites

- A Supabase account (sign up at https://supabase.com)
- Access to Netlify environment variables
- The repository already includes `@supabase/supabase-js` in dependencies

## Step 1: Create Supabase Project

1. Log in to Supabase
2. Create a new project
3. Note down your project URL and service role key

## Step 2: Create Orders Table

Run the following SQL in the Supabase SQL Editor to create the `orders` table:

```sql
-- Create orders table
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  user_phone TEXT NOT NULL,
  user_name TEXT NOT NULL,
  vendor_id TEXT NOT NULL,
  vendor_name TEXT NOT NULL,
  dish_name TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  amount NUMERIC NOT NULL,
  status TEXT NOT NULL,
  allocation_status TEXT DEFAULT 'unassigned',
  assigned_rider_id TEXT,
  current_candidate_rider_id TEXT,
  candidate_riders JSONB DEFAULT '[]'::jsonb,
  address TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add vendor_name column if it doesn't exist (for existing tables)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS vendor_name TEXT;

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_orders_user_name ON orders(user_name);
CREATE INDEX IF NOT EXISTS idx_orders_vendor_id ON orders(vendor_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_assigned_rider ON orders(assigned_rider_id);
CREATE INDEX IF NOT EXISTS idx_orders_current_candidate ON orders(current_candidate_rider_id);
CREATE INDEX IF NOT EXISTS idx_orders_allocation_status ON orders(allocation_status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);

-- Add Row Level Security (RLS) policies if needed
-- Note: For now, the service role key is used which bypasses RLS
-- Enable RLS in production and add appropriate policies

-- ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Example policy for authenticated users to read their own orders:
-- CREATE POLICY "Users can view own orders" ON orders
--   FOR SELECT
--   USING (user_name = auth.uid()::text);
```

## Step 3: Set Environment Variables in Netlify

1. Go to your Netlify site dashboard
2. Navigate to **Site settings** > **Environment variables**
3. Add the following variables:

   - `SUPABASE_URL`: Your Supabase project URL (e.g., `https://xxxxx.supabase.co`)
   - `SUPABASE_SERVICE_ROLE_KEY`: Your Supabase service role key (not the anon key)

4. Save the changes

## Step 4: Deploy

After the environment variables are set, deploy your site to Netlify. The orders API will automatically:

1. Connect to Supabase on startup
2. Write new orders to the database
3. Update order status and rider assignments in the database
4. Read orders from Supabase instead of in-memory storage
5. Fall back to in-memory storage if Supabase is unavailable

## Schema Mapping

The application order object maps to the Supabase table as follows:

| Application Field             | Supabase Column                | Type      | Notes                                    |
|------------------------------|--------------------------------|-----------|------------------------------------------|
| `order_id`                   | `id`                           | TEXT      | Primary key                              |
| `phone`                      | `user_phone`                   | TEXT      | Customer phone number                    |
| `user_id`                    | `user_name`                    | TEXT      | User identifier                          |
| `vendor_id`                  | `vendor_id`                    | TEXT      | Restaurant/vendor ID                     |
| `vendor_name`                | `vendor_name`                  | TEXT      | Restaurant/vendor name                   |
| `dish_title`                 | `dish_name`                    | TEXT      | Dish/item name                           |
| `quantity`                   | `quantity`                     | INTEGER   | Number of items                          |
| `price * quantity`           | `amount`                       | NUMERIC   | Total order amount                       |
| `status`                     | `status`                       | TEXT      | Order status                             |
| `allocation_status`          | `allocation_status`            | TEXT      | Rider allocation status                  |
| `assigned_rider_id`          | `assigned_rider_id`            | TEXT      | Assigned rider ID (nullable)             |
| `current_candidate_rider_id` | `current_candidate_rider_id`   | TEXT      | Current candidate rider (nullable)       |
| `candidate_riders`           | `candidate_riders`             | JSONB     | Array of rider IDs who were offered      |
| `address`                    | `address`                      | TEXT      | Delivery address                         |
| `created_at`                 | `created_at`                   | TIMESTAMPTZ | Order creation timestamp                |
| `updated_at`                 | `updated_at`                   | TIMESTAMPTZ | Last update timestamp                   |

## API Behavior

### Order Creation (POST /api/orders)

When a new order is created:
1. Order is stored in in-memory Map
2. Order is upserted to Supabase `orders` table
3. If Supabase sync fails, error is logged but request succeeds
4. Order ID is returned to the client

### Order Retrieval (GET /api/orders)

When orders are requested:
1. System attempts to query Supabase first
2. Filters are applied (user, vendor, rider, status)
3. Results are mapped back to application format
4. If Supabase fails, falls back to in-memory storage
5. Orders are returned in the same JSON format as before

### Order Updates (POST /api/orders/status)

When order status or rider assignment is updated:
1. In-memory order is updated
2. Changes are synced to Supabase
3. If Supabase sync fails, error is logged but request succeeds
4. Updated order is returned to the client

### Rider Responses (POST /api/orders/rider-response)

When a rider accepts or rejects an order:
1. In-memory order is updated with rider decision
2. Next rider may be selected (on reject)
3. Changes are synced to Supabase
4. If Supabase sync fails, error is logged but request succeeds
5. Response is returned to the client

## Monitoring and Debugging

All Supabase operations are logged with the `[supabase]` prefix:

- `[supabase] Client initialized successfully` - Supabase connected
- `[supabase] Order synced successfully: {order_id}` - Successful write
- `[supabase] Fetched {count} orders from database` - Successful read
- `[supabase] Error syncing order: {error}` - Write failure
- `[supabase] Using in-memory storage for order retrieval` - Fallback to in-memory

Check Netlify function logs to monitor Supabase integration.

## Troubleshooting

### Orders showing success but not persisting to Supabase

**Symptoms:**
- Order confirmation shows "Order placed successfully" with an order ID
- Orders don't appear in My Orders, Vendor dashboard, or Rider dashboard
- Browser console shows 502 errors when fetching orders
- Netlify logs show `[supabase] Fetched 0 orders from database`

**Root Causes & Solutions:**

1. **Missing environment variables**
   - Check that `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set in Netlify environment variables
   - Verify the environment variables are not empty strings
   - After adding/updating env vars, redeploy your site (Netlify doesn't auto-deploy on env var changes)

2. **Database connection failure**
   - Check Netlify function logs for `[supabase]` error messages
   - Look for messages like "Failed to save order to database" or "Error syncing order"
   - Verify you're using the SERVICE ROLE KEY, not the anon key (anon key has limited permissions)

3. **Table schema mismatch**
   - Ensure the `orders` table exists in Supabase
   - Verify the service role key has permission to write to the table
   - **Important**: If you created the table before this update, add the `vendor_name` column:
     ```sql
     ALTER TABLE orders ADD COLUMN IF NOT EXISTS vendor_name TEXT;
     ```
   - Verify all required columns exist (run the complete CREATE TABLE script from above)

4. **Wrong Supabase project**
   - Verify you're using the correct Supabase project URL (e.g., production vs development)
   - Check that the URL matches the project where you created the `orders` table

### Orders not reading from Supabase

1. Check for `[supabase]` error messages in logs
2. Verify table schema matches expected structure
3. Test Supabase connection directly using the service role key
4. Check if fallback to in-memory is occurring
5. Verify user_name column is being populated correctly

### Rider filtering not working

1. Verify `allocation_status`, `assigned_rider_id`, and `current_candidate_rider_id` columns exist
2. Check that JSONB column `candidate_riders` is properly created
3. Test rider queries directly in Supabase SQL editor

## Data Migration

If you have existing orders in another system:

1. Export orders to CSV or JSON
2. Transform to match the Supabase schema
3. Import using Supabase dashboard or SQL INSERT statements
4. Verify data integrity with SELECT queries

## Security Considerations

- The service role key bypasses Row Level Security (RLS)
- Store the service role key securely in Netlify environment variables
- Consider enabling RLS policies for additional security in production
- Monitor Supabase logs for unusual activity
- Rotate service role key periodically

## Next Steps

After successful integration:

1. Monitor logs for the first few orders
2. Verify data is persisting in Supabase dashboard
3. Test all user flows (user, vendor, admin, rider)
4. Consider adding RLS policies for production
5. Set up Supabase backup and recovery procedures
