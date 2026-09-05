require('dotenv').config();
const mongoose = require('mongoose');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const Plan = require('../models/Plan');
const plansConfig = require('../config/plans.json');

async function syncPlans() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('[SyncPlans] Connected to MongoDB');

  for (const planData of plansConfig.plans) {
    let plan = await Plan.findOne({ planId: planData.planId });

    if (!plan) {
      plan = new Plan(planData);
    } else {
      Object.assign(plan, planData);
    }

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
