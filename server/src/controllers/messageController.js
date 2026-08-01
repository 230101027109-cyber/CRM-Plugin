const ChatMessage = require('../models/ChatMessage');
const Contact = require('../models/Contact');

const getMessages = async (remoteJid, limit = 50, before) => {
  const query = { remoteJid };
  if (before) query.timestamp = { $lt: new Date(before) };

  const messages = await ChatMessage.find(query)
    .sort({ timestamp: -1 })
    .limit(limit);

  return messages.reverse();
};

const getMessagesForTenant = async (tenantId, remoteJid, limit = 50, before) => {
  const query = { tenantId, remoteJid };
  if (before) query.timestamp = { $lt: new Date(before) };

  const messages = await ChatMessage.find(query)
    .sort({ timestamp: -1 })
    .limit(limit);

  return messages.reverse();
};

const saveMessage = async (data) => {
  const filter = {
    tenantId: data.tenantId,
    channelId: data.channelId,
    messageId: data.messageId,
  };

  // Baileys can deliver the same event through history, append and notify.
  // Upsert it once so a replay never prevents the socket event from reaching
  // the CRM UI.
  const existing = await ChatMessage.findOne(filter);
  if (existing) return { message: existing, created: false };

  let saved;
  try {
    saved = await ChatMessage.create(data);
  } catch (error) {
    // Concurrent notify/append handlers may race between the read above and
    // the insert. The unique index is the final idempotency guard.
    if (error.code === 11000) {
      const duplicate = await ChatMessage.findOne(filter);
      if (duplicate) return { message: duplicate, created: false };
    }
    throw error;
  }

  await Contact.findOneAndUpdate(
    { tenantId: data.tenantId, jid: data.remoteJid },
    {
      tenantId: data.tenantId,
      channelId: data.channelId,
      jid: data.remoteJid,
      lastMessage: data.content || (data.caption || ''),
      lastMessageTime: data.timestamp || new Date(),
      ...(data.fromMe ? {} : { $inc: { unreadCount: 1 } }),
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  return { message: saved, created: true };
};

const markAsRead = async (tenantId, remoteJid) => {
  await ChatMessage.updateMany({ tenantId, remoteJid, read: false }, { read: true, updatedAt: new Date() });
  await Contact.findOneAndUpdate({ tenantId, jid: remoteJid }, { unreadCount: 0 });
};

const getUnreadCount = async (tenantId, remoteJid) => {
  const count = await ChatMessage.countDocuments({ tenantId, remoteJid, read: false });
  return count;
};

const deleteMessage = async (messageId) => {
  return await ChatMessage.findByIdAndDelete(messageId);
};

module.exports = {
  getMessages,
  getMessagesForTenant,
  saveMessage,
  markAsRead,
  getUnreadCount,
  deleteMessage,
};
