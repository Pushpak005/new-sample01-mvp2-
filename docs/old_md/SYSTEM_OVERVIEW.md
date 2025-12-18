# System Overview - Healthy Food Delivery Platform

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT APPS                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │  User App    │  │   Vendor     │  │    Admin     │         │
│  │  (index.html)│  │  Dashboard   │  │  Dashboard   │         │
│  │  + Orders    │  │ (vendor.html)│  │ (admin.html) │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
│                                                                 │
│                    ┌──────────────┐                            │
│                    │    Rider     │                            │
│                    │  Dashboard   │                            │
│                    │ (rider.html) │                            │
│                    └──────────────┘                            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ HTTP/JSON
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                       NETLIFY FUNCTIONS                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  POST /api/orders          - Create new order                  │
│  GET  /api/orders          - Get orders (filtered)             │
│  POST /api/orders/status   - Update order status               │
│                                                                 │
│  ┌───────────────────────────────────────────────────┐         │
│  │  Orders API (orders.js)                           │         │
│  │                                                    │         │
│  │  • Input validation                               │         │
│  │  • Business logic                                 │         │
│  │  • Status management                              │         │
│  │  • Rider assignment                               │         │
│  └───────────────────────────────────────────────────┘         │
│                              │                                  │
└──────────────────────────────┼──────────────────────────────────┘
                              │
                              ▼
                  ┌────────────────────────┐
                  │   IN-MEMORY STORAGE    │
                  │   (Map Object)         │
                  │                        │
                  │  • Orders collection   │
                  │  • Order counter       │
                  │                        │
                  │  TODO: Replace with    │
                  │  Supabase/Firestore    │
                  └────────────────────────┘
```

## User Flows

### 1. Customer Orders Food

```
User browses → Clicks "Order Now" → Fills form → Submits
    ↓
Order created (status: placed)
    ↓
User sees confirmation + Order ID
    ↓
User visits "My Orders" to track
```

### 2. Vendor Processes Order

```
Vendor logs in → Sees new orders (status: placed)
    ↓
Clicks "Accept" → Order status: accepted
    ↓
Clicks "Start Preparing" → Order status: preparing
    ↓
Clicks "Ready for Pickup" → Order status: ready_for_pickup
```

### 3. Admin Assigns Rider

```
Admin logs in → Views all orders
    ↓
Filters by status: ready_for_pickup
    ↓
Clicks "Assign Rider" → Selects rider from dropdown
    ↓
Rider assigned to order
```

### 4. Rider Delivers Order

```
Rider logs in → Sees assigned orders
    ↓
Goes to restaurant → Clicks "Picked Up"
    ↓
Order status: out_for_delivery
    ↓
Delivers to customer → Clicks "Mark Delivered"
    ↓
Order status: delivered (complete!)
```

## Order Status Flow

```
placed
  │
  │ Vendor accepts
  ▼
accepted
  │
  │ Vendor starts cooking
  ▼
preparing
  │
  │ Vendor finishes cooking
  ▼
ready_for_pickup
  │
  │ Admin assigns rider
  ├──┐
  │  │ Rider picks up
  ▼  ▼
out_for_delivery
  │
  │ Rider delivers
  ▼
delivered ✓
```

Alternative flows:
```
placed/accepted/preparing
  │
  │ Vendor/Admin cancels
  ▼
