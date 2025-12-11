# 📋 Go Live Checklist - Quick Reference

This is a quick reference checklist for taking the Healthy Food Delivery Platform live. For detailed instructions, refer to `PRODUCTION_DEPLOYMENT_GUIDE.md`.

---

## Week 1: Database & Authentication

### Step 1: Database Setup ⏱️ 2-3 days
- [ ] Create Supabase account at https://supabase.com
- [ ] Create new project (choose closest region)
- [ ] Run `scripts/setup-database.sql` in Supabase SQL Editor
- [ ] Copy Supabase URL and API keys
- [ ] Set environment variables in Netlify:
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_KEY`
- [ ] Update `netlify/functions/orders.js` to use Supabase
- [ ] Test database connection with sample order
- [ ] Verify data persists in Supabase dashboard

### Step 2: Authentication System ⏱️ 3-4 days
- [ ] Enable Supabase Auth providers (Email, Phone)
- [ ] Update `vendor.html` to use Supabase Auth
- [ ] Update `rider.html` to use Supabase Auth OTP
- [ ] Add user registration flow to `index.html`
- [ ] Update API endpoints to verify JWT tokens
- [ ] Test login/logout for all user types
- [ ] Remove hard-coded PINs from code

---

## Week 2: Payments & Security

### Step 3: Payment Gateway ⏱️ 3-4 days
- [ ] Create Razorpay account at https://razorpay.com
- [ ] Complete KYC verification
- [ ] Get API keys (test mode first)
- [ ] Add Razorpay to `package.json` and install
- [ ] Create `netlify/functions/create-payment.js`
- [ ] Create `netlify/functions/verify-payment.js`
- [ ] Update `app.js` to integrate Razorpay checkout
- [ ] Add Razorpay script to `index.html`
- [ ] Set environment variables:
  - `RAZORPAY_KEY_ID`
  - `RAZORPAY_KEY_SECRET`
- [ ] Test with Razorpay test cards
- [ ] Verify payment status updates in database
- [ ] Test refund process

---

## Week 3: Mobile & Operations

### Step 4: Rider Mobile App ⏱️ 4-5 days

**Option A: Progressive Web App (Recommended)**
- [ ] Create `manifest.json` for PWA
- [ ] Create `service-worker.js` for offline support
- [ ] Update `rider.html` to register service worker
- [ ] Add geolocation tracking
- [ ] Create `netlify/functions/update-rider-location.js`
- [ ] Set up push notifications
- [ ] Generate VAPID keys for web push
- [ ] Create `netlify/functions/send-notification.js`
- [ ] Test PWA installation on Android
- [ ] Test PWA installation on iOS
- [ ] Test location tracking
- [ ] Test push notifications

**Option B: React Native (If needed)**
- [ ] Set up React Native development environment
- [ ] Create new React Native project
- [ ] Install required dependencies
- [ ] Build authentication screens
- [ ] Build delivery management screens
- [ ] Integrate with backend APIs
- [ ] Add location tracking with react-native-maps
- [ ] Add push notifications with Firebase
- [ ] Test on Android device
- [ ] Test on iOS device
- [ ] Submit to Play Store
- [ ] Submit to App Store

### Step 5: Operations Dashboard ⏱️ 2-3 days
- [ ] Create `operations-dashboard.html`
- [ ] Add real-time metrics display
- [ ] Create `netlify/functions/operations-metrics.js`
- [ ] Add Chart.js for visualizations
- [ ] Display active orders count
- [ ] Display online riders count
- [ ] Display average delivery time
- [ ] Display today's revenue
- [ ] Add orders by status chart
- [ ] Add recent activity feed
- [ ] Set up auto-refresh (10 seconds)
- [ ] Test with live data

---

## Week 4: Vendor Tools & Notifications

### Step 6: Vendor App Improvements ⏱️ 3-4 days
- [ ] Add menu management section to `vendor.html`
- [ ] Create form to add new dishes
- [ ] Add ability to toggle dish availability
- [ ] Create `netlify/functions/vendor-menu.js`
- [ ] Add sales analytics section
- [ ] Create `netlify/functions/vendor-analytics.js`
- [ ] Display today's orders count
- [ ] Display today's revenue
- [ ] Display average rating
- [ ] Add sales chart (last 7 days)
- [ ] Test menu CRUD operations
- [ ] Test analytics data accuracy

### Step 7: Notifications System ⏱️ 3-4 days

**SMS Notifications (Twilio)**
- [ ] Create Twilio account at https://www.twilio.com
- [ ] Verify phone number
- [ ] Get Account SID and Auth Token
- [ ] Buy a Twilio phone number
- [ ] Add Twilio to `package.json` and install
- [ ] Create `netlify/functions/send-sms.js`
- [ ] Set environment variables:
  - `TWILIO_ACCOUNT_SID`
  - `TWILIO_AUTH_TOKEN`
  - `TWILIO_PHONE_NUMBER`
- [ ] Update order creation to send SMS to customer
- [ ] Update order creation to send SMS to vendor
- [ ] Update status changes to notify users
- [ ] Test SMS delivery

**Email Notifications**
- [ ] Set up Gmail app password OR SendGrid account
- [ ] Add nodemailer to `package.json` and install
- [ ] Create `netlify/functions/send-email.js`
- [ ] Set environment variables:
  - `EMAIL_USER`
  - `EMAIL_PASSWORD`
- [ ] Create email templates (HTML)
- [ ] Send order confirmation emails
- [ ] Send status update emails
- [ ] Test email delivery

---

## Week 5: Testing & Deployment

### Step 8: Testing & QA ⏱️ 5-6 days

**Functional Testing**
- [ ] User registration works
- [ ] User login works
- [ ] Browse dishes displays correctly
- [ ] Order placement with payment works
- [ ] Order tracking updates in real-time
- [ ] Notifications (SMS/Email) are received
- [ ] Order history displays correctly
- [ ] Vendor login works
- [ ] Vendor can view orders
- [ ] Vendor can update order status
- [ ] Vendor can manage menu
- [ ] Vendor analytics display correctly
- [ ] Rider login works (OTP)
- [ ] Rider can view assigned orders
- [ ] Rider can update delivery status
- [ ] Rider earnings calculate correctly
- [ ] Admin login works
- [ ] Admin can view all orders
- [ ] Admin can assign riders
- [ ] Admin can override statuses
- [ ] Operations dashboard shows live metrics

**Performance Testing**
- [ ] Install Apache Bench: `sudo apt-get install apache2-utils`
- [ ] Test API with 1000 concurrent requests
- [ ] Page load time < 2 seconds
- [ ] API response time < 500ms
- [ ] Database queries optimized with indexes
- [ ] Images compressed and optimized
- [ ] Enable Netlify CDN for static assets

**Security Audit**
- [ ] All API endpoints require authentication
- [ ] No API keys in frontend code
- [ ] Environment variables properly secured
- [ ] HTTPS enforced on all pages
- [ ] Input validation on all forms
- [ ] SQL injection protection verified
- [ ] XSS protection implemented
- [ ] CSRF tokens added where needed
- [ ] Rate limiting configured
- [ ] Password hashing verified (bcrypt)
- [ ] Sensitive data not logged

### Step 9: Deployment Setup ⏱️ 2-3 days

**Staging Environment**
- [ ] Create staging Netlify site
- [ ] Create staging Supabase project
- [ ] Set staging environment variables
- [ ] Use Razorpay test mode
- [ ] Connect to `develop` branch
- [ ] Deploy and test staging
- [ ] Run full test suite on staging

**Production Environment**
- [ ] Verify production Netlify site
- [ ] Set production environment variables
- [ ] Switch Razorpay to live mode
- [ ] Connect to `main` branch
- [ ] Configure custom domain (optional)
- [ ] Set up SSL certificate (auto with Netlify)

**CI/CD Pipeline**
- [ ] Create `.github/workflows/deploy.yml`
- [ ] Set up GitHub Actions secrets
- [ ] Test automated deployment
- [ ] Set up build notifications

**Monitoring**
- [ ] Create Sentry account at https://sentry.io
- [ ] Get Sentry DSN
- [ ] Add Sentry to all HTML files
- [ ] Test error reporting
- [ ] Create Google Analytics account
- [ ] Add GA tracking code
- [ ] Set up conversion goals
- [ ] Test analytics tracking

---

## Week 6: Pre-Launch & Go Live

### Step 10: Final Preparations ⏱️ 3-4 days

**Technical Final Checks**
- [ ] Database backup configured (Supabase auto-backups)
- [ ] All production environment variables set
- [ ] HTTPS certificate active
- [ ] Custom domain configured (if using)
- [ ] CDN enabled and working
- [ ] Image optimization verified
- [ ] Gzip compression enabled
- [ ] Rate limiting active
- [ ] Error monitoring active (Sentry)
- [ ] Analytics tracking active (GA)
- [ ] All APIs tested in production
- [ ] Payment gateway in live mode
- [ ] Test payment with real card (small amount)
- [ ] SMS notifications working
- [ ] Email notifications working
- [ ] Mobile apps published (if applicable)

**Content & Legal**
- [ ] All vendor menus updated and accurate
- [ ] Food images high-quality
- [ ] Pricing verified
- [ ] Create Terms of Service page
- [ ] Create Privacy Policy page
- [ ] Create Refund Policy page
- [ ] Create Contact page
- [ ] Create FAQ page
- [ ] Create About Us page
- [ ] Get legal review (recommended)

**Business Setup**
- [ ] Razorpay KYC approved
- [ ] Business bank account linked to Razorpay
- [ ] GST registration (if in India, required for >20L revenue)
- [ ] FSSAI food license obtained
- [ ] Business insurance active
- [ ] Vendor contracts signed
- [ ] Rider contracts/agreements signed
- [ ] Customer support email set up
- [ ] Customer support phone number
- [ ] Refund process documented
- [ ] Escalation matrix created

**Marketing Preparation**
- [ ] Create social media accounts (Instagram, Facebook, Twitter)
- [ ] Create Google My Business listing
- [ ] Prepare launch announcement
- [ ] Design promotional materials
- [ ] Set up referral program
- [ ] Create first-order discount codes
- [ ] Set up email marketing (Mailchimp/SendGrid)
- [ ] Create WhatsApp Business account
- [ ] Prepare PR materials
- [ ] Contact local food bloggers

### Launch Day! 🚀

**Morning Checklist (9 AM)**
- [ ] Final smoke test - place test order end-to-end
- [ ] Verify all vendors are online and ready
- [ ] Confirm minimum 3-4 riders available
- [ ] Verify payment gateway is in live mode
- [ ] Test notification flow (SMS + Email)
- [ ] Check all dashboards load correctly
- [ ] Verify database is accessible
- [ ] Check error monitoring dashboard
- [ ] Review operations metrics dashboard
- [ ] Announce "soft launch" to team

**Launch Time (12 PM)**
- [ ] Switch DNS to production (if using custom domain)
- [ ] Verify site is live at production URL
- [ ] Place first real order yourself
- [ ] Complete first order end-to-end
- [ ] Send launch announcement email
- [ ] Post launch on social media
- [ ] Share on WhatsApp groups
- [ ] Monitor error logs in real-time
- [ ] Watch operations dashboard
- [ ] Be ready for customer support

**Evening Review (6 PM)**
- [ ] Count total orders placed
- [ ] Review successful vs failed orders
- [ ] Check for any recurring errors
- [ ] Review customer feedback
- [ ] Calculate day 1 revenue
- [ ] Thank team and celebrate!
- [ ] Plan next day operations
- [ ] Document any issues found
- [ ] Schedule follow-up improvements

---

## Post-Launch Operations

### Daily Tasks
- [ ] Morning: Check operations dashboard
- [ ] Morning: Review previous day orders
- [ ] Morning: Resolve payment issues
- [ ] Morning: Confirm vendor/rider availability
- [ ] Evening: Reconcile payments
- [ ] Evening: Process refunds if needed
- [ ] Evening: Calculate rider payouts
- [ ] Evening: Review analytics
- [ ] Evening: Respond to customer feedback

### Weekly Tasks (Every Monday)
- [ ] Review weekly metrics
- [ ] Plan marketing campaigns
- [ ] Onboard new vendors (if needed)
- [ ] Recruit riders (if needed)
- [ ] Update menu items
- [ ] Review and respond to reviews
- [ ] Plan improvements

### Monthly Tasks
- [ ] Generate financial reports
- [ ] Pay vendors and riders
- [ ] Review and optimize costs
- [ ] Analyze customer retention
- [ ] Plan expansion (new areas/vendors)
- [ ] Review and update pricing
- [ ] Security audit
- [ ] Backup verification

---

## Success Metrics to Track

**Business KPIs**
- Daily active users
- Daily orders placed
- Average order value
- Customer retention rate (% returning)
- Vendor ratings (average)
- Rider ratings (average)
- Delivery success rate (%)
- Order fulfillment time (average)

**Technical KPIs**
- API uptime (target: 99.9%)
- Average API response time (target: <500ms)
- Error rate (target: <1%)
- Payment success rate (target: >95%)
- Notification delivery rate (target: >98%)
- Page load time (target: <2s)

**Financial KPIs**
- Gross Merchandise Value (GMV)
- Net revenue
- Customer Acquisition Cost (CAC)
- Average Revenue Per User (ARPU)
- Profit margin
- Rider cost per delivery
- Marketing ROI

---

## Emergency Contacts

**Technical Issues:**
- Supabase Support: https://supabase.com/support
- Netlify Support: https://www.netlify.com/support
- Razorpay Support: support@razorpay.com
- Twilio Support: https://support.twilio.com

**Critical Incident Response:**
1. If site is down → Check Netlify status page
2. If payments failing → Check Razorpay dashboard
3. If database errors → Check Supabase logs
4. If notifications failing → Check Twilio/email logs
5. For any issue → Check Sentry error monitoring

---

## Quick Commands Reference

```bash
# Local development
npm install
netlify dev

