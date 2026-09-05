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
    if (!plan) return next();

    const limit = plan.features[resource];
    if (limit === undefined || limit === -1) return next();

    req.planLimit = limit;
    req.currentPlan = plan;
    req.subscription = subscription;
    next();
  } catch (err) {
    console.error('[PlanLimits] Error:', err.message);
    next();
  }
};

module.exports = { checkPlanLimit };
