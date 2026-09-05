const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const subscriptionSchema = new mongoose.Schema({
  subscriptionId: { type: String, default: uuidv4, unique: true, index: true },
  tenantId: { type: String, required: true, index: true },
  planId: { type: String, required: true },
  status: {
    type: String,
    enum: [
      'trialing',
      'active',
      'past_due',
      'canceled',
      'expired',
      'incomplete',
    ],
    default: 'trialing',
  },
  billingCycle: {
    type: String,
    enum: ['monthly', 'yearly', 'none'],
    default: 'none',
  },

  stripeSubscriptionId: { type: String, default: null, index: true },
  stripeCustomerId: { type: String, default: null },

  trialStart: { type: Date, default: null },
  trialEnd: { type: Date, default: null },

  currentPeriodStart: { type: Date, default: null },
  currentPeriodEnd: { type: Date, default: null },

  cancelAtPeriodEnd: { type: Boolean, default: false },
  canceledAt: { type: Date, default: null },

  history: [{
    planId: String,
    status: String,
    changedAt: { type: Date, default: Date.now },
    reason: String,
  }],
}, { timestamps: true });

subscriptionSchema.index(
  { tenantId: 1, status: 1 },
  { unique: true, partialFilterExpression: { status: { $in: ['trialing', 'active'] } } }
);

module.exports = mongoose.model('Subscription', subscriptionSchema);