# Deploy to staging
netlify deploy

# Deploy to production
netlify deploy --prod

# Check logs
netlify functions:log orders

# Database backup (manual)
# Go to Supabase dashboard > Database > Backups

# Performance test
ab -n 1000 -c 10 https://your-site.netlify.app/api/orders
```

---

## Estimated Costs (Monthly)

**Free Tier (0-100 orders/day):**
- Supabase: Free
- Netlify: Free
- Razorpay: 2% per transaction (~₹200 for ₹10,000 GMV)
- Twilio SMS: ~₹500 (100 orders × 2 SMS × ₹2.50)
- **Total: ~₹700/month**

**Growth Tier (100-500 orders/day):**
- Supabase Pro: $25/month (~₹2,000)
- Netlify Pro: $19/month (~₹1,500)
- Razorpay: 2% (~₹6,000 for ₹3L GMV)
- Twilio: ~₹7,500
- **Total: ~₹17,000/month**

**Scale Tier (500+ orders/day):**
- Custom pricing required
- Consider dedicated infrastructure
- Negotiate lower payment gateway fees
- Bulk SMS rates available

---

## Timeline Summary

| Week | Focus | Key Deliverables |
|------|-------|-----------------|
| 1 | Database & Auth | Supabase setup, Auth working |
| 2 | Payments | Razorpay integrated, test payments |
| 3 | Mobile & Ops | Rider PWA, Ops dashboard |
| 4 | Vendor & Notif | Menu management, SMS/Email |
| 5 | Testing & Deploy | Full QA, staging ready |
| 6 | Launch Prep | All checks, GO LIVE! |

---

## Status Tracking

Mark your overall progress:

- [ ] Week 1: Database & Authentication
- [ ] Week 2: Payments & Security
- [ ] Week 3: Mobile & Operations
- [ ] Week 4: Vendor Tools & Notifications
- [ ] Week 5: Testing & Deployment
- [ ] Week 6: Pre-Launch & Go Live
- [ ] Post-Launch: Operations Running Smoothly

---

**Ready to start? Say "DONE" after completing each major step, and I'll guide you through the next one!** 🚀

For detailed instructions on any step, refer to `PRODUCTION_DEPLOYMENT_GUIDE.md`.
