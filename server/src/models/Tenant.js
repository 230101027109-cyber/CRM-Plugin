const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const tenantSchema = new mongoose.Schema({
  tenantId: { type: String, default: uuidv4, unique: true, index: true },
  name: { type: String, required: true },
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  maxUsers: { type: Number, default: 3 },
  plan: { type: String, default: 'free' },
  stripeCustomerId: { type: String, default: null, index: true },
}, { timestamps: true });

module.exports = mongoose.model('Tenant', tenantSchema);
