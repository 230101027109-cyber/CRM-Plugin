const Contact = require('../models/Contact');
const ChatMessage = require('../models/ChatMessage');
const Conversation = require('../models/Conversation');
const { buildConversationKey } = require('../utils/conversationKey');

const getChatList = async (tenantId) => {
  const contacts = await Contact.find({ tenantId }, 'jid name phone pushName isGroup channelId lastMessage lastMessageTime isOnline unreadCount profilePicUrl')
    .sort({ lastMessageTime: -1 })
    .limit(100);

  return contacts.map(contact => ({
    jid: contact.jid,
    name: contact.name || contact.pushName || contact.phone,
    phone: contact.phone,
    isGroup: contact.isGroup,
    channelId: contact.channelId,
    conversationKey: buildConversationKey(contact.channelId, contact.jid),
    isOnline: contact.isOnline,
    lastMessage: contact.lastMessage,
    lastMessageTime: contact.lastMessageTime,
    unreadCount: contact.unreadCount,
    profilePicUrl: contact.profilePicUrl,
  }));
};

const getContacts = async (tenantId) => {
  return await Contact.find({ tenantId, isGroup: false }, 'jid name phone pushName isBusiness isOnline channelId about profilePicUrl lastSeen tags')
    .sort({ name: 1 })
    .limit(500);
};

const getGroups = async (tenantId) => {
  return await Contact.find({ tenantId, isGroup: true }, 'jid name subject participantCount profilePicUrl lastMessage lastMessageTime')
    .sort({ lastMessageTime: -1 });
};

const syncContacts = async (sock, store, tenantId, channelId) => {
  if (!sock) throw new Error('WhatsApp socket not connected');

  let syncedCount = 0;
  let errorCount = 0;

  const upsertContact = async (filter, update) => {
    try {
      await Contact.findOneAndUpdate(filter, update, { upsert: true, new: true, setDefaultsOnInsert: true });
      syncedCount++;
    } catch (err) {
      if (err.code === 11000) {
        // Duplicate key - try a plain update without upsert
        try {
          await Contact.updateOne(filter, update);
          syncedCount++;
        } catch (e) {
          errorCount++;
        }
      } else {
        errorCount++;
      }
    }
  };

  // 1. Fetch groups via Baileys API
  const groups = await sock.groupFetchAllParticipating().catch((e) => {
    console.error('[Sync] groupFetchAllParticipating failed:', e.message);
    return {};
  });
  console.log(`[Sync] Found ${Object.keys(groups).length} groups`);
  for (const [jid, group] of Object.entries(groups)) {
    await upsertContact(
      { tenantId, jid },
      {
        tenantId,
        channelId,
        jid,
        name: group.subject || group.name || '',
        pushName: group.subject || '',
        isGroup: true,
        participants: group.participants?.map(p => p.id) || [],
        participantCount: group.participants?.length || 0,
        profilePicUrl: group.profilePicUrl || '',
      }
    );
  }

  // 2. Sync chats from the in-memory store (people you've messaged)
  if (store && store.chats) {
    const chatList = typeof store.chats.toJSON === 'function'
      ? Object.values(store.chats.toJSON())
      : Array.from(store.chats.values());
    console.log(`[Sync] Store has ${chatList.length} chats`);

    for (const chat of chatList) {
      const jid = chat.id;
      if (!jid) continue;
      if (jid.includes('@g.us')) continue;

      const phone = jid.split('@')[0].split(':')[0];
      const name = chat.name || chat.subject || '';
      const lastMessage = chat.lastMessage?.message?.conversation ||
                          chat.lastMessage?.message?.extendedTextMessage?.text || '';

      await upsertContact(
        { tenantId, channelId, jid },
        {
          tenantId,
          channelId,
          jid,
          phone,
          name,
          pushName: name,
          ...(lastMessage && { lastMessage }),
          ...(chat.lastMessage?.messageTimestamp && {
            lastMessageTime: new Date(chat.lastMessage.messageTimestamp * 1000)
          }),
        }
      );
    }
  } else {
    console.log('[Sync] No store or store.chats available');
  }

  // 3. Sync contacts from the in-memory store's contact list (most reliable for names)
  if (store && store.contacts) {
    const contactEntries = typeof store.contacts.toJSON === 'function'
      ? Object.values(store.contacts.toJSON())
      : store.contacts instanceof Map
        ? Array.from(store.contacts.values())
        : Object.values(store.contacts);
    console.log(`[Sync] Store contacts has ${contactEntries.length} entries`);

    for (const contact of contactEntries) {
      const jid = contact.id || contact.jid;
      if (!jid || jid.includes('@g.us')) continue;
      const phone = jid.split('@')[0].split(':')[0];
      await upsertContact(
        { tenantId, channelId, jid },
        {
          tenantId,
          channelId,
          jid,
          phone,
          name: contact.name || contact.notify || contact.pushName || phone,
          pushName: contact.notify || contact.name || contact.pushName || phone,
          isBusiness: Boolean(contact.isBusiness),
          profilePicUrl: contact.imgUrl || contact.profilePicUrl || '',
        }
      );
    }
  } else {
    console.log('[Sync] Store contacts not available');
  }

  // 4. Sync contacts from sock.contacts if available (fallback for any extra data)
  if (sock.contacts) {
    const contactsMap = sock.contacts instanceof Map
      ? Array.from(sock.contacts.entries())
      : Object.entries(sock.contacts);
    console.log(`[Sync] sock.contacts has ${contactsMap.length} entries (fallback)`);

    for (const [jid, contact] of contactsMap) {
      if (!jid || jid.includes('@g.us')) continue;
      const phone = jid.split('@')[0].split(':')[0];
      await upsertContact(
        { tenantId, channelId, jid },
        {
          tenantId,
          channelId,
          jid,
          phone,
          name: contact.name || contact.notify || phone,
          pushName: contact.notify || contact.name || phone,
          isBusiness: contact.isBusiness || false,
          profilePicUrl: contact.imgUrl || '',
        }
      );
    }
  } else {
    console.log('[Sync] sock.contacts not available (fallback skipped)');
  }

  console.log(`[Sync] Synced ${syncedCount} contacts/groups (${errorCount} errors) for tenant ${tenantId}, channel ${channelId}`);
  return { synced: syncedCount, errors: errorCount };
};

