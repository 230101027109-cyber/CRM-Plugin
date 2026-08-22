const Conversation = require('../models/Conversation');
const Contact = require('../models/Contact');
const { buildConversationKey } = require('../utils/conversationKey');

const ensureConversation = async ({ tenantId, channelId, contactId, contactJid, name, phone, isGroup = false }) => {
  if (!tenantId || !channelId || !contactJid) return null;

  const normalizedJid = String(contactJid);
  const conversation = await Conversation.findOneAndUpdate(
    { tenantId, channelId, contactJid: normalizedJid },
    {
      tenantId,
      channelId,
      contactId: contactId || undefined,
      contactJid: normalizedJid,
      name: name || '',
      phone: phone || '',
      isGroup,
      status: 'active',
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  return conversation;
};

const getConversations = async (tenantId) => {
  const conversations = await Conversation.find({ tenantId }).sort({ lastMessageTime: -1 }).limit(200);

  return conversations.map((conversation) => ({
    conversationId: conversation.conversationId,
    tenantId: conversation.tenantId,
    channelId: conversation.channelId,
    contactId: conversation.contactId,
    jid: conversation.contactJid,
    contactJid: conversation.contactJid,
    name: conversation.name,
    phone: conversation.phone,
    status: conversation.status,
    isGroup: conversation.isGroup,
    unreadCount: conversation.unreadCount,
    lastMessage: conversation.lastMessage,
    lastMessageTime: conversation.lastMessageTime,
    conversationKey: buildConversationKey(conversation.channelId, conversation.contactJid),
  }));
};

const openConversation = async (req, res) => {
  try {
    const { channelId, contactId, jid, name, phone } = req.body;

    if (!channelId || (!contactId && !jid)) {
      return res.status(400).json({ success: false, message: 'channelId and contact are required' });
    }

    const contact = contactId
      ? await Contact.findOne({ _id: contactId, tenantId: req.user.tenantId }).lean()
      : await Contact.findOne({ tenantId: req.user.tenantId, channelId, jid }).lean();

    const contactJid = jid || contact?.jid;
    if (!contactJid) {
      return res.status(400).json({ success: false, message: 'Contact was not found for this channel' });
    }

    const conversation = await ensureConversation({
      tenantId: req.user.tenantId,
      channelId,
      contactId: contact?._id || contactId,
      contactJid: contactJid,
      name: name || contact?.name || contact?.pushName || contact?.phone || '',
      phone: phone || contact?.phone || '',
    });

    res.json({ success: true, data: conversation });
  } catch (error) {
    console.error('Error opening conversation:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const updateConversationFromMessage = async ({ tenantId, channelId, remoteJid, content, timestamp, fromMe }) => {
  if (!tenantId || !channelId || !remoteJid) return null;

  const contact = await Contact.findOne({ tenantId, channelId, jid: remoteJid }).lean();
  const existing = await Conversation.findOne({ tenantId, channelId, contactJid: remoteJid }).lean();
  const unreadCount = fromMe ? 0 : (Number(existing?.unreadCount || 0) + 1);

  const conversation = await Conversation.findOneAndUpdate(
    { tenantId, channelId, contactJid: remoteJid },
    {
      tenantId,
      channelId,
      contactId: contact?._id,
      contactJid: remoteJid,
      name: contact?.name || contact?.pushName || contact?.phone || '',
      phone: contact?.phone || '',
      lastMessage: content || '',
      lastMessageTime: timestamp || new Date(),
      unreadCount,
      status: 'active',
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  return conversation;
};

module.exports = {
  ensureConversation,
  getConversations,
  openConversation,
  updateConversationFromMessage,
};
