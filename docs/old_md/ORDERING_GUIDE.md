# Ordering & Logistics System - User Guide

This guide explains how to use the new ordering and delivery management features added to the Healthy Diet app.

## Overview

The system now includes:
1. **User App** - Browse and order healthy food
2. **Vendor Dashboard** - Restaurants manage incoming orders
3. **Admin Dashboard** - Control center for all orders
4. **Rider Dashboard** - Delivery partners manage deliveries

## User App Features

### Simplified Health Recommendations
- Only shows dishes with "Best fit" label (highest health match)
- Clear health tags: "High protein", "Low sodium", "Light meal", etc.
- Removed confusing "OK" and "Caution" labels
- Removed "Today's focus" strip for cleaner UI

### Ordering Food
1. Browse "Today's Picks" on the homepage
2. Click "Order Now" on any dish
3. Fill in:
   - Quantity (1-5)
   - Delivery address
   - Phone number
4. Click "Confirm Order"
5. View order confirmation with Order ID

### My Orders Page
- Access from order confirmation link or directly at `orders.html`
- See all your orders with:
  - Dish name and restaurant
  - Order status (Placed → Accepted → Preparing → Ready → Out for Delivery → Delivered)
  - Quantity and total price
  - Delivery address
  - Order ID and timestamp
- Auto-refreshes every 30 seconds

## Vendor Dashboard (`vendor.html`)

### Login
- Select your restaurant from dropdown
- Enter PIN: **1234** (demo)
- Available restaurants:
  - Healthybee (Wakad)
  - Swad Gomantak (Wakad)
  - Shree Krishna Veg (Wakad)

### Managing Orders
- View all orders for your restaurant
- See customer details (phone, address)
- Action buttons:
  - **Accept** - Confirm you can prepare the order
  - **Reject** - Cancel the order
  - **Start Preparing** - Mark order as being cooked
  - **Ready for Pickup** - Notify rider to collect

### Features
- Auto-refreshes every 15 seconds
- Orders sorted by newest first
- Clear status indicators
- Customer contact info for quick reference

## Admin Dashboard (`admin.html`)

### Login
- Enter admin key: **demo_admin_key_123**

### Managing All Orders
- View ALL orders across all restaurants
- Filter by status:
  - Placed, Accepted, Preparing, Ready, Out for Delivery, Delivered, Cancelled
- See complete order details in table format:
  - Order ID
  - Dish and vendor
  - Customer phone and address
  - Current status
  - Assigned rider
  - Creation time

### Admin Actions
- **Change Status** - Manually update any order status
- **Assign Rider** - Select and assign delivery partner:
  - Raj Kumar
  - Amit Sharma
  - Priya Singh
  - Vikram Patel

### Features
- Auto-refreshes every 20 seconds
- Sortable and filterable
- Bulk operations possible
- Full control over order lifecycle

## Rider Dashboard (`rider.html`)

### Login
- Select your rider ID from dropdown
- Enter PIN: **1234** (demo)
- Available riders:
  - Raj Kumar
  - Amit Sharma
  - Priya Singh
  - Vikram Patel

### Managing Deliveries
- View orders assigned to you
- See two sections per order:
  - **Pickup** - Restaurant name and area
  - **Drop** - Customer address and phone
- Action buttons:
  - **Picked Up** - Mark as collected from restaurant
  - **Mark Delivered** - Confirm delivery complete

### Today's Summary
- **Completed** - Number of deliveries finished today
- **Active** - Currently assigned deliveries
- **Earnings** - Estimated earnings (₹30 per delivery)

### Features
- Auto-refreshes every 10 seconds
- Mobile-optimized interface
- Clear pickup and drop information
- Real-time earnings tracker

## API Endpoints

### Orders API (`/api/orders`)

#### Create Order
```
POST /api/orders
Content-Type: application/json

{
  "user_id": "user_123",
  "vendor_id": "wakad-healthybee",
  "vendor_name": "Healthybee",
  "dish_id": "hb-paneer-sprouts-salad",
  "dish_title": "Paneer Sprouts Salad",
  "quantity": 2,
  "price": 259,
  "address": "123 Test St, Wakad, Pune",
  "phone": "9876543210"
}
```

