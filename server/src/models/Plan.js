const mongoose = require('mongoose');

const planSchema = new mongoose.Schema({
  planId: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true },
  description: { type: String, default: '' },
  badge: { type: String, default: null },
  isFree: { type: Boolean, default: false },
  trialDays: { type: Number, default: 0 },
  features: {
    maxUsers: { type: Number, default: 1 },
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
      amount: { type: Number, default: 0 },
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
