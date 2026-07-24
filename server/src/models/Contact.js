const mongoose = require('mongoose');

const contactSchema = new mongoose.Schema({
  jid: { type: String, unique: true, required: true, index: true },
  name: { type: String, default: '' },
  phone: { type: String, default: '' },
  pushName: { type: String, default: '' },
  businessName: { type: String, default: '' },
  isBusiness: { type: Boolean, default: false },
  isGroup: { type: Boolean, default: false },
  participants: [{ type: String }],
  profilePicUrl: { type: String, default: '' },
  lastSeen: { type: Date },
  isOnline: { type: Boolean, default: false },
  about: { type: String, default: '' },
  unreadCount: { type: Number, default: 0 },
  lastMessage: { type: String, default: '' },
  lastMessageTime: { type: Date, default: Date.now },
  tags: [{ type: String }],
  notes: { type: String, default: '' },
}, { timestamps: true });

contactSchema.index({ phone: 1 });
contactSchema.index({ name: 1 });

module.exports = mongoose.model('Contact', contactSchema);
