const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const ticketSchema = new mongoose.Schema({
  ticketId: { type: String, default: uuidv4, unique: true, index: true },
  tenantId: { type: String, required: true, index: true },
  channelId: { type: String, required: true, index: true },
  contactId: { type: String, required: true, index: true },
  conversationId: { type: String }, // Links to contact JID
  subject: { type: String, required: true },
  description: { type: String },
  status: { type: String, enum: ['open', 'in_progress', 'resolved', 'closed'], default: 'open' },
  priority: { type: String, enum: ['low', 'medium', 'high', 'urgent'], default: 'medium' },
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  tags: [{ type: String }],
}, { timestamps: true });

ticketSchema.index({ tenantId: 1, status: 1 });
ticketSchema.index({ tenantId: 1, assignedTo: 1 });

module.exports = mongoose.model('Ticket', ticketSchema);
