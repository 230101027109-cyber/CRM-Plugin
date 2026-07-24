const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const channelSchema = new mongoose.Schema({
  channelId: { type: String, default: uuidv4, unique: true, index: true },
  tenantId: { type: String, required: true, index: true },
  type: { type: String, enum: ['baileys', 'whatsapp_business'], required: true },
  channelName: { type: String, required: true },
  connectedNumber: { type: String },
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  status: { type: String, enum: ['connected', 'disconnected', 'connecting'], default: 'disconnected' },
  sessionId: { type: String },
}, { timestamps: true });

channelSchema.index({ tenantId: 1 });

module.exports = mongoose.model('Channel', channelSchema);
