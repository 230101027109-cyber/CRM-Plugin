const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const conversationSchema = new mongoose.Schema({
  conversationId: { type: String, default: uuidv4, unique: true, index: true },
  tenantId: { type: String, required: true, index: true },
  channelId: { type: String, required: true, index: true },
  contactId: { type: mongoose.Schema.Types.ObjectId, ref: 'Contact' },
  contactJid: { type: String, required: true, index: true },
  name: { type: String, default: '' },
  phone: { type: String, default: '' },
  status: { type: String, enum: ['open', 'active', 'pending', 'archived'], default: 'open' },
  isGroup: { type: Boolean, default: false },
  unreadCount: { type: Number, default: 0 },
  lastMessage: { type: String, default: '' },
  lastMessageTime: { type: Date, default: Date.now },
}, { timestamps: true });

conversationSchema.index({ tenantId: 1, channelId: 1, contactJid: 1 }, { unique: true });
conversationSchema.index({ tenantId: 1, status: 1 });

module.exports = mongoose.model('Conversation', conversationSchema);
