# Billing Module — Complete Implementation Guide

> **Purpose**: This document is the single source of truth for implementing the billing module in the CRM-Plugin. It is designed so that ANY developer or AI agent can pick it up and implement end-to-end, even without prior context.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Stripe Setup](#2-stripe-setup)
3. [Database Schemas](#3-database-schemas)
4. [Plans Configuration](#4-plans-configuration)
5. [Backend API Endpoints](#5-backend-api-endpoints)
6. [Registration Flow (Stripe Customer + Free Tier)](#6-registration-flow)
7. [Subscription Lifecycle](#7-subscription-lifecycle)
8. [Stripe Webhook Handling](#8-stripe-webhook-handling)
9. [Plan Enforcement Middleware](#9-plan-enforcement-middleware)
10. [Frontend: Settings → Billing Tab](#10-frontend-billing-tab)
11. [Stripe Sync Script](#11-stripe-sync-script)
12. [File Map (What to Create / Modify)](#12-file-map)
13. [Testing Checklist](#13-testing-checklist)

---

## 1. Architecture Overview

```
┌─────────────┐     ┌─────────────────┐     ┌──────────────┐
│   Frontend   │────▶│   Backend API    │────▶│   Stripe API  │
│  (React)     │     │   (Express)      │     │              │
│              │◀────│                  │◀────│  Webhooks    │
└─────────────┘     └─────────────────┘     └──────────────┘
                           │
                     ┌─────┴─────┐
                     │  MongoDB   │
                     │ Plan       │
                     │ Subscription│
                     │ Tenant     │
                     └───────────┘
```

### Key Principles
- **Plans** are defined in `server/src/config/plans.json` (single source of truth)
- Plans sync to both **MongoDB** (`Plan` collection) and **Stripe** (Products + Prices)
- **Stripe Customer** is created at user registration time
- **Free tier** = 30-day trial subscription (no card required)
- **Paid plans** use Stripe Checkout Sessions
- **Webhooks** keep our DB in sync with Stripe's subscription state
- **Middleware** enforces plan limits on protected routes

---

## 2. Stripe Setup

### Environment Variables (add to `server/.env`)
```env
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_SUCCESS_URL=http://localhost:3000/settings?billing=success
STRIPE_CANCEL_URL=http://localhost:3000/settings?billing=cancelled
```

### NPM Dependency
```bash
cd server
npm install stripe
```

---

## 3. Database Schemas

### 3.1 Plan Model — `server/src/models/Plan.js`

```javascript
const mongoose = require('mongoose');

const planSchema = new mongoose.Schema({
  planId: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true },
  description: { type: String, default: '' },
  badge: { type: String, default: null },           // e.g. "Most Popular"
  isFree: { type: Boolean, default: false },
  trialDays: { type: Number, default: 0 },
  features: {
    maxUsers: { type: Number, default: 1 },          // -1 = unlimited
    maxChannels: { type: Number, default: 1 },
    maxContacts: { type: Number, default: 100 },
    maxMessagesPerDay: { type: Number, default: 50 },
    workflows: { type: Boolean, default: false },
    ticketing: { type: Boolean, default: false },
    apiAccess: { type: Boolean, default: false },
    prioritySupport: { type: Boolean, default: false },
    customBranding: { type: Boolean, default: false },
    bulkMessaging: { type: Boolean, default: false },
    analytics: { type: Boolean, default: false },
    teamInbox: { type: Boolean, default: false },
  },
  pricing: {
    monthly: {
      amount: { type: Number, default: 0 },         // in cents (e.g. 2900 = $29.00)
      currency: { type: String, default: 'usd' },
      stripePriceId: { type: String, default: null },
    },
    yearly: {
      amount: { type: Number, default: 0 },
      currency: { type: String, default: 'usd' },
      stripePriceId: { type: String, default: null },
    },
  },
  stripeProductId: { type: String, default: null },
  sortOrder: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.model('Plan', planSchema);
```

### 3.2 Subscription Model — `server/src/models/Subscription.js`

```javascript
const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const subscriptionSchema = new mongoose.Schema({
  subscriptionId: { type: String, default: uuidv4, unique: true, index: true },
  tenantId: { type: String, required: true, index: true },
  planId: { type: String, required: true },           // references Plan.planId
  status: {
    type: String,
    enum: [
      'trialing',        // free trial active
      'active',          // paid & active
      'past_due',        // payment failed, grace period
      'canceled',        // user canceled
      'expired',         // trial or subscription ended
      'incomplete',      // checkout started but not completed
    ],
    default: 'trialing',
  },
  billingCycle: {
    type: String,
    enum: ['monthly', 'yearly', 'none'],
    default: 'none',
  },

  // Stripe references
  stripeSubscriptionId: { type: String, default: null, index: true },
  stripeCustomerId: { type: String, default: null },

  // Trial tracking
  trialStart: { type: Date, default: null },
  trialEnd: { type: Date, default: null },

  // Paid subscription dates
  currentPeriodStart: { type: Date, default: null },
  currentPeriodEnd: { type: Date, default: null },

  // Cancellation
  cancelAtPeriodEnd: { type: Boolean, default: false },
  canceledAt: { type: Date, default: null },

  // History: keep track of plan changes
  history: [{
    planId: String,
    status: String,
    changedAt: { type: Date, default: Date.now },
    reason: String,
  }],
}, { timestamps: true });

// Only ONE active subscription per tenant
subscriptionSchema.index(
  { tenantId: 1, status: 1 },
  { unique: true, partialFilterExpression: { status: { $in: ['trialing', 'active'] } } }
);

module.exports = mongoose.model('Subscription', subscriptionSchema);
```

### 3.3 Extend Tenant Model — `server/src/models/Tenant.js`

Add `stripeCustomerId` field to the existing Tenant schema:

```javascript
// ADD these fields to the existing tenantSchema:
stripeCustomerId: { type: String, default: null, index: true },
```

---

## 4. Plans Configuration

The file `server/src/config/plans.json` is the master plan definition. It contains 4 plans:

| Plan          | Monthly | Yearly  | Max Users | Max Channels | Max Contacts | Badge        |
|---------------|---------|---------|-----------|--------------|--------------|--------------|
| Free Trial    | $0      | $0      | 2         | 1            | 100          | —            |
| Startup       | $29     | $279    | 5         | 2            | 1,000        | —            |
| Professional  | $79     | $749    | 15        | 5            | 10,000       | Most Popular |
| Enterprise    | $199    | $1,899  | Unlimited | Unlimited    | Unlimited    | —            |

> `-1` in the JSON means "unlimited".

---

## 5. Backend API Endpoints

All billing routes mount at `/api/billing`.

### 5.1 Route File — `server/src/routes/billing.js`

| Method | Path                        | Auth | Description                                     |
|--------|-----------------------------|------|-------------------------------------------------|
| GET    | `/plans`                    | No   | List all active plans (public, for pricing page) |
| GET    | `/subscription`             | Yes  | Get current tenant's subscription                |
| POST   | `/checkout`                 | Yes  | Create Stripe Checkout Session for a plan        |
| POST   | `/portal`                   | Yes  | Create Stripe Customer Portal session            |
| POST   | `/webhook`                  | No*  | Stripe webhook receiver (raw body, signature)    |
| POST   | `/sync-plans`               | No** | Admin: sync plans.json → MongoDB + Stripe        |

> *Webhook uses raw body parsing (not JSON).
> **Protected by a secret header or run as CLI script.

### 5.2 Controller — `server/src/controllers/billingController.js`

```
Key Functions:
├── getPlans(req, res)           → Return all plans from MongoDB
├── getSubscription(req, res)    → Return tenant's active subscription + plan details
├── createCheckoutSession(req, res) → Stripe Checkout for upgrading
│     Body: { planId: "professional", billingCycle: "monthly" }
│     Returns: { url: "https://checkout.stripe.com/..." }
├── createPortalSession(req, res)  → Stripe Customer Portal for managing billing
│     Returns: { url: "https://billing.stripe.com/..." }
├── handleWebhook(req, res)      → Process Stripe webhook events
└── syncPlans()                  → CLI/admin: sync plans.json to DB + Stripe
```

---

## 6. Registration Flow

**File to modify:** `server/src/controllers/authController.js` → `register()` function.

### Current Flow:
1. Validate input
2. Create Tenant
3. Hash PIN, create User
4. Set tenant.ownerId
5. Generate JWT, return

### New Flow (additions in **bold**):
1. Validate input
2. Create Tenant
3. **Create Stripe Customer** using tenant name + user email
4. **Save `stripeCustomerId` on tenant**
5. Hash PIN, create User
6. Set tenant.ownerId
7. **Create free trial Subscription** (status: `trialing`, trialEnd: now + 30 days)
8. Seed default workflows
9. Generate JWT, return

### Code Changes (authController.js register function):

```javascript
// After creating tenant, BEFORE creating user:
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const customer = await stripe.customers.create({
  email,
  name: tName,
  metadata: {
    tenantId: tenant.tenantId,
    firstName,
    lastName,
  },
});

tenant.stripeCustomerId = customer.id;
await tenant.save();

// After creating user and setting ownerId, create free trial subscription:
const Subscription = require('../models/Subscription');
const trialEnd = new Date();
trialEnd.setDate(trialEnd.getDate() + 30);

await Subscription.create({
  tenantId: tenant.tenantId,
  planId: 'free',
  status: 'trialing',
  billingCycle: 'none',
  stripeCustomerId: customer.id,
  trialStart: new Date(),
  trialEnd,
  history: [{
    planId: 'free',
    status: 'trialing',
    changedAt: new Date(),
    reason: 'Registration — 30-day free trial started',
  }],
});
```

---

## 7. Subscription Lifecycle

### 7.1 Free Trial → Paid Plan (Upgrade)

```
User clicks "Upgrade" on billing tab
    → POST /api/billing/checkout { planId, billingCycle }
    → Server creates Stripe Checkout Session with:
        - customer: tenant.stripeCustomerId
        - line_items: [{ price: plan.pricing[billingCycle].stripePriceId, quantity: 1 }]
        - mode: 'subscription'
        - metadata: { tenantId, planId, billingCycle }
    → Returns checkout URL
    → User completes payment on Stripe
    → Stripe fires webhook: checkout.session.completed
    → Server updates Subscription:
        - planId → new plan
        - status → 'active'
        - billingCycle → 'monthly' or 'yearly'
        - stripeSubscriptionId → from webhook
        - trialEnd → null (trial ended)
        - currentPeriodStart/End → from Stripe
        - Push to history
```

### 7.2 Plan Change (Upgrade/Downgrade)

```
User goes to Stripe Customer Portal (POST /api/billing/portal)
    → Stripe handles plan change UI
    → Webhook: customer.subscription.updated
    → Server reads new price → maps to planId
    → Updates Subscription in DB
```

### 7.3 Cancellation

```
User cancels via Customer Portal
    → Webhook: customer.subscription.updated (cancel_at_period_end = true)
    → Server sets cancelAtPeriodEnd = true
    → At period end: customer.subscription.deleted webhook
    → Server sets status = 'canceled'
    → Revert to expired/restricted state
```

### 7.4 Free Trial Expiry

```
Cron job or on-demand check:
    → Find subscriptions where status='trialing' AND trialEnd < now
    → Set status = 'expired'
    → Push to history
    → Tenant sees "Trial Expired — Upgrade Now" UI
```

---

## 8. Stripe Webhook Handling

### Events to Handle

| Event                               | Action                                            |
|--------------------------------------|--------------------------------------------------|
| `checkout.session.completed`         | Create/update subscription → active              |
| `customer.subscription.created`      | Upsert subscription record                        |
| `customer.subscription.updated`      | Update plan, status, period dates, cancel flag    |
| `customer.subscription.deleted`      | Set status to 'canceled'                          |
| `invoice.payment_succeeded`          | Confirm active status, update period              |
| `invoice.payment_failed`             | Set status to 'past_due'                          |

### Webhook Route Setup

> **CRITICAL**: The webhook route MUST receive the raw request body (not parsed JSON). Mount it BEFORE `express.json()` or use a separate middleware.

```javascript
// In server/src/index.js — mount BEFORE express.json():
app.use('/api/billing/webhook', express.raw({ type: 'application/json' }));

// Then after express.json():
app.use('/api/billing', billingRoutes);
```

### Webhook Controller Logic

```javascript
const handleWebhook = async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('[Billing] Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  switch (event.type) {
    case 'checkout.session.completed':
      await handleCheckoutCompleted(event.data.object);
      break;
    case 'customer.subscription.updated':
      await handleSubscriptionUpdated(event.data.object);
      break;
    case 'customer.subscription.deleted':
      await handleSubscriptionDeleted(event.data.object);
      break;
    case 'invoice.payment_failed':
      await handlePaymentFailed(event.data.object);
      break;
    default:
      console.log(`[Billing] Unhandled webhook event: ${event.type}`);
  }

  res.json({ received: true });
};
```

---

## 9. Plan Enforcement Middleware

### File: `server/src/middleware/planLimits.js`

This middleware checks whether a tenant has exceeded their plan limits before allowing certain actions.

```javascript
const Subscription = require('../models/Subscription');
const Plan = require('../models/Plan');

const checkPlanLimit = (resource) => async (req, res, next) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return res.status(401).json({ message: 'Unauthorized' });

    const subscription = await Subscription.findOne({
      tenantId,
      status: { $in: ['trialing', 'active'] },
    });

    if (!subscription) {
      return res.status(403).json({
        message: 'No active subscription. Please upgrade your plan.',
        code: 'SUBSCRIPTION_REQUIRED',
      });
    }

    // Check trial expiry
    if (subscription.status === 'trialing' && subscription.trialEnd < new Date()) {
      subscription.status = 'expired';
      subscription.history.push({
        planId: subscription.planId,
        status: 'expired',
        changedAt: new Date(),
        reason: 'Free trial expired',
      });
      await subscription.save();
      return res.status(403).json({
        message: 'Your free trial has expired. Please upgrade.',
        code: 'TRIAL_EXPIRED',
      });
    }

    const plan = await Plan.findOne({ planId: subscription.planId });
    if (!plan) return next(); // No plan found, allow (fail-open)

    const limit = plan.features[resource];
    if (limit === undefined || limit === -1) return next(); // Unlimited

    // Resource-specific count checks happen here
    // Example: if resource === 'maxChannels', count tenant's channels
    req.planLimit = limit;
    req.currentPlan = plan;
    req.subscription = subscription;
    next();
  } catch (err) {
    console.error('[PlanLimits] Error:', err.message);
    next(); // Fail-open to avoid blocking on errors
  }
};

module.exports = { checkPlanLimit };
```

### Where to Apply

```javascript
// channels route:
router.post('/', authenticate, checkPlanLimit('maxChannels'), channelController.create);

// contacts route (optional):
router.post('/', authenticate, checkPlanLimit('maxContacts'), ...);
```

---

## 10. Frontend: Billing Tab

### 10.1 Add to Settings.jsx

Add a new "Billing" tab button alongside Profile, Organization, Security:

```jsx
import { CreditCard } from 'lucide-react';  // Add import

// Add tab button:
<button
  onClick={() => setActiveTab('billing')}
  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
    activeTab === 'billing' ? 'bg-green-50 text-green-700' : 'text-gray-600 hover:bg-gray-50'
  }`}
>
  <CreditCard size={18} />
  Billing & Plans
</button>
```

### 10.2 Billing Tab Content

When `activeTab === 'billing'`, render a `BillingTab` component:

```jsx
{activeTab === 'billing' && <BillingTab />}
```

### 10.3 BillingTab Component — `client/src/components/BillingTab.jsx`

This component should:
1. Fetch current subscription via `GET /api/billing/subscription`
2. Fetch all plans via `GET /api/billing/plans`
3. Show current plan status (trial days remaining, active plan, etc.)
4. Show plan comparison cards with Monthly/Yearly toggle
5. "Upgrade" button → calls `POST /api/billing/checkout` → redirects to Stripe
6. "Manage Billing" button → calls `POST /api/billing/portal` → redirects to Stripe

### 10.4 API Service — Add to `client/src/services/api.js`

```javascript
export const billingAPI = {
  getPlans: () => api.get('/billing/plans'),
  getSubscription: () => api.get('/billing/subscription'),
  createCheckout: (data) => api.post('/billing/checkout', data),
  createPortal: () => api.post('/billing/portal'),
};
```

---

## 11. Stripe Sync Script

### File: `server/src/scripts/syncPlans.js`

This script reads `config/plans.json` and:
1. For each plan, creates/updates a **Stripe Product**
2. For each pricing tier (monthly/yearly), creates a **Stripe Price**
3. Saves the `stripeProductId` and `stripePriceId` back to MongoDB

```javascript
// Run: node src/scripts/syncPlans.js
require('dotenv').config();
const mongoose = require('mongoose');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const Plan = require('../models/Plan');
const plansConfig = require('../config/plans.json');

async function syncPlans() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('[SyncPlans] Connected to MongoDB');

  for (const planData of plansConfig.plans) {
    // 1. Upsert in MongoDB
    let plan = await Plan.findOne({ planId: planData.planId });

    if (!plan) {
      plan = new Plan(planData);
    } else {
      Object.assign(plan, planData);
    }

    // 2. Create or find Stripe Product (skip for free plan)
    if (!planData.isFree) {
      let product;
      if (plan.stripeProductId) {
        product = await stripe.products.update(plan.stripeProductId, {
          name: planData.name,
          description: planData.description,
        });
      } else {
        product = await stripe.products.create({
          name: planData.name,
          description: planData.description,
          metadata: { planId: planData.planId },
        });
      }
      plan.stripeProductId = product.id;

      // 3. Create Stripe Prices (monthly + yearly)
      for (const cycle of ['monthly', 'yearly']) {
        const priceData = planData.pricing[cycle];
        if (!priceData || priceData.amount === 0) continue;

        if (!plan.pricing[cycle].stripePriceId) {
          const price = await stripe.prices.create({
            product: product.id,
            unit_amount: priceData.amount,
            currency: priceData.currency,
            recurring: {
              interval: cycle === 'monthly' ? 'month' : 'year',
            },
            metadata: { planId: planData.planId, cycle },
          });
          plan.pricing[cycle].stripePriceId = price.id;
        }
      }
    }

    await plan.save();
    console.log(`[SyncPlans] Synced: ${planData.name} (${planData.planId})`);
  }

  console.log('[SyncPlans] ✅ All plans synced!');
  process.exit(0);
}

syncPlans().catch(err => {
  console.error('[SyncPlans] Error:', err);
  process.exit(1);
});
```

---

## 12. File Map (What to Create / Modify)

### New Files to Create

| # | File Path                                          | Type       | Description                          |
|---|---------------------------------------------------|------------|--------------------------------------|
| 1 | `server/src/config/plans.json`                    | Config     | Master plan definitions              |
| 2 | `server/src/models/Plan.js`                       | Model      | Plan schema                          |
| 3 | `server/src/models/Subscription.js`               | Model      | Subscription schema                  |
| 4 | `server/src/controllers/billingController.js`     | Controller | All billing logic                    |
| 5 | `server/src/routes/billing.js`                    | Route      | Billing API routes                   |
| 6 | `server/src/middleware/planLimits.js`              | Middleware | Plan enforcement                     |
| 7 | `server/src/scripts/syncPlans.js`                 | Script     | Sync plans to DB + Stripe            |
| 8 | `client/src/components/BillingTab.jsx`            | Component  | Billing UI in Settings               |

### Files to Modify

| # | File Path                                          | Changes                                         |
|---|---------------------------------------------------|-------------------------------------------------|
| 1 | `server/src/models/Tenant.js`                     | Add `stripeCustomerId` field                    |
| 2 | `server/src/controllers/authController.js`        | Create Stripe customer + free trial on register |
| 3 | `server/src/index.js`                             | Mount billing routes, raw body for webhook      |
| 4 | `server/package.json`                             | Add `stripe` dependency                          |
| 5 | `server/.env`                                     | Add Stripe env vars                              |
| 6 | `client/src/pages/Settings.jsx`                   | Add Billing tab                                  |
| 7 | `client/src/services/api.js`                      | Add `billingAPI` exports                         |

---

## 13. Testing Checklist

### Setup
- [ ] Add Stripe test keys to `.env`
- [ ] Run `npm install stripe` in server
- [ ] Run `node src/scripts/syncPlans.js` to seed plans
- [ ] Set up Stripe CLI for local webhook testing: `stripe listen --forward-to localhost:5000/api/billing/webhook`

### Registration
- [ ] Register a new user → verify Stripe Customer created
- [ ] Verify Subscription record created (status: `trialing`, trialEnd: +30 days)
- [ ] Verify Tenant has `stripeCustomerId`

### Billing UI
- [ ] Settings → Billing tab shows current plan (Free Trial)
- [ ] Plan cards display with correct pricing
- [ ] Monthly/Yearly toggle works
- [ ] "Current Plan" badge on free tier

### Upgrade Flow
- [ ] Click Upgrade → redirects to Stripe Checkout
- [ ] Complete test payment → webhook fires
- [ ] Subscription updated in DB (status: `active`, correct planId)
- [ ] Billing tab reflects new plan

### Customer Portal
- [ ] "Manage Billing" opens Stripe Customer Portal
- [ ] Can update payment method
- [ ] Can cancel subscription

### Plan Limits
- [ ] Free tier: cannot create >1 channel
- [ ] Startup: cannot create >2 channels
- [ ] Enterprise: unlimited

### Trial Expiry
- [ ] Manually set trialEnd to past date
- [ ] Verify middleware blocks actions with `TRIAL_EXPIRED` error
- [ ] Billing UI shows "Trial Expired" state

---

## Quick Start Commands

```bash
# 1. Install Stripe
cd server && npm install stripe

# 2. Add env vars to server/.env
# STRIPE_SECRET_KEY=sk_test_...
# STRIPE_PUBLISHABLE_KEY=pk_test_...
# STRIPE_WEBHOOK_SECRET=whsec_...

# 3. Sync plans to DB + Stripe
node src/scripts/syncPlans.js

# 4. Start webhook listener (separate terminal)
stripe listen --forward-to localhost:5000/api/billing/webhook

# 5. Start server
npm run dev
```