const createOrUpdateContact = async (tenantId, data) => {
  const phone = String(data.phone || '').replace(/\D/g, '');
  if (!phone) throw new Error('A valid phone number is required');
  const jid = data.jid || `${phone}@s.whatsapp.net`;

  const channelId = data.channelId || data.channel || null;

  return await Contact.findOneAndUpdate(
    { tenantId, ...(channelId ? { channelId } : {}), $or: [{ jid }, { phone }] },
    {
      ...data,
      tenantId,
      ...(channelId ? { channelId } : {}),
      jid,
      phone,
      isGroup: false,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
};

const mergeContactIdentity = async ({ tenantId, channelId, lid, jid }) => {
  if (!lid || !jid || lid === jid) return jid;

  // Move messages first. A message id stays unchanged, so this does not
  // duplicate messages and makes the normal phone chat show its history.
  await ChatMessage.updateMany(
    { tenantId, channelId, remoteJid: lid },
    { $set: { remoteJid: jid } }
  );

  const phone = jid.split('@')[0].split(':')[0];
  const [phoneContact, lidContact] = await Promise.all([
    Contact.findOne({ tenantId, channelId, jid }),
    Contact.findOne({ tenantId, channelId, jid: lid }),
  ]);

  if (phoneContact) {
    await Contact.updateOne(
      { _id: phoneContact._id },
      { $addToSet: { aliases: lid }, $set: { channelId, phone } }
    );
    if (lidContact && String(lidContact._id) !== String(phoneContact._id)) {
      await Contact.deleteOne({ _id: lidContact._id });
    }
  } else if (lidContact) {
    await Contact.updateOne(
      { _id: lidContact._id },
      { $set: { jid, phone, channelId }, $addToSet: { aliases: lid } }
    );
  } else {
    await Contact.findOneAndUpdate(
      { tenantId, jid },
      { $setOnInsert: { tenantId, channelId, jid, phone, isGroup: false }, $addToSet: { aliases: lid } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  }

  return jid;
};

const addContactTag = async (tenantId, jid, tag) => {
  return await Contact.findOneAndUpdate(
    { tenantId, jid },
    { $addToSet: { tags: tag } },
    { new: true }
  );
};

const updateContactNotes = async (tenantId, jid, notes) => {
  return await Contact.findOneAndUpdate(
    { tenantId, jid },
    { notes },
    { new: true }
  );
};

const deleteContact = async (tenantId, contactId) => {
  const contact = await Contact.findOne({ _id: contactId, tenantId });
  if (!contact) return { deleted: false, contact: null };

  await Promise.all([
    Contact.deleteOne({ _id: contactId, tenantId }),
    Conversation.deleteMany({ tenantId, contactId }),
    Conversation.deleteMany({ tenantId, contactJid: contact.jid }),
    ChatMessage.deleteMany({ tenantId, remoteJid: contact.jid }),
  ]);

  return { deleted: true, contact };
};

const searchContacts = async (query, tenantId) => {
  const regex = new RegExp(query, 'i');
  return await Contact.find({
    tenantId,
    $or: [
      { name: regex },
      { phone: regex },
      { pushName: regex },
      { businessName: regex },
    ]
  }).limit(50);
};

module.exports = {
  getChatList,
  getContacts,
  getGroups,
  syncContacts,
  createOrUpdateContact,
  mergeContactIdentity,
  addContactTag,
  updateContactNotes,
  deleteContact,
  searchContacts,
};