cancelled ✗
```

## Data Model

### Order Schema

```javascript
{
  order_id: "ord_1763439686886_gn7ukoa",    // Unique ID
  user_id: "user_123",                       // Customer ID
  vendor_id: "wakad-healthybee",            // Restaurant ID
  vendor_name: "Healthybee",                // Restaurant name
  dish_id: "hb-paneer-sprouts-salad",       // Menu item ID
  dish_title: "Paneer Sprouts Salad",       // Menu item name
  quantity: 2,                              // Number of items
  price: 259,                               // Price per item (₹)
  address: "123 Test St, Wakad, Pune",      // Delivery address
  phone: "9876543210",                      // Customer phone
  status: "placed",                         // Current status
  rider_id: null,                           // Assigned rider (null if unassigned)
  created_at: "2025-11-18T04:30:00.000Z",  // Creation timestamp
  updated_at: "2025-11-18T04:30:00.000Z"   // Last update timestamp
}
```

### Status Values

| Status | Description | Who Can Set |
|--------|-------------|-------------|
| `placed` | Order created, awaiting vendor | System (auto) |
| `accepted` | Vendor confirmed | Vendor |
| `preparing` | Food being cooked | Vendor |
| `ready_for_pickup` | Ready for rider | Vendor |
| `out_for_delivery` | Rider has picked up | Rider |
| `delivered` | Completed successfully | Rider |
| `cancelled` | Rejected or cancelled | Vendor, Admin |

## Access Control

### User App
- No login required (demo)
- User ID stored in localStorage
- Can only see own orders

### Vendor Dashboard
- Restaurant selection + PIN (1234)
- Can only see own restaurant's orders
- Can update order status (accept → ready_for_pickup)

### Admin Dashboard
- Admin key required (demo_admin_key_123)
- Can see ALL orders
- Can update any order status
- Can assign riders

### Rider Dashboard
- Rider selection + PIN (1234)
- Can only see assigned orders
- Can update status (ready_for_pickup → delivered)

## Security Notes

**⚠️ Current Implementation (Demo Only)**
- Hard-coded PINs and keys
- No encryption
- No rate limiting
- In-memory storage (data loss on restart)

**✅ Production Requirements**
- Environment variables for secrets
- JWT or OAuth authentication
- HTTPS-only
- Database with backups
- Rate limiting + DDoS protection
- Input sanitization
- XSS/CSRF protection
- Audit logging

## Tech Stack

### Frontend
- Vanilla JavaScript (ES6+)
- HTML5
- CSS3 (existing styles.css)
- No frameworks/libraries (intentionally simple)

### Backend
- Netlify Functions (serverless)
- Node.js
- In-memory Map storage (temporary)

### Deployment
- Netlify (static hosting + functions)
- Git-based deployment
- Auto-deploy on push

## File Structure

```
acl025/
├── index.html              # User app - main page
├── orders.html             # User app - my orders
├── vendor.html             # Vendor dashboard
├── admin.html              # Admin dashboard
├── rider.html              # Rider dashboard
├── app.js                  # User app logic
├── styles.css              # Shared styles
├── netlify/
│   └── functions/
│       └── orders.js       # Orders API
├── ORDERING_GUIDE.md       # User documentation
├── TESTING_SUMMARY.md      # Test results
└── SYSTEM_OVERVIEW.md      # This file
```

## Key Features

### User Experience
✅ Only shows "Best fit" healthy recommendations  
✅ Clear health tags (High protein, Low sodium, etc.)  
✅ Simple order form with 3 fields  
✅ Real-time order tracking  
✅ Auto-refresh for live updates  

### Vendor Experience
✅ All orders in one place  
✅ Customer contact info visible  
✅ One-click status updates  
✅ Mobile-friendly interface  

### Admin Experience
✅ Full system overview  
✅ Filter and search orders  
✅ Manual intervention possible  
✅ Rider management  

### Rider Experience
✅ Clear pickup and drop info  
✅ Earnings tracker  
✅ Simple action buttons  
✅ Fast refresh for new orders  

## Performance

- API response time: ~100ms (in-memory)
- Page load: <1s (static HTML)
- Auto-refresh intervals:
  - User: 30s
  - Vendor: 15s
  - Admin: 20s
  - Rider: 10s
- Concurrent requests: Limited by Netlify free tier

## Future Enhancements

### High Priority
1. Persistent database (Supabase)
2. Real authentication system
3. Payment integration (Razorpay)
4. SMS notifications

### Medium Priority
5. Live location tracking (Google Maps)
6. WebSocket for real-time updates
7. Order history and analytics
8. Customer reviews and ratings

### Low Priority
9. Multi-language support
10. Voice ordering
11. Loyalty program
12. Scheduled orders

---

**System Status**: ✅ Prototype Complete  
**Production Ready**: ❌ Requires DB + Auth + Payments  
**Last Updated**: 2025-11-18
