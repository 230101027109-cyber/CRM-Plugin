const Conversation = require('../models/Conversation');
const Contact = require('../models/Contact');
const { buildConversationKey } = require('../utils/conversationKey');

const resolveContactForConversation = async ({ tenantId, channelId, contactId, jid }) => {
  if (!tenantId || !channelId) return null;

  if (contactId) {
    return Contact.findOne({
      _id: contactId,
      tenantId,
      channelId,
    }).lean();
  }

  if (jid) {
    return Contact.findOne({
      tenantId,
      channelId,
      jid: String(jid),
    }).lean();
  }

  return null;
};

const ensureConversation = async ({
  tenantId,
  channelId,
  contactId,
  contactJid,
  name,
  phone,
  isGroup = false,
}) => {
  if (!tenantId || !channelId || !contactJid) {
    return null;
  }

  const normalizedJid = String(contactJid);

  const update = {
    $setOnInsert: {
      tenantId,
      channelId,
      contactJid: normalizedJid,
      status: 'open',
      unreadCount: 0,
      lastMessage: '',
      lastMessageTime: new Date(),
      isGroup: Boolean(isGroup),
    },
    $set: {
      status: 'active',
      isGroup: Boolean(isGroup),
    },
  };

  if (contactId) {
    update.$set.contactId = contactId;
  }

  if (name) {
    update.$set.name = String(name);
  }

  if (phone) {
    update.$set.phone = String(phone);
  }

  try {
    return await Conversation.findOneAndUpdate(
      {
        tenantId,
        channelId,
        contactJid: normalizedJid,
      },
      update,
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      }
    );
  } catch (error) {
    // Another request may have created the same conversation concurrently.
    if (error.code === 11000) {
      const existing = await Conversation.findOne({
        tenantId,
        channelId,
        contactJid: normalizedJid,
      });

      if (existing) {
        return existing;
      }
    }

    throw error;
  }
};

const getConversations = async (tenantId) => {
  if (!tenantId) return [];

  const conversations = await Conversation.find({
    tenantId,
  })
    .sort({
      lastMessageTime: -1,
    })
    .limit(200)
    .lean();

  return conversations.map((conversation) => ({
    conversationId: conversation.conversationId,
    tenantId: conversation.tenantId,
    channelId: conversation.channelId,
    contactId: conversation.contactId || null,

    jid: conversation.contactJid,
    contactJid: conversation.contactJid,

    name: conversation.name || '',
    phone: conversation.phone || '',

    status: conversation.status,
    isGroup: Boolean(conversation.isGroup),

    unreadCount: Number(conversation.unreadCount || 0),

    lastMessage: conversation.lastMessage || '',
    lastMessageTime: conversation.lastMessageTime,

    conversationKey: buildConversationKey(
      conversation.channelId,
      conversation.contactJid
    ),
  }));
};

const openConversation = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;

    const {
      channelId,
      contactId,
      jid,
      name,
      phone,
    } = req.body;

    if (!tenantId || !channelId || (!contactId && !jid)) {
      return res.status(400).json({
        success: false,
        message: 'channelId and contact are required',
      });
    }

    // IMPORTANT:
    // A contact must belong to the same tenant AND the same channel.
    const contact = await resolveContactForConversation({
      tenantId,
      channelId,
      contactId,
      jid,
    });

    if (!contact) {
      return res.status(404).json({
        success: false,
        message: 'Contact was not found for this channel',
      });
    }

    const conversation = await ensureConversation({
      tenantId,
      channelId,
      contactId: contact._id,
      contactJid: contact.jid,
      name:
        name ||
        contact.name ||
        contact.pushName ||
        contact.businessName ||
        contact.phone ||
        '',
      phone: phone || contact.phone || '',
      isGroup: contact.isGroup,
    });

    if (!conversation) {
      return res.status(500).json({
        success: false,
        message: 'Could not create conversation',
      });
    }

    res.json({
      success: true,
      data: {
        conversationId: conversation.conversationId,
        tenantId: conversation.tenantId,
        channelId: conversation.channelId,
        contactId: conversation.contactId,
        jid: conversation.contactJid,
        contactJid: conversation.contactJid,
        name: conversation.name || '',
        phone: conversation.phone || '',
        status: conversation.status,
        isGroup: Boolean(conversation.isGroup),
        unreadCount: Number(conversation.unreadCount || 0),
        lastMessage: conversation.lastMessage || '',
        lastMessageTime: conversation.lastMessageTime,
        conversationKey: buildConversationKey(
          conversation.channelId,
          conversation.contactJid
        ),
      },
    });
  } catch (error) {
    console.error('Error opening conversation:', error);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const updateConversationFromMessage = async ({
  tenantId,
  channelId,
  remoteJid,
  content,
  timestamp,
  fromMe,
}) => {
  if (!tenantId || !channelId || !remoteJid) {
    return null;
  }

  const normalizedJid = String(remoteJid);

  const contact = await Contact.findOne({
    tenantId,
    channelId,
    jid: normalizedJid,
  }).lean();

  const existing = await Conversation.findOne({
    tenantId,
    channelId,
    contactJid: normalizedJid,
  }).lean();

  const update = {
    $setOnInsert: {
      tenantId,
      channelId,
      contactJid: normalizedJid,
      status: 'active',
      unreadCount: 0,
      isGroup: Boolean(contact?.isGroup),
    },
    $set: {
      status: 'active',
      lastMessage: content || '',
      lastMessageTime: timestamp || new Date(),
      isGroup: Boolean(contact?.isGroup),
    },
  };

  if (contact?._id) {
    update.$set.contactId = contact._id;
  }

  // Do not erase a valid existing name/phone with an empty value.
  const contactName =
    contact?.name ||
    contact?.pushName ||
    contact?.businessName ||
    '';

  if (contactName) {
    update.$set.name = contactName;
  }

  if (contact?.phone) {
    update.$set.phone = contact.phone;
  }

  if (fromMe) {
    update.$set.unreadCount = 0;
  } else if (existing) {
    update.$inc = {
      unreadCount: 1,
    };
  } else {
    // New inbound conversation.
    update.$set.unreadCount = 1;
  }

  try {
    const conversation = await Conversation.findOneAndUpdate(
      {
        tenantId,
        channelId,
        contactJid: normalizedJid,
      },
      update,
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      }
    );

    return conversation;
  } catch (error) {
    if (error.code === 11000) {
      return Conversation.findOne({
        tenantId,
        channelId,
        contactJid: normalizedJid,
      });
    }

    throw error;
  }
};

module.exports = {
  ensureConversation,
  getConversations,
  openConversation,
  updateConversationFromMessage,
};