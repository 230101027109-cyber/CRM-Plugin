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
  const message = new ChatMessage(data);
  const saved = await message.save();

  await Contact.findOneAndUpdate(
    { tenantId: data.tenantId, jid: data.remoteJid },
    {
      tenantId: data.tenantId,
      channelId: data.channelId,
      jid: data.remoteJid,
      lastMessage: data.content || (data.caption || ''),
      lastMessageTime: data.timestamp || new Date(),
      $inc: data.fromMe ? {} : { unreadCount: 1 },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  return saved;
};

const markAsRead = async (remoteJid) => {
  await ChatMessage.updateMany({ remoteJid, read: false }, { read: true, updatedAt: new Date() });
  await Contact.findOneAndUpdate({ jid: remoteJid }, { unreadCount: 0 });
};

const getUnreadCount = async (remoteJid) => {
  const count = await ChatMessage.countDocuments({ remoteJid, read: false });
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
