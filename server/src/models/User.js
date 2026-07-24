const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const userSchema = new mongoose.Schema({
  userId: { type: String, default: uuidv4, unique: true, index: true },
  tenantId: { type: String, required: true, index: true },
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  phone: { type: String, required: true },
  pin: { type: String, required: true },
  role: { type: String, enum: ['owner', 'member'], default: 'member' },
  isActive: { type: Boolean, default: true },
  lastLogin: { type: Date },
}, { timestamps: true });

userSchema.index({ tenantId: 1, email: 1 });

module.exports = mongoose.model('User', userSchema);
