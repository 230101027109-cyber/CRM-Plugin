const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const Plan = require('../models/Plan');
const Subscription = require('../models/Subscription');
const Tenant = require('../models/Tenant');

const getPlans = async (req, res) => {
  try {
    const plans = await Plan.find({ isActive: true }).sort({ sortOrder: 1 });
    res.json({ success: true, data: plans });
  } catch (error) {
    console.error('[Billing] Error fetching plans:', error);
    res.status(500).json({ success: false, message: 'Server error fetching plans' });
  }
};

const getSubscription = async (req, res) => {
  try {
    const subscription = await Subscription.findOne({
      tenantId: req.user.tenantId,
      status: { $in: ['trialing', 'active', 'past_due', 'canceled'] }
    }).sort({ createdAt: -1 });

    if (!subscription) {
      return res.status(404).json({ success: false, message: 'No subscription found' });
    }

    const plan = await Plan.findOne({ planId: subscription.planId });
    
    res.json({
      success: true,
      data: {
        ...subscription.toObject(),
        plan: plan || null
      }
    });
  } catch (error) {
    console.error('[Billing] Error fetching subscription:', error);
    res.status(500).json({ success: false, message: 'Server error fetching subscription' });
  }
};

const createCheckoutSession = async (req, res) => {
  try {
    const { planId, billingCycle } = req.body;
    const tenantId = req.user.tenantId;

    if (!planId || !billingCycle) {
      return res.status(400).json({ success: false, message: 'planId and billingCycle are required' });
    }

    const plan = await Plan.findOne({ planId });
    if (!plan || plan.isFree) {
      return res.status(400).json({ success: false, message: 'Invalid plan for checkout' });
    }

    const priceId = plan.pricing[billingCycle]?.stripePriceId;
    if (!priceId) {
      return res.status(400).json({ success: false, message: 'Invalid billing cycle' });
    }

    const tenant = await Tenant.findOne({ tenantId });
    if (!tenant.stripeCustomerId) {
      return res.status(400).json({ success: false, message: 'Tenant has no stripe customer ID' });
    }

    const session = await stripe.checkout.sessions.create({
      customer: tenant.stripeCustomerId,
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: process.env.STRIPE_SUCCESS_URL,
      cancel_url: process.env.STRIPE_CANCEL_URL,
      metadata: {
        tenantId,
        planId,
        billingCycle,
      },
    });

    res.json({ success: true, url: session.url });
  } catch (error) {
    console.error('[Billing] Error creating checkout session:', error);
    res.status(500).json({ success: false, message: 'Server error creating checkout session' });
  }
};

const createPortalSession = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const tenant = await Tenant.findOne({ tenantId });

    if (!tenant.stripeCustomerId) {
      return res.status(400).json({ success: false, message: 'Tenant has no stripe customer ID' });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: tenant.stripeCustomerId,
      return_url: process.env.STRIPE_CANCEL_URL,
    });

    res.json({ success: true, url: session.url });
  } catch (error) {
    console.error('[Billing] Error creating portal session:', error);
    res.status(500).json({ success: false, message: 'Server error creating portal session' });
  }
};

const handleWebhook = async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('[Billing] Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        if (session.mode === 'subscription') {
          const tenantId = session.metadata.tenantId;
          const planId = session.metadata.planId;
          const billingCycle = session.metadata.billingCycle;
          const stripeSubscriptionId = session.subscription;

          const stripeSub = await stripe.subscriptions.retrieve(stripeSubscriptionId);

          const subscription = await Subscription.findOne({ tenantId });
          if (subscription) {
             subscription.planId = planId;
             subscription.status = 'active';
             subscription.billingCycle = billingCycle;
             subscription.stripeSubscriptionId = stripeSubscriptionId;
             subscription.trialEnd = null;
             subscription.currentPeriodStart = new Date(stripeSub.current_period_start * 1000);
             subscription.currentPeriodEnd = new Date(stripeSub.current_period_end * 1000);
             subscription.history.push({
               planId,
               status: 'active',
               reason: 'Checkout completed'
             });
             await subscription.save();
          }
        }
        break;
      }
      case 'customer.subscription.updated': {
        const stripeSub = event.data.object;
        const subscription = await Subscription.findOne({ stripeSubscriptionId: stripeSub.id });
        
        if (subscription) {
          subscription.status = stripeSub.status === 'active' ? 'active' : stripeSub.status;
          subscription.currentPeriodStart = new Date(stripeSub.current_period_start * 1000);
          subscription.currentPeriodEnd = new Date(stripeSub.current_period_end * 1000);
          subscription.cancelAtPeriodEnd = stripeSub.cancel_at_period_end;
          if (stripeSub.cancel_at_period_end) {
             subscription.history.push({
               planId: subscription.planId,
               status: subscription.status,
               reason: 'Subscription set to cancel at period end'
             });
          }
          await subscription.save();
        }
        break;
      }
      case 'customer.subscription.deleted': {
        const stripeSub = event.data.object;
        const subscription = await Subscription.findOne({ stripeSubscriptionId: stripeSub.id });
        if (subscription) {
          subscription.status = 'canceled';
          subscription.canceledAt = new Date();
          subscription.history.push({
            planId: subscription.planId,
            status: 'canceled',
            reason: 'Subscription deleted from Stripe'
          });
          await subscription.save();
        }
        break;
      }
      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        if (invoice.subscription) {
          const subscription = await Subscription.findOne({ stripeSubscriptionId: invoice.subscription });
          if (subscription) {
            subscription.status = 'past_due';
            subscription.history.push({
              planId: subscription.planId,
              status: 'past_due',
              reason: 'Payment failed'
            });
            await subscription.save();
          }
        }
        break;
      }
      default:
        console.log(`[Billing] Unhandled webhook event: ${event.type}`);
    }
  } catch (error) {
    console.error(`[Billing] Error processing webhook ${event.type}:`, error);
  }

  res.json({ received: true });
};

module.exports = {
  getPlans,
  getSubscription,
  createCheckoutSession,
  createPortalSession,
  handleWebhook
};