#### Get Orders
```
GET /api/orders?user=user_123          # User's orders
GET /api/orders?vendor=wakad-healthybee # Vendor's orders
GET /api/orders?rider=rider_raj         # Rider's orders
GET /api/orders?admin_key=demo_admin_key_123 # All orders (admin)
GET /api/orders?status=placed           # Filter by status
```

#### Update Order Status
```
POST /api/orders/status
Content-Type: application/json

{
  "order_id": "ord_1234567890_abc",
  "status": "accepted",
  "rider_id": "rider_raj"  // optional
}
```

Valid statuses:
- `placed` - Order created
- `accepted` - Restaurant confirmed
- `preparing` - Being cooked
- `ready_for_pickup` - Ready for rider
- `out_for_delivery` - Rider has picked up
- `delivered` - Completed
- `cancelled` - Rejected/cancelled

## Order Lifecycle

```
User Places Order
    ↓
[placed] - New order created
    ↓
Vendor Accepts
    ↓
[accepted] - Restaurant confirmed
    ↓
Vendor Starts Preparing
    ↓
[preparing] - Food being cooked
    ↓
Vendor Marks Ready
    ↓
[ready_for_pickup] - Waiting for rider
    ↓
Admin Assigns Rider
    ↓
Rider Picks Up
    ↓
[out_for_delivery] - On the way
    ↓
Rider Delivers
    ↓
[delivered] - Complete!
```

## Storage

Currently uses **in-memory storage** (Map object in Node.js).

⚠️ **Important**: Orders are lost when the Netlify function container restarts.

### Planned Upgrades

To add persistent storage, integrate one of:
1. **Supabase** (PostgreSQL) - Recommended
2. **Firestore** (NoSQL)
3. **MongoDB Atlas**
4. **Netlify Blobs** (simple JSON)

See TODO comments in `netlify/functions/orders.js`.

## Testing Locally

1. Install Netlify CLI:
   ```bash
   npm install -g netlify-cli
   ```

2. Start dev server:
   ```bash
   netlify dev
   ```

3. Access:
   - User app: http://localhost:8888/
   - My Orders: http://localhost:8888/orders.html
   - Vendor: http://localhost:8888/vendor.html
   - Admin: http://localhost:8888/admin.html
   - Rider: http://localhost:8888/rider.html

## Demo Credentials

### Vendors
- PIN: **1234** (all restaurants)

### Admin
- Key: **demo_admin_key_123**

### Riders
- PIN: **1234** (all riders)

## Security Notes

For **production deployment**:
1. ✅ Use environment variables for keys/PINs
2. ✅ Add proper authentication (JWT/OAuth)
3. ✅ Implement rate limiting
4. ✅ Add HTTPS-only enforcement
5. ✅ Validate all inputs server-side
6. ✅ Use a real database with backups
7. ✅ Add order amount limits
8. ✅ Implement payment gateway integration

Current demo credentials are **intentionally simple** for prototype testing.

## Troubleshooting

### Orders not loading
- Check browser console for errors
- Verify API endpoint is accessible
- Ensure user/vendor/rider ID is valid

### "Ordering temporarily unavailable" message
- API function may be offline
- Check Netlify function logs
- Verify network connectivity

### Orders disappear after refresh
- This is expected with in-memory storage
- Upgrade to persistent database for production

## Next Steps

1. Integrate payment gateway (Razorpay/Stripe)
2. Add real-time order tracking with maps
3. Implement SMS/email notifications
4. Add customer support chat
5. Build analytics dashboard
6. Add review and rating system
7. Implement loyalty program
8. Add scheduled/bulk ordering

## Support

For issues or questions:
- Check the code comments in each file
- Review the order schema in `orders.js`
- Test API endpoints directly using curl/Postman
- Check browser DevTools for errors

---

Built with ❤️ for healthy living
