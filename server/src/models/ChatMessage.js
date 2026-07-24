const mongoose = require('mongoose');

const chatMessageSchema = new mongoose.Schema({
  tenantId: { type: String, required: true, index: true },
  channelId: { type: String, required: true, index: true },
  messageId: { type: String, unique: true },
  remoteJid: { type: String, required: true, index: true },
  senderJid: { type: String, required: true },
  messageType: { type: String, enum: ['text', 'image', 'video', 'audio', 'document', 'sticker'], default: 'text' },
  content: { type: String, default: '' },
  caption: { type: String, default: '' },
  fromMe: { type: Boolean, default: false },
  timestamp: { type: Date, default: Date.now, index: true },
  read: { type: Boolean, default: false },
  participants: [{ type: String }],
}, { timestamps: true });

chatMessageSchema.index({ tenantId: 1, remoteJid: 1, timestamp: -1 });

module.exports = mongoose.model('ChatMessage', chatMessageSchema);
